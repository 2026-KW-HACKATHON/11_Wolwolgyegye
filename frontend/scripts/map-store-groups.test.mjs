import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupMapStores } from '../src/features/recommend/mapStoreGroups.ts';

test('같은 주소의 김가네와 다른 점포는 한 핀의 목록으로 묶인다', () => {
  const catalog = JSON.parse(readFileSync(new URL('../public/data/wolgye1-candidates.json', import.meta.url), 'utf8'));
  const stores = catalog.stores.map((row) => ({
    id: row.id, name: row.name, address: row.address,
    location: { lat: row.lat, lng: row.lng },
  }));
  const groups = groupMapStores(stores);
  const campus = groups.find((group) => group.address === '서울특별시 노원구 광운로 20');
  const nearCampus = groups.find((group) => group.address === '서울특별시 노원구 광운로 33');
  assert.ok(campus);
  assert.equal(campus.stores.length, 20);
  assert.ok(campus.stores.some((store) => store.name === '김가네'));
  assert.ok(nearCampus?.stores.some((store) => store.name === '김밥천국'));
  assert.ok(groups.length < stores.length);
});

test('주소가 비어 있으면 서로 다른 가게를 잘못 합치지 않는다', () => {
  const groups = groupMapStores([
    { id: 'a', name: '가게 A', address: '', location: { lat: 37, lng: 127 } },
    { id: 'b', name: '가게 B', address: '', location: { lat: 37, lng: 127 } },
  ]);
  assert.equal(groups.length, 2);
});
