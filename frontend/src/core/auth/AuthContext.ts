import { createContext, useContext } from 'react';
import type { AuthStatus } from './authTypes';

export interface OwnerApplication {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string;
  store_name: string;
}

export interface AuthContextValue {
  status: AuthStatus;
  userId: string | null;
  userName: string | null;
  email: string | null;
  hasEmailLogin: boolean;
  emailVerified: boolean;
  isAdmin: boolean;
  passwordRecovery: boolean;
  finishPasswordRecovery: () => void;
  ownedStores: { id: string; name: string }[];
  ownerApplication: OwnerApplication | null;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  status: 'checking', userId: null, userName: null, email: null,
  hasEmailLogin: false, emailVerified: false, isAdmin: false, passwordRecovery: false,
  ownedStores: [], ownerApplication: null, error: null,
  refresh: async () => {}, logout: async () => {}, finishPasswordRecovery: () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
