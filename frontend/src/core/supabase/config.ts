export interface SupabaseEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

/** 오류 메시지에는 환경변수 값이나 키를 포함하지 않는다. */
export function readSupabaseConfig(env: SupabaseEnv) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('Supabase URL과 Publishable key를 .env.local에 설정해 주세요.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Supabase Project URL 형식을 확인해 주세요.');
  }
  const localHttp = parsed.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !localHttp) || parsed.username ||
      parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('Supabase Project URL에는 프로젝트 주소만 입력해 주세요.');
  }

  // 이 프로젝트는 새 Publishable key를 사용한다. 관리자 키와 legacy JWT는 허용하지 않는다.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error('sb_publishable_로 시작하는 공개용 키를 사용해 주세요. Secret/service_role 키는 금지합니다.');
  }
  return { url: parsed.origin, key };
}
