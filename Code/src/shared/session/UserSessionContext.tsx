import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'wol_user_name';

function readStoredName(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

interface UserSessionValue {
  userName: string | null;
  login: (name: string) => void;
  logout: () => void;
}

const UserSessionContext = createContext<UserSessionValue>({
  userName: null,
  login: () => {},
  logout: () => {},
});

/**
 * 로그인한 사용자의 표시 이름을 들고 있는 가벼운 세션 저장소.
 * 실제 인증 서버가 붙기 전까지는 develop 브랜치의 auth.js 처럼 이름만 로컬에 저장해둔다.
 * (checking/guest/customer/owner 토큰 상태를 다루는 AuthContext 와는 별개)
 */
export function UserSessionProvider({ children }: { children: ReactNode }) {
  const [userName, setUserName] = useState<string | null>(() => readStoredName());

  const login = useCallback((name: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      /* localStorage 접근 불가 시에도 화면 상태는 그대로 반영 */
    }
    setUserName(name);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setUserName(null);
  }, []);

  const value = useMemo(() => ({ userName, login, logout }), [userName, login, logout]);

  return <UserSessionContext.Provider value={value}>{children}</UserSessionContext.Provider>;
}

export function useUserSession(): UserSessionValue {
  return useContext(UserSessionContext);
}