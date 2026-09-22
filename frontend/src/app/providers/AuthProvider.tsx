import { useEffect, useState, type ReactNode } from 'react';
import { AuthContext } from '../../core/auth/AuthContext';
import type { AuthStatus } from '../../core/auth/authTypes';

/** 스플래시가 보이는 시간(ms). 실제 토큰 검증이 붙으면 검증이 끝날 때까지로 대체 */
const FAKE_CHECK_MS = 900;

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking');

  useEffect(() => {
    // TODO(Supabase Auth): 저장된 토큰을 서버에서 검증하고 결과(guest/customer/owner)를 setStatus 로 반영
    // 이번 라운드는 검증 대신 짧게 기다린 뒤 "비로그인"으로 고정한다.
    const timer = window.setTimeout(() => setStatus('guest'), FAKE_CHECK_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return <AuthContext.Provider value={{ status }}>{children}</AuthContext.Provider>;
}