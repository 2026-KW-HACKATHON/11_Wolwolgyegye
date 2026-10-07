import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { readSupabaseConfig } from '../src/core/supabase/config.ts';

// Node.js 24 사용. 인증 토큰·키·가게 내용은 출력하지 않고 SELECT만 수행한다.
try {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const env = { ...loadEnv('development', root, 'VITE_SUPABASE_'), ...process.env };
  const { url, key } = readSupabaseConfig(env);
  let networkCode;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (...args) => {
        try {
          return await fetch(...args);
        } catch (error) {
          networkCode = error.cause?.code;
          throw error;
        }
      },
    },
  });
  const { count, error, status } = await client.from('stores')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true)
    .abortSignal(AbortSignal.timeout(15000));
  if (error) {
    // 오류 원문에는 연결 정보가 포함될 수 있으므로 상태 코드만 표시한다.
    if (networkCode === 'ENOTFOUND') {
      console.error('프로젝트 주소 DNS 조회 실패. 대시보드에서 Project URL을 다시 복사해 VITE_SUPABASE_URL을 확인해 주세요.');
    } else {
      console.error(`Supabase 조회 실패 (HTTP ${status}). URL·공개용 키·네트워크·stores 조회 권한을 확인해 주세요.`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Supabase 읽기 연결 성공 (HTTP ${status}). 비로그인 사용자에게 공개된 가게: ${count ?? '확인 불가'}개.`);
    console.log('0개여도 연결 실패는 아닙니다. 미등록 또는 비공개 데이터는 표시되지 않습니다.');
    console.log('등록·수정·삭제는 수행하지 않았습니다. 로그인·업로드·전체 RLS 검증은 별도입니다.');
  }
} catch {
  console.error('연결 검사를 완료하지 못했습니다. 환경변수 형식·Node.js 버전·네트워크를 확인해 주세요. 키 값은 출력하지 않습니다.');
  process.exitCode = 1;
}
