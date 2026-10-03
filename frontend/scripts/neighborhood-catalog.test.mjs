import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toStore } from '../src/core/supabase/storeMapper.ts';
import { STORE_CATEGORIES, storeCategory } from '../src/core/utils/storeCategories.ts';
import { mergeNeighborhoodStores } from '../src/core/utils/neighborhoodCatalog.ts';

const catalog = JSON.parse(await readFile(new URL('../public/data/wolgye1-candidates.json', import.meta.url), 'utf8'));

test('공공데이터 목록 851곳의 ID·위치·업종 분류가 준비돼 있다', () => {
  assert.equal(catalog.as_of, '2026-06-30');
  assert.equal(catalog.stores.length, 851);
  assert.equal(new Set(catalog.stores.map(({ id }) => id)).size, 851);
  const stores = catalog.stores.map(toStore);
  for (const category of STORE_CATEGORIES.filter(({ key }) => key !== 'all')) {
    assert.ok(stores.some((store) => storeCategory(store.cuisineType) === category.key), `${category.label} 분류에 가게가 없습니다.`);
  }
});

test('같은 가게의 공개된 Supabase 정보가 공공데이터 스냅샷보다 우선한다', () => {
  const candidate = toStore(catalog.stores.find(({ name }) => name === '빠말Pasmal'));
  const published = { ...candidate, cuisineType: '베이커리', phone: '02-000-0000' };
  const merged = mergeNeighborhoodStores([candidate], [published]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].cuisineType, '베이커리');
  assert.equal(merged[0].phone, '02-000-0000');
});
