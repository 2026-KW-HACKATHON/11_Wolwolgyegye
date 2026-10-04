import { PGlite } from '@electric-sql/pglite';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const db = new PGlite();
const sqlFile = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const owner = 'a0000000-0000-4000-8000-000000000001';
const neighbor = 'a0000000-0000-4000-8000-000000000002';
const workshop = '10000000-0000-4000-8000-000000000001';
const cafe = '10000000-0000-4000-8000-000000000002';
const hidden = '10000000-0000-4000-8000-000000000003';
const post = '30000000-0000-4000-8000-000000000001';
const sale = '40000000-0000-4000-8000-000000000001';
const request = 'b0000000-0000-4000-8000-000000000001';

// 연결 한 개에서 순서대로 검사한다. 역할/로그인 정보는 매 호출 뒤 롤백한다.
async function as(role, user, query, params = []) {
  assert.ok(['anon', 'authenticated', 'service_role'].includes(role));
  await db.exec('begin; set local role ' + role + ';');
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
    const result = await db.query(query, params);
    await db.exec('commit');
    return result;
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}
const rejectsCode = (promise, code) => assert.rejects(promise, (error) => error.code === code);
const scalar = async (query, params = []) => Object.values((await db.query(query, params)).rows[0])[0];

before(async () => {
  await db.exec(await sqlFile('./bootstrap.sql'));
  const folder = new URL('../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(folder)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(name, folder), 'utf8'));
  }
  const seed = await sqlFile('../supabase/seed.sql');
  await db.exec(seed);
  await db.exec(seed); // seed 재실행으로 중복 데이터가 생기지 않아야 한다.
  assert.equal(await scalar('select count(*)::integer from public.feed_posts'), 2);
  await db.query('insert into auth.users(id) values ($1), ($2)', [owner, neighbor]);
  await db.query("update public.profiles set display_name=case when user_id=$1 then '사장님' else '주민' end where user_id in ($1,$2)", [owner, neighbor]);
  await db.query('update public.stores set owner_id=$1 where id=$2', [owner, workshop]);
  await db.query('update public.stores set owner_id=$1 where id=$2', [neighbor, cafe]);
  await db.query("insert into public.stores(id,owner_id,name,address,lat,lng) values ($1,$2,'비공개 가게','예시',37.62,127.06)", [hidden, owner]);
});
after(async () => { await db.close(); });

const applicant = 'a0000000-0000-4000-8000-000000000003';
const socialUser = 'a0000000-0000-4000-8000-000000000004';
const unverified = 'a0000000-0000-4000-8000-000000000005';
const newStore = '10000000-0000-4000-8000-000000000004';
let applicationId;
const applyQuery = "insert into public.owner_applications(user_id,applicant_name,contact_phone,store_name,store_address) values ($1,'테스트 신청자','000-0000-0000','신청 가게','예시 주소') returning id";

test('이메일/소셜 가입 프로필 자동 생성, 이름 정규화 및 metadata 권한 위조 무시', async () => {
  await db.query("insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values ($1,$2,now()),($3,$4,now()),($5,null,null)", [
    applicant, { display_name: '새 사장님', role: 'owner' }, socialUser, { name: '가'.repeat(70), role: 'admin' }, unverified,
  ]);
  await db.query("insert into auth.identities(user_id,provider) values ($1,'email'),($2,'kakao'),($3,'email')", [applicant, socialUser, unverified]);
  assert.equal(await scalar('select display_name from public.profiles where user_id=$1', [applicant]), '새 사장님');
  assert.equal(await scalar('select length(display_name) from public.profiles where user_id=$1', [socialUser]), 40);
  assert.equal(await scalar('select display_name from public.profiles where user_id=$1', [unverified]), '월계 주민');
  assert.equal((await as('authenticated', socialUser, "update public.stores set name='침범' where id=$1", [workshop])).affectedRows, 0);
  await db.query("insert into public.stores(id,name,address,lat,lng) values ($1,'승인 대상','예시',37.62,127.06)", [newStore]);
});

test('이메일 미인증/소셜 전용 계정의 사장님 신청 차단, 자기 신청만 허용', async () => {
  await rejectsCode(as('authenticated', unverified, applyQuery, [unverified]), '42501');
  await rejectsCode(as('authenticated', socialUser, applyQuery, [socialUser]), '42501');
  await rejectsCode(as('authenticated', applicant, applyQuery, [owner]), '42501');
  applicationId = (await as('authenticated', applicant, applyQuery, [applicant])).rows[0].id;
  await rejectsCode(as('authenticated', applicant, applyQuery, [applicant]), '23505');
  assert.equal((await as('authenticated', applicant, 'select status from public.owner_applications')).rows[0].status, 'pending');
  assert.equal((await as('authenticated', socialUser, 'select * from public.owner_applications')).rows.length, 0);
  await rejectsCode(as('anon', null, 'select * from public.owner_applications'), '42501');
  // 신청만으로 가게 권한이 생기지 않는다.
  assert.equal((await as('authenticated', applicant, "update public.stores set name='무단 변경' where id=$1", [newStore])).affectedRows, 0);
});

test('신청자가 직접 승인하거나 승인 함수를 호출할 수 없음', async () => {
  await rejectsCode(as('authenticated', applicant, "update public.owner_applications set status='approved' where id=$1", [applicationId]), '42501');
  await rejectsCode(as('authenticated', applicant, "insert into public.owner_applications(user_id,applicant_name,contact_phone,store_name,store_address,status) values ($1,'위조','000-0000-0000','가게','주소','approved')", [applicant]), '42501');
  await rejectsCode(as('authenticated', applicant, "select public.review_owner_application($1,'approved',$2)", [applicationId, newStore]), '42501');
});

test('다른 사장님 가게 탈취 차단 및 승인 실패 시 신청 상태 유지', async () => {
  await rejectsCode(as('service_role', null, "select public.review_owner_application($1,'approved',$2)", [applicationId, workshop]), '23505');
  assert.equal(await scalar('select status from public.owner_applications where id=$1', [applicationId]), 'pending');
  assert.equal(await scalar('select owner_id from public.stores where id=$1', [workshop]), owner);
  await db.query('update auth.users set email_confirmed_at=null where id=$1', [applicant]);
  await rejectsCode(as('service_role', null, "select public.review_owner_application($1,'approved',$2)", [applicationId, newStore]), '42501');
  await db.query('update auth.users set email_confirmed_at=now() where id=$1', [applicant]);
});

test('서버 승인 시 가게 소유권 연결, 재시도 안전, 게시글 작성 가능', async () => {
  const approve = "select public.review_owner_application($1,'approved',$2,'확인 완료') as store_id";
  await as('service_role', null, approve, [applicationId, newStore]);
  assert.equal((await as('service_role', null, approve, [applicationId, newStore])).rows[0].store_id, newStore);
  assert.equal(await scalar('select owner_id from public.stores where id=$1', [newStore]), applicant);
  // 사장님 승인과 가게 공개는 별개다.
  assert.equal((await as('anon', null, 'select id from public.stores where id=$1', [newStore])).rows.length, 0);
  assert.equal((await as('authenticated', applicant, "insert into public.feed_posts(store_id,author_id,kind,title,description,category,price,capacity,contact_phone,schedule,minimum_hours) values ($1,$2,'space-rental','공간','설명','스터디·회의',10000,4,'000-0000-0000','협의',1) returning id", [newStore, applicant])).rows.length, 1);
  await rejectsCode(as('service_role', null, "select public.review_owner_application($1,'rejected',null,'변경')", [applicationId]), '22023');
});

test('반려 신청은 기록을 남기며 새 신청 가능', async () => {
  const second = (await as('authenticated', applicant, applyQuery, [applicant])).rows[0].id;
  await as('service_role', null, "select public.review_owner_application($1,'rejected',null,'정보 확인 필요')", [second]);
  assert.equal(await scalar('select status from public.owner_applications where id=$1', [second]), 'rejected');
  assert.equal((await as('authenticated', applicant, applyQuery, [applicant])).rows.length, 1);
});

test('기존 Auth 계정 프로필 보완과 기존 닉네임 보존', async () => {
  const migrationDb = new PGlite();
  try {
    await migrationDb.exec(await sqlFile('./bootstrap.sql'));
    const folder = new URL('../supabase/migrations/', import.meta.url);
    const files = (await readdir(folder)).filter((name) => name.endsWith('.sql')).sort();
    for (const name of files.filter((name) => !name.includes('00600'))) {
      await migrationDb.exec(await readFile(new URL(name, folder), 'utf8'));
    }
    await migrationDb.query("insert into auth.users(id,raw_user_meta_data) values ($1,$2),($3,$4)", [owner, { name: '기존 소셜' }, neighbor, { name: '바뀌면 안 됨' }]);
    await migrationDb.query("insert into public.profiles(user_id,display_name) values ($1,'내 닉네임')", [neighbor]);
    await migrationDb.exec(await sqlFile('../supabase/migrations/20260926000600_auth_onboarding.sql'));
    const rows = (await migrationDb.query('select user_id,display_name from public.profiles')).rows;
    assert.equal(rows.find((row) => row.user_id === owner).display_name, '기존 소셜');
    assert.equal(rows.find((row) => row.user_id === neighbor).display_name, '내 닉네임');
  } finally {
    await migrationDb.close();
  }
});


test('모든 앱 테이블 15개에 RLS 적용', async () => {
  const rows = (await db.query("select relname,relrowsecurity from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='public' and c.relkind='r'")).rows;
  assert.equal(rows.length, 15);
  assert.ok(rows.every((row) => row.relrowsecurity));
});
test('예시 데이터 재실행과 익명 공개/비공개 조회', async () => {
  const rows = (await as('anon', null, 'select id from public.stores')).rows;
  assert.equal(rows.length, 2);
  assert.ok(!rows.some((row) => row.id === hidden));
  assert.equal((await as('authenticated', owner, 'select id from public.stores where id=$1', [hidden])).rows.length, 1);
});
test('프로필은 본인만 조회/수정하며 다른 계정 생성 금지', async () => {
  assert.equal((await as('authenticated', owner, 'select user_id from public.profiles')).rows.length, 1);
  assert.equal((await as('authenticated', owner, "update public.profiles set display_name='침범' where user_id=$1", [neighbor])).affectedRows, 0);
  await rejectsCode(as('authenticated', owner, "insert into public.profiles(user_id,display_name) values ($1,'침범')", [neighbor]), '42501');
});
test('가게 소유권 변경과 임의 가게 등록 금지', async () => {
  await rejectsCode(as('authenticated', owner, 'update public.stores set owner_id=$1 where id=$2', [neighbor, workshop]), '42501');
  await rejectsCode(as('authenticated', owner, "insert into public.stores(name,address,lat,lng) values ('임의','예시',37,127)"), '42501');
  assert.equal((await as('authenticated', owner, "update public.stores set name='[예시] 수정한 공방' where id=$1", [workshop])).affectedRows, 1);
});
test('타인 게시글 수정/삭제 금지, 사장님의 자기 가게 글 수정 허용', async () => {
  assert.equal((await as('authenticated', neighbor, "update public.feed_posts set title='침범' where id=$1", [post])).affectedRows, 0);
  assert.equal((await as('authenticated', neighbor, 'delete from public.feed_posts where id=$1', [post])).affectedRows, 0);
  assert.equal((await as('authenticated', owner, "update public.feed_posts set title='[예시] 수정한 공간' where id=$1", [post])).affectedRows, 1);
});
test('사장님 글 작성과 종류별 필수값 검사', async () => {
  const query = "insert into public.feed_posts(store_id,author_id,kind,title,description,category,price,capacity,contact_phone,starts_at,duration_minutes) values ($1,$2,'oneday-class','테스트 수업','설명','공예·미술',10000,4,'000-0000-0000',now()+interval '1 day',$3) returning id";
  assert.equal((await as('authenticated', owner, query, [workshop, owner, 90])).rows.length, 1);
  await rejectsCode(as('authenticated', neighbor, query, [workshop, neighbor, 90]), '42501');
  await rejectsCode(as('authenticated', owner, query, [workshop, neighbor, 90]), '42501');
  await rejectsCode(as('authenticated', owner, query, [workshop, owner, null]), '23514');
  await rejectsCode(as('authenticated', owner, 'update public.feed_posts set price=-1 where id=$1', [post]), '23514');
});
test('가게 찜 본인 저장, 중복 금지, 타인 조회 금지', async () => {
  await as('authenticated', owner, 'insert into public.store_favorites(user_id,store_id) values ($1,$2)', [owner, cafe]);
  await rejectsCode(as('authenticated', owner, 'insert into public.store_favorites(user_id,store_id) values ($1,$2)', [owner, cafe]), '23505');
  assert.equal((await as('authenticated', neighbor, 'select * from public.store_favorites')).rows.length, 0);
  await rejectsCode(as('authenticated', neighbor, 'insert into public.store_favorites(user_id,store_id) values ($1,$2)', [owner, workshop]), '42501');
});
test('비공개 게시글은 조회/찜 불가', async () => {
  await as('authenticated', owner, 'update public.feed_posts set is_published=false where id=$1', [post]);
  assert.equal((await as('anon', null, 'select id from public.feed_posts where id=$1', [post])).rows.length, 0);
  await rejectsCode(as('authenticated', neighbor, 'insert into public.post_favorites(user_id,post_id) values ($1,$2)', [neighbor, post]), '42501');
  await as('authenticated', owner, 'update public.feed_posts set is_published=true where id=$1', [post]);
  await as('authenticated', neighbor, 'insert into public.post_favorites(user_id,post_id) values ($1,$2)', [neighbor, post]);
});
test('세일 관심 수 집계는 다른 사용자의 찜 ID를 노출하지 않는다', async () => {
  await as('authenticated', owner, 'insert into public.sale_likes(user_id,sale_id) values ($1,$2)', [owner, sale]);
  await as('authenticated', neighbor, 'insert into public.sale_likes(user_id,sale_id) values ($1,$2)', [neighbor, sale]);
  assert.equal((await as('authenticated', owner, 'select * from public.sale_likes')).rows.length, 1);
  const counts = (await as('anon', null, 'select * from public.get_sale_like_counts($1::uuid[])', [[sale]])).rows;
  assert.equal(Number(counts[0].like_count), 2);
  await as('authenticated', neighbor, 'update public.closing_sales set is_published=false where id=$1', [sale]);
  assert.equal((await as('anon', null, 'select * from public.get_sale_like_counts($1::uuid[])', [[sale]])).rows.length, 0);
});
test('다른 가게 세일에 상품을 끼워넣을 수 없다', async () => {
  await rejectsCode(as('authenticated', owner, "insert into public.closing_sale_items(sale_id,store_id,name,original_price,discount_rate) values ($1,$2,'잘못된 상품',1000,0.1)", [sale, workshop]), '23503');
});
test('제휴 혜택은 사장님 계정도 임의 발급할 수 없다', async () => {
  await rejectsCode(as('authenticated', neighbor, "insert into public.partner_benefits(store_id,college_key,benefit) values ($1,'biz','무료')", [cafe]), '42501');
});
test('스탬프 직접 수정과 일반 사용자의 적립 함수 호출 금지', async () => {
  await rejectsCode(as('authenticated', neighbor, 'insert into public.user_stamps(user_id,store_id,count) values ($1,$2,999)', [neighbor, cafe]), '42501');
  await rejectsCode(as('authenticated', neighbor, "select public.apply_stamp_change($1,$2,3,$3,'테스트')", [neighbor, cafe, request]), '42501');
});
test('서버 적립의 중복 방지, 사용 시 잔액 부족 롤백', async () => {
  const query = 'select public.apply_stamp_change($1,$2,$3,$4,$5) as balance';
  assert.equal((await as('service_role', null, query, [owner, cafe, 3, request, '구매 확인'])).rows[0].balance, 3);
  assert.equal((await as('service_role', null, query, [owner, cafe, 3, request, '구매 확인'])).rows[0].balance, 3);
  await rejectsCode(as('service_role', null, query, [owner, cafe, 4, request, '구매 확인']), '22023');
  await rejectsCode(as('service_role', null, query, [owner, cafe, -4, 'b0000000-0000-4000-8000-000000000002', '사용']), '23514');
  assert.equal(await scalar('select count from public.user_stamps where user_id=$1 and store_id=$2', [owner, cafe]), 3);
  assert.equal(await scalar('select count(*)::integer from public.stamp_transactions'), 1);
  assert.equal((await as('service_role', null, query, [owner, cafe, -2, 'b0000000-0000-4000-8000-000000000003', '사용'])).rows[0].balance, 1);
  assert.equal((await as('authenticated', neighbor, 'select * from public.user_stamps')).rows.length, 0);
});
test('이미지 경로는 본인 가게만 쓰기 가능, 경로 이동 공격 차단', async () => {
  const path = workshop + '/test.webp';
  await as('authenticated', owner, "insert into storage.objects(bucket_id,name) values ('store-media',$1)", [path]);
  await rejectsCode(as('authenticated', neighbor, "insert into storage.objects(bucket_id,name) values ('store-media',$1)", [workshop + '/other.webp']), '42501');
  await rejectsCode(as('authenticated', owner, "update storage.objects set name=$1 where name=$2", [cafe + '/test.webp', path]), '42501');
  assert.equal((await as('authenticated', neighbor, 'select * from storage.objects')).rows.length, 0);
});

test('관리자 RPC는 서버 권한표를 확인하고 일반 로그인 사용자를 차단', async () => {
  await db.query('insert into private.admin_users(user_id) values ($1)', [owner]);
  assert.equal((await as('authenticated', owner, 'select public.is_current_user_admin() as allowed')).rows[0].allowed, true);
  assert.equal((await as('authenticated', neighbor, 'select public.is_current_user_admin() as allowed')).rows[0].allowed, false);
  await rejectsCode(as('authenticated', neighbor, "select * from public.admin_list_owner_applications('all')"), '42501');
  assert.ok((await as('authenticated', owner, "select * from public.admin_list_owner_applications('all')")).rows.length > 0);
  await as('authenticated', owner, 'select public.admin_set_store_published($1,true)', [hidden]);
  assert.equal((await as('anon', null, 'select id from public.stores where id=$1', [hidden])).rows.length, 1);
  await as('authenticated', owner, 'select public.admin_set_store_published($1,false)', [hidden]);
});
