import test from 'node:test';
import assert from 'node:assert/strict';
import { STORE_CATEGORIES, storeCategory } from '../src/core/utils/storeCategories.ts';

test('업종 필터의 대표 가게가 서로 다른 주민용 분류로 들어간다', () => {
  assert.equal(storeCategory('백반/한정식'), 'food');
  assert.equal(storeCategory('베이커리'), 'cafe');
  assert.equal(storeCategory('카페'), 'cafe');
  assert.equal(storeCategory('독서실/스터디 카페'), 'learning');
  assert.equal(storeCategory('편의점'), 'shopping');
  assert.equal(storeCategory('약국'), 'health');
  assert.equal(storeCategory('미용실'), 'health');
  assert.equal(storeCategory('입시·교과학원'), 'learning');
  assert.equal(storeCategory('부동산 중개/대리업'), 'services');
  assert.equal(storeCategory(undefined), 'services');
});

test('전체 이외 지도 분류는 중복 없이 준비된다', () => {
  const keys = STORE_CATEGORIES.map(({ key }) => key);
  assert.equal(keys[0], 'all');
  assert.equal(keys.length, new Set(keys).size);
});
