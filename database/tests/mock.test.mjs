// 예시 데이터(mock/seed_mock.sql)를 메모리 PostgreSQL(PGlite)에서 넣고 지워 본다.
import { PGlite } from '@electric-sql/pglite';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const db = new PGlite();
const sqlFile = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const count = async (query) => Number(Object.values((await db.query(query)).rows[0])[0]);
const realStore = '10000000-0000-4000-8000-000000000001';

before(async () => {
  await db.exec(await sqlFile('./bootstrap.sql'));
  const folder = new URL('../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(folder)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(name, folder), 'utf8'));
  }
  // 실제 DB 에서는 npm run import:stores 가 넣는 대표 유형과 실제 가게 (여기서는 필요한 것만)
  const types = ['korean', 'snack', 'chinese', 'japanese', 'chicken', 'western', 'cafe', 'bakery', 'convenience', 'etc-시설관리·임대', 'etc-예술·스포츠', 'etc-교육'];
  for (const id of types) await db.query("insert into public.store_types(id,name,group_name) values ($1,$1,'etc')", [id]);
  await db.query("insert into public.stores(id,sbiz_id,name,address,lat,lng) values ($1,'MA1','실제 가게','주소',37.62,127.06)", [realStore]);
});
after(async () => { await db.close(); });

test('예시 데이터가 카테고리마다 10개 이상 들어간다', async () => {
  const seed = await sqlFile('../mock/seed_mock.sql');
  await db.exec(seed);
  const row = (await db.query(`select
    (select count(*) from public.stores where is_mock) as stores,
    (select count(*) from public.store_menus m join public.stores s on s.id = m.store_id where s.is_mock) as menus,
    (select count(*) from public.store_hours h join public.stores s on s.id = h.store_id where s.is_mock) as hours,
    (select count(*) from public.closing_sales c join public.stores s on s.id = c.store_id where s.is_mock) as closing_sales,
    (select count(*) from public.partner_benefits b join public.stores s on s.id = b.store_id where s.is_mock) as benefits,
    (select count(*) from public.space_rentals r join public.stores s on s.id = r.store_id where s.is_mock) as space_rentals,
    (select count(*) from public.one_day_classes k join public.stores s on s.id = k.store_id where s.is_mock) as classes,
    (select count(*) from public.stamp_policies p join public.stores s on s.id = p.store_id where s.is_mock) as stamps`)).rows[0];
  assert.deepEqual(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)])), {
    stores: 14, menus: 40, hours: 98, closing_sales: 12, benefits: 12, space_rentals: 12, classes: 12, stamps: 10,
  });
  assert.ok(await count('select count(*) from public.benefit_partners') >= 12);
  assert.equal(await count("select count(*) from public.closing_sales where discount_type='free'"), 4);
});

test('다시 실행해도 두 번 쌓이지 않는다', async () => {
  await db.exec(await sqlFile('../mock/seed_mock.sql'));
  assert.equal(await count('select count(*) from public.stores where is_mock'), 14);
  assert.equal(await count('select count(*) from public.space_rentals'), 12);
  assert.equal(await count('select count(*) from public.partners'), 8);
});

test('한 줄로 지우면 예시 데이터만 사라지고 실제 가게·기준 목록은 남는다', async () => {
  await db.exec('delete from public.stores where is_mock');
  for (const table of ['store_menus', 'store_hours', 'closing_sales', 'partner_benefits', 'benefit_partners', 'space_rentals', 'one_day_classes', 'stamp_policies']) {
    assert.equal(await count(`select count(*) from public.${table}`), 0, table);
  }
  assert.equal(await count('select count(*) from public.stores'), 1);
  assert.equal(await count('select count(*) from public.partners'), 8);
  assert.equal(await count('select count(*) from public.space_rental_categories'), 3);
});

test('예시 가게는 사장님 승인 대상이 될 수 없다', async () => {
  await db.exec(await sqlFile('../mock/seed_mock.sql'));
  const user = 'a0000000-0000-4000-8000-000000000009';
  await db.query("insert into auth.users(id,email_confirmed_at) values ($1,now())", [user]);
  await db.query("insert into auth.identities(user_id,provider) values ($1,'email')", [user]);
  const app = (await db.query("insert into public.owner_applications(user_id,applicant_name,contact_phone,store_name,store_address) values ($1,'신청','000-0000-0000','가게','주소') returning id", [user])).rows[0].id;
  await assert.rejects(db.query("select public.review_owner_application($1,'approved','eeeeeeee-0000-4000-8000-000000000001')", [app]), (e) => e.code === '22023');
  await db.query("select public.review_owner_application($1,'approved',$2)", [app, realStore]);
});
