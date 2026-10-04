import { useAuth } from '../../core/auth/AuthContext';

/** 기존 화면의 표시 이름은 실제 Auth 프로필에서 읽는다. */
export function useUserSession() {
  const { userName, logout } = useAuth();
  return { userName, logout };
}
