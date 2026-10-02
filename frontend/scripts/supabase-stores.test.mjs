import test from 'node:test';
import assert from 'node:assert/strict';
import { toStore } from '../src/core/supabase/storeMapper.ts';

test('공개 가게 행을 지도 공통 규격으로 변환한다', () => {
  const store = toStore({
    id: '592edcaa-4052-815a-fec1-42ee0868fb7d',
    name: '빠말Pasmal',
    cuisine_type: '베이커리',
    address: '서울특별시 노원구 광운로 7',
    lat: 37.6185652024719,
    lng: 127.05729143817,
    phone: '',
    business_hours: '',
    thumbnail_path: null,
    supported_features: ['space-rental', 'unknown-feature'],
  });
  assert.equal(store.name, '빠말Pasmal');
  assert.deepEqual(store.location, { lat: 37.6185652024719, lng: 127.05729143817 });
  assert.equal(store.supports['space-rental'], true);
  assert.equal(store.supports['oneday-class'], undefined);
  assert.equal(store.phone, '');
  assert.equal(store.thumbnailUrl, '');
});
