// 새 구조(migrations/20261004000100_schema.sql)를 메모리 PostgreSQL(PGlite)에서 검사한다.
// 아래 가게·계정은 테스트 안에서만 만들고 지우는 값이며, 실제 DB 에는 들어가지 않는다.
import { PGlite } from '@electric-sql/pglite';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const db = new PGlite();
const sqlFile = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const owner = 'a0000000-0000-4000-8000-000000000001';
const neighbor = 'a0000000-0000-4000-8000-000000000002';
const applicant = 'a0000000-0000-4000-8000-000000000003';
const socialUser = 'a0000000-0000-4000-8000-000000000004';
const unverified = 'a0000000-0000-4000-8000-000000000005';
const hiddenOwner = 'a0000000-0000-4000-8000-000000000006';
const secondApplicant = 'a0000000-0000-4000-8000-000000000007';
const shopA = '10000000-0000-4000-8000-000000000001'; // owner 의 가게
const shopB = '10000000-0000-4000-8000-000000000002'; // neighbor 의 가게
const hidden = '10000000-0000-4000-8000-000000000003'; // 비공개, 별도 사장 소유
const freeShop = '10000000-0000-4000-8000-000000000004'; // 주인 없음 (승인 대상)
const freeShop2 = '10000000-0000-4000-8000-000000000005'; // 주인 없음 (1:1 제약 검사)
const request = 'b0000000-0000-4000-8000-000000000001';
let applicationId;

// 연결 한 개에서 순서대로 검사한다. 역할/로그인 정보는 매 호출 뒤 되돌린다.
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
const rows = async (role, user, query, params) => (await as(role, user, query, params)).rows;

before(async () => {
  await db.exec(await sqlFile('./bootstrap.sql'));
  const folder = new URL('../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(folder)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(name, folder), 'utf8'));
  }
  await db.query("insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values ($1,null,now()),($2,null,now()),($3,null,now())", [owner, neighbor, hiddenOwner]);
  await db.query("insert into auth.identities(user_id,provider) values ($1,'email'),($2,'email'),($3,'email')", [owner, neighbor, hiddenOwner]);
  await db.exec("insert into public.store_types(id,name,group_name) values ('korean','한식','restaurant'),('cafe','카페','cafe')");
  await db.query(`insert into public.stores(id,owner_id,sbiz_id,name,type_id,address,lat,lng,floor,building_id,is_published) values
    ($1,$6,'MA001','가게 A','korean','주소 1',37.62,127.06,1,'B1',true),
    ($2,$8,'MA002','가게 B','cafe','주소 2',37.62,127.06,-1,'B1',true),
    ($3,$7,null,'비공개 가게',null,'주소 3',37.62,127.06,null,'',false),
    ($4,null,'MA004','주인 없는 가게','korean','주소 4',37.62,127.06,2,'B2',true),
    ($5,null,'MA005','두 번째 빈 가게','cafe','주소 5',37.62,127.06,1,'B2',true)`, [shopA, shopB, hidden, freeShop, freeShop2, owner, hiddenOwner, neighbor]);
});
after(async () => { await db.close(); });

test('모든 앱 표에 RLS 적용', async () => {
  const tables = (await db.query("select relname,relrowsecurity from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='public' and c.relkind='r'")).rows;
  assert.equal(tables.length, 24);
  assert.deepEqual(tables.filter((t) => !t.relrowsecurity).map((t) => t.relname), []);
});

test('비로그인: 공개 가게와 유형만 보이고, 비공개 가게는 사장님 본인만 본다', async () => {
  const visible = (await rows('anon', null, 'select id from public.stores')).map((r) => r.id);
  assert.equal(visible.length, 4);
  assert.ok(!visible.includes(hidden));
  assert.equal((await rows('anon', null, 'select id from public.store_types')).length, 2);
  assert.equal((await rows('authenticated', hiddenOwner, 'select id from public.stores where id=$1', [hidden])).length, 1);
  assert.equal((await rows('authenticated', neighbor, 'select id from public.stores where id=$1', [hidden])).length, 0);
});

test('가게: 사장님은 이름·유형·전화만 고치고, 소유권·좌표·공개 여부·새 가게 등록은 못 한다', async () => {
  assert.equal((await as('authenticated', owner, "update public.stores set name='새 이름', type_id='cafe', phone='02-000-0000' where id=$1", [shopA])).affectedRows, 1);
  assert.equal((await as('authenticated', neighbor, "update public.stores set name='침범' where id=$1", [shopA])).affectedRows, 0);
  await rejectsCode(as('authenticated', owner, 'update public.stores set owner_id=$1 where id=$2', [neighbor, shopA]), '42501');
  await rejectsCode(as('authenticated', owner, 'update public.stores set lat=37.7 where id=$1', [shopA]), '42501');
  await rejectsCode(as('authenticated', owner, 'update public.stores set is_published=false where id=$1', [shopA]), '42501');
  await rejectsCode(as('authenticated', owner, "insert into public.stores(name,address,lat,lng) values ('임의','주소',37,127)"), '42501');
  await rejectsCode(db.query("insert into public.stores(name,address,lat,lng,type_id) values ('없는 유형','주소',37,127,'nope')"), '23503');
});

test('메뉴·영업시간·이미지: 자기 가게만 쓰고, 공개 가게 것은 누구나 읽는다', async () => {
  await as('authenticated', owner, "insert into public.store_menus(store_id,name,price,type_id) values ($1,'김치찌개',9000,'korean')", [shopA]);
  await rejectsCode(as('authenticated', neighbor, "insert into public.store_menus(store_id,name,price) values ($1,'침범',1)", [shopA]), '42501');
  await rejectsCode(as('authenticated', owner, "insert into public.store_menus(store_id,name,price) values ($1,'음수',-1)", [shopA]), '23514');
  assert.equal((await rows('anon', null, 'select name from public.store_menus where store_id=$1', [shopA])).length, 1);

  await as('authenticated', owner, "insert into public.store_hours(store_id,weekday,opens_at,closes_at) values ($1,1,'11:00','02:00')", [shopA]);
  await as('authenticated', owner, 'insert into public.store_hours(store_id,weekday,is_closed) values ($1,0,true)', [shopA]);
  await rejectsCode(as('authenticated', owner, "insert into public.store_hours(store_id,weekday,opens_at,closes_at) values ($1,1,'09:00','18:00')", [shopA]), '23505');
  await rejectsCode(as('authenticated', owner, 'insert into public.store_hours(store_id,weekday) values ($1,2)', [shopA]), '23514');
  await rejectsCode(as('authenticated', owner, "insert into public.store_hours(store_id,weekday,opens_at,closes_at) values ($1,7,'09:00','18:00')", [shopA]), '23514');

  await as('authenticated', hiddenOwner, "insert into public.store_images(store_id,image_path) values ($1,$2)", [hidden, hidden + '/a.webp']);
  assert.equal((await rows('anon', null, 'select id from public.store_images where store_id=$1', [hidden])).length, 0);
  assert.equal((await rows('authenticated', hiddenOwner, 'select id from public.store_images where store_id=$1', [hidden])).length, 1);
});

test('제휴: 운영자만 등록하고, 혜택 하나를 여러 제휴사에 건다', async () => {
  await rejectsCode(as('authenticated', owner, "insert into public.partner_benefits(store_id,discount_rate) values ($1,0.1)", [shopA]), '42501');
  await rejectsCode(as('authenticated', owner, "insert into public.partners(name) values ('경영대')"), '42501');
  const [p1, p2] = (await rows('service_role', null, "insert into public.partners(name) values ('경영대'),('공과대') returning id")).map((r) => r.id);
  const benefit = (await rows('service_role', null, "insert into public.partner_benefits(store_id,discount_amount,condition) values ($1,1000,'학생증 제시') returning id", [shopA]))[0].id;
  await as('service_role', null, 'insert into public.benefit_partners(benefit_id,partner_id) values ($1,$2),($1,$3)', [benefit, p1, p2]);
  await rejectsCode(as('service_role', null, 'insert into public.benefit_partners(benefit_id,partner_id) values ($1,$2)', [benefit, p1]), '23505');
  await rejectsCode(as('service_role', null, 'insert into public.partner_benefits(store_id) values ($1)', [shopA]), '23514');
  assert.equal((await rows('anon', null, 'select id from public.benefit_partners')).length, 2);
});

test('단과대 제휴 가게: 운영자만 연결하고 공개 가게 관계만 읽는다', async () => {
  const partner = (await rows('service_role', null, "select id from public.partners where name='경영대'"))[0].id;
  await rejectsCode(as('authenticated', owner, 'insert into public.store_partners(store_id,partner_id) values ($1,$2)', [shopA, partner]), '42501');
  await as('service_role', null, 'insert into public.store_partners(store_id,partner_id) values ($1,$2),($3,$2)', [shopA, partner, hidden]);
  await rejectsCode(as('service_role', null, 'insert into public.store_partners(store_id,partner_id) values ($1,$2)', [shopA, partner]), '23505');
  assert.equal((await rows('anon', null, 'select store_id from public.store_partners')).length, 1);
  assert.equal((await rows('authenticated', owner, 'select store_id from public.store_partners')).length, 1);
});

test('내 단과대: 사용자는 자기 프로필에만 등록·해제하고, 단과대가 지워지면 비워진다', async () => {
  const partner = (await rows('service_role', null, "insert into public.partners(name) values ('자연과학대') returning id"))[0].id;
  assert.equal((await as('authenticated', owner, 'update public.profiles set college_id=$1 where user_id=$2', [partner, owner])).affectedRows, 1);
  assert.equal((await as('authenticated', owner, 'update public.profiles set college_id=$1 where user_id=$2', [partner, neighbor])).affectedRows, 0);
  assert.equal(await scalar('select college_id from public.profiles where user_id=$1', [neighbor]), null);
  await rejectsCode(as('authenticated', owner, 'update public.profiles set college_id=gen_random_uuid() where user_id=$1', [owner]), '23503');
  await as('service_role', null, 'delete from public.partners where id=$1', [partner]);
  assert.equal(await scalar('select college_id from public.profiles where user_id=$1', [owner]), null);
});

test('마감세일: 금액·퍼센트·무료 제공 세 유형과 각 유형의 필수값', async () => {
  const insert = 'insert into public.closing_sales(store_id,discount_type,discount_amount,discount_rate,offer,starts_at,ends_at) values ($1,$2,$3,$4,$5,now(),now()+interval \'2 hours\')';
  await as('authenticated', owner, insert, [shopA, 'amount', 2000, null, '']);
  await as('authenticated', owner, insert, [shopA, 'rate', null, 0.3, '']);
  await as('authenticated', owner, insert, [shopA, 'free', null, null, '빵 2개 사면 1개 더']);
  await rejectsCode(as('authenticated', owner, insert, [shopA, 'amount', null, 0.3, '']), '23514');
  await rejectsCode(as('authenticated', owner, insert, [shopA, 'free', null, null, ' ']), '23514');
  await rejectsCode(as('authenticated', owner, insert, [shopA, 'coupon', 1000, null, '']), '23514');
  await rejectsCode(as('authenticated', owner, insert, [shopA, 'rate', null, 1.5, '']), '23514');
  await rejectsCode(as('authenticated', neighbor, insert, [shopA, 'amount', 1000, null, '']), '42501');
  await rejectsCode(as('authenticated', owner, "insert into public.closing_sales(store_id,discount_type,discount_amount,starts_at,ends_at) values ($1,'amount',1,now(),now()-interval '1 hour')", [shopA]), '23514');
  assert.equal((await rows('anon', null, 'select id from public.closing_sales')).length, 3);
});

test('공간대여·원데이클래스: 한 가게에 여러 개, 비공개 글은 사장님만 보고 사진은 글을 따른다', async () => {
  const category = (await rows('service_role', null, "select id from public.space_rental_categories where name = '스터디·회의'"))[0].id;
  const insertRental = "insert into public.space_rentals(store_id,category_id,title,price,capacity,min_hours,is_published) values ($1,$2,$3,10000,4,2,$4) returning id";
  const open = (await rows('authenticated', owner, insertRental, [shopA, category, '공간 1', true]))[0].id;
  const closed = (await rows('authenticated', owner, insertRental, [shopA, category, '공간 2', false]))[0].id;
  await rejectsCode(as('authenticated', neighbor, insertRental, [shopA, category, '침범', true]), '42501');
  await rejectsCode(as('authenticated', owner, "insert into public.space_rental_categories(name) values ('임의')"), '42501');
  assert.deepEqual((await rows('anon', null, 'select id from public.space_rentals')).map((r) => r.id), [open]);
  assert.equal((await rows('authenticated', owner, 'select id from public.space_rentals')).length, 2);

  await as('authenticated', owner, 'insert into public.space_rental_images(space_rental_id,image_path) values ($1,$2),($3,$4)', [open, shopA + '/1.webp', closed, shopA + '/2.webp']);
  await rejectsCode(as('authenticated', neighbor, 'insert into public.space_rental_images(space_rental_id,image_path) values ($1,$2)', [open, shopB + '/x.webp']), '42501');
  assert.equal((await rows('anon', null, 'select id from public.space_rental_images')).length, 1);

  const insertClass = "insert into public.one_day_classes(store_id,title,starts_at,duration_minutes,price,current_count,max_count) values ($1,'수업',now()+interval '1 day',90,30000,$2,$3) returning id";
  assert.equal((await rows('authenticated', owner, insertClass, [shopA, 3, 8])).length, 1);
  assert.equal((await rows('authenticated', owner, insertClass, [shopA, 0, 4])).length, 1);
  await rejectsCode(as('authenticated', owner, insertClass, [shopA, 9, 8]), '23514');
  assert.equal((await rows('anon', null, 'select id from public.one_day_classes')).length, 2);
});

test('등록 취소: 사장님만 사유와 함께 취소하고, 취소한 글은 손님에게 안 보인다', async () => {
  const id = (await rows('authenticated', owner, "insert into public.one_day_classes(store_id,title,starts_at,duration_minutes,price,current_count,max_count) values ($1,'취소 수업',now()+interval '2 day',60,10000,2,6) returning id", [shopA]))[0].id;
  const cancel = "update public.one_day_classes set status='closed', is_published=false, cancelled_at=now(), cancel_reason=$2 where id=$1 returning id";
  await rejectsCode(as('authenticated', owner, cancel, [id, '   ']), '23514');
  assert.equal((await rows('authenticated', neighbor, cancel, [id, '남의 글'])).length, 0);
  assert.equal((await rows('authenticated', owner, cancel, [id, '재료 수급 문제'])).length, 1);
  assert.equal((await rows('anon', null, 'select id from public.one_day_classes where id=$1', [id])).length, 0);
  assert.equal((await rows('authenticated', owner, 'select cancel_reason from public.one_day_classes where id=$1', [id]))[0].cancel_reason, '재료 수급 문제');
});

test('이메일/소셜 가입 시 프로필 자동 생성, 이름 정리', async () => {
  await db.query("insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values ($1,$2,now()),($3,$4,now()),($5,null,null)", [
    applicant, { display_name: '새 사장님', role: 'owner' }, socialUser, { name: '가'.repeat(70) }, unverified,
  ]);
  await db.query("insert into auth.identities(user_id,provider) values ($1,'email'),($2,'kakao'),($3,'email')", [applicant, socialUser, unverified]);
  await db.query("insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values ($1,null,now())", [secondApplicant]);
  await db.query("insert into auth.identities(user_id,provider) values ($1,'email')", [secondApplicant]);
  assert.equal(await scalar('select display_name from public.profiles where user_id=$1', [applicant]), '새 사장님');
  assert.equal(await scalar('select length(display_name) from public.profiles where user_id=$1', [socialUser]), 40);
  assert.equal(await scalar('select display_name from public.profiles where user_id=$1', [unverified]), '월계 주민');
  assert.equal((await rows('authenticated', owner, 'select user_id from public.profiles')).length, 1);
});

test('사장님 신청: 인증 계정이 실제 DB 가게를 선택하고 관리자는 그 가게만 승인', async () => {
  const apply = "insert into public.owner_applications(user_id,applicant_name,contact_phone,requested_store_id,business_registration_number) values ($1,'신청자','000-0000-0000',$2,'123-45-67890') returning id";
  await rejectsCode(as('authenticated', unverified, apply, [unverified, freeShop]), '42501');
  await rejectsCode(as('authenticated', socialUser, apply, [socialUser, freeShop]), '42501');
  await rejectsCode(as('authenticated', applicant, apply, [owner, freeShop]), '42501');
  await rejectsCode(as('authenticated', applicant, apply, [applicant, shopA]), '22023');
  applicationId = (await rows('authenticated', applicant, apply, [applicant, freeShop]))[0].id;
  assert.equal(await scalar('select store_name from public.owner_applications where id=$1', [applicationId]), '주인 없는 가게');
  assert.equal(await scalar('select business_registration_number from public.owner_applications where id=$1', [applicationId]), '1234567890');
  assert.equal((await rows('authenticated', secondApplicant, "select * from public.search_claimable_stores('주인 없는')")).length, 0);
  await rejectsCode(as('authenticated', secondApplicant, apply, [secondApplicant, freeShop]), '23505');
  await rejectsCode(as('authenticated', applicant, apply, [applicant, freeShop]), '23505');
  await rejectsCode(as('authenticated', applicant, "select public.review_owner_application($1,'approved',$2)", [applicationId, freeShop]), '42501');
  // 신청자가 고르지 않은 다른 가게로 바꾸어 승인할 수 없다.
  await rejectsCode(as('service_role', null, "select public.review_owner_application($1,'approved',$2)", [applicationId, shopA]), '22023');
  await as('service_role', null, "select public.review_owner_application($1,'approved',$2,'확인')", [applicationId, freeShop]);
  assert.equal(await scalar('select owner_id from public.stores where id=$1', [freeShop]), applicant);
  await rejectsCode(as('authenticated', applicant, apply, [applicant, freeShop2]), '23505');
  await rejectsCode(as('service_role', null, 'update public.stores set owner_id=$1 where id=$2', [applicant, freeShop2]), '23505');
  assert.equal((await as('authenticated', applicant, "update public.stores set phone='010-0000-0000' where id=$1", [freeShop])).affectedRows, 1);
});

test('관리자 RPC는 서버 권한표를 확인하고 일반 로그인 사용자를 차단', async () => {
  await db.query('insert into private.admin_users(user_id) values ($1)', [owner]);
  assert.equal((await as('authenticated', owner, 'select public.is_current_user_admin() as allowed')).rows[0].allowed, true);
  assert.equal((await as('authenticated', neighbor, 'select public.is_current_user_admin() as allowed')).rows[0].allowed, false);
  await rejectsCode(as('authenticated', neighbor, "select * from public.admin_list_owner_applications('all')"), '42501');
  assert.ok((await as('authenticated', owner, "select * from public.admin_list_owner_applications('all')")).rows.length > 0);
  const stores = (await as('authenticated', owner, 'select * from public.admin_list_stores()')).rows;
  assert.equal(stores.find((store) => store.id === hidden).is_demo, false);
  await as('authenticated', owner, 'select public.admin_set_store_published($1,true)', [hidden]);
  assert.equal((await as('anon', null, 'select id from public.stores where id=$1', [hidden])).rows.length, 1);
  await as('authenticated', owner, 'select public.admin_set_store_published($1,false)', [hidden]);
});

test('가게 찜: 본인 것만, 공개 가게만, 중복 금지', async () => {
  await as('authenticated', neighbor, 'insert into public.store_favorites(user_id,store_id) values ($1,$2)', [neighbor, shopA]);
  await rejectsCode(as('authenticated', neighbor, 'insert into public.store_favorites(user_id,store_id) values ($1,$2)', [neighbor, shopA]), '23505');
  await rejectsCode(as('authenticated', neighbor, 'insert into public.store_favorites(user_id,store_id) values ($1,$2)', [neighbor, hidden]), '42501');
  await rejectsCode(as('authenticated', neighbor, 'insert into public.store_favorites(user_id,store_id) values ($1,$2)', [owner, shopB]), '42501');
  assert.equal((await rows('authenticated', owner, 'select * from public.store_favorites')).length, 0);
});

test('마감세일·게시글 찜: 로그인 사용자 본인 기록만 쓰고 공개 합계만 센다', async () => {
  const saleId = await scalar('select id from public.closing_sales where store_id=$1 limit 1', [shopA]);
  await as('authenticated', neighbor, 'insert into public.sale_likes(user_id,sale_id) values ($1,$2)', [neighbor, saleId]);
  await rejectsCode(as('authenticated', neighbor, 'insert into public.sale_likes(user_id,sale_id) values ($1,$2)', [owner, saleId]), '42501');
  assert.equal((await as('anon', null, 'select * from public.get_sale_like_counts(array[$1]::uuid[])', [saleId])).rows[0].like_count, 1);

  const postId = (await rows('authenticated', owner, "insert into public.space_rentals(store_id,title,price,capacity,status) values ($1,'찜 테스트',0,1,'open') returning id", [shopA]))[0].id;
  await as('authenticated', neighbor, 'insert into public.post_favorites(user_id,post_id) values ($1,$2)', [neighbor, postId]);
  await rejectsCode(as('authenticated', neighbor, 'insert into public.post_favorites(user_id,post_id) values ($1,$2)', [owner, postId]), '42501');
  assert.equal((await rows('authenticated', neighbor, 'select post_id from public.post_favorites')).length, 1);
  assert.equal((await rows('authenticated', owner, 'select post_id from public.post_favorites')).length, 0);
});

test('스탬프: 직접 수정 금지, 서버 적립의 중복 방지와 잔액 부족 롤백', async () => {
  await as('authenticated', neighbor, "insert into public.stamp_policies(store_id,required_stamps,reward,unit) values ($1,10,'음료 1잔','1회 방문')", [shopB]);
  await rejectsCode(as('authenticated', owner, 'insert into public.user_stamps(user_id,store_id,count) values ($1,$2,999)', [owner, shopB]), '42501');
  await rejectsCode(as('authenticated', owner, "select public.apply_stamp_change($1,$2,3,$3,'테스트')", [owner, shopB, request]), '42501');
  const change = 'select public.apply_stamp_change($1,$2,$3,$4,$5) as balance';
  assert.equal((await rows('service_role', null, change, [owner, shopB, 3, request, '구매']))[0].balance, 3);
  assert.equal((await rows('service_role', null, change, [owner, shopB, 3, request, '구매']))[0].balance, 3);
  await rejectsCode(as('service_role', null, change, [owner, shopB, -4, 'b0000000-0000-4000-8000-000000000002', '사용']), '23514');
  assert.equal(await scalar('select count from public.user_stamps where user_id=$1 and store_id=$2', [owner, shopB]), 3);
  assert.equal((await rows('authenticated', neighbor, 'select * from public.user_stamps')).length, 0);
});

test('사진 저장소: 자기 가게 폴더만 쓰고, 다른 가게 폴더로 옮길 수 없다', async () => {
  const path = shopA + '/test.webp';
  await as('authenticated', owner, "insert into storage.objects(bucket_id,name) values ('store-media',$1)", [path]);
  await rejectsCode(as('authenticated', neighbor, "insert into storage.objects(bucket_id,name) values ('store-media',$1)", [shopA + '/other.webp']), '42501');
  await rejectsCode(as('authenticated', owner, 'update storage.objects set name=$1 where name=$2', [shopB + '/test.webp', path]), '42501');
  assert.equal((await rows('authenticated', neighbor, 'select * from storage.objects')).length, 0);
});

test('회원 탈퇴: 본인 계정만 지우고, 딸린 기록은 함께 지우며 가게는 연결만 푼다', async () => {
  const leaver = 'a0000000-0000-4000-8000-000000000008';
  const admin = 'a0000000-0000-4000-8000-000000000009';
  const leaverShop = '10000000-0000-4000-8000-000000000006';
  await db.query("insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values ($1,null,now()),($2,null,now())", [leaver, admin]);
  await db.query("insert into public.stores(id,owner_id,sbiz_id,name,type_id,address,lat,lng,floor,building_id,is_published) values ($1,$2,'MA006','탈퇴 사장님 가게','korean','주소 6',37.62,127.06,1,'B3',true)", [leaverShop, leaver]);
  await as('authenticated', leaver, 'insert into public.store_favorites(user_id,store_id) values ($1,$2)', [leaver, shopA]);
  await db.query('insert into private.admin_users(user_id) values ($1)', [admin]);

  await rejectsCode(as('anon', null, 'select public.delete_my_account()'), '42501');
  await rejectsCode(as('authenticated', admin, 'select public.delete_my_account()'), '42501');
  assert.equal(await scalar('select count(*)::int from auth.users where id=$1', [admin]), 1);

  await as('authenticated', leaver, 'select public.delete_my_account()');
  assert.equal(await scalar('select count(*)::int from auth.users where id=$1', [leaver]), 0);
  assert.equal(await scalar('select count(*)::int from public.profiles where user_id=$1', [leaver]), 0);
  assert.equal(await scalar('select count(*)::int from public.store_favorites where user_id=$1', [leaver]), 0);
  assert.equal(await scalar('select owner_id from public.stores where id=$1', [leaverShop]), null);
  assert.equal(await scalar('select count(*)::int from auth.users where id=$1', [owner]), 1);
});
