import test from 'node:test';
import assert from 'node:assert/strict';
import { readSupabaseConfig } from '../src/core/supabase/config.ts';

const valid = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only' };
test('공개용 키와 프로젝트 주소 정규화', () => {
  assert.deepEqual(readSupabaseConfig({ ...valid, VITE_SUPABASE_URL: ` ${valid.VITE_SUPABASE_URL}/ ` }), {
    url: valid.VITE_SUPABASE_URL, key: valid.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
});
test('누락된 설정 거부', () => {
  assert.throws(() => readSupabaseConfig({}));
  assert.throws(() => readSupabaseConfig({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }));
});
test('관리자 키와 JWT를 거부하고 오류에 키를 노출하지 않음', () => {
  for (const key of ['sb_secret_sensitive-test', 'eyJhbGciOiJIUzI1NiJ9.test.signature']) {
    assert.throws(() => readSupabaseConfig({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: key }), error =>
      !error.message.includes(key));
  }
  assert.throws(() => readSupabaseConfig({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: 'service_role' }));
});
test('연결 문자열·잘못된 URL·비보안 원격 주소 거부', () => {
  for (const url of ['not-a-url', 'postgresql://user:password@host/db', 'http://example.com',
    'https://user:password@example.com', 'https://example.com/rest/v1', 'https://example.com?key=value']) {
    assert.throws(() => readSupabaseConfig({ ...valid, VITE_SUPABASE_URL: url }));
  }
});
test('로컬 Supabase 주소 허용', () => {
  assert.equal(readSupabaseConfig({ ...valid, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' }).url, 'http://127.0.0.1:54321');
});
