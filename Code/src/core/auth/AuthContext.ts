import { createContext } from 'react';
import type { AuthStatus } from './authTypes';

export interface AuthContextValue {
  status: AuthStatus;
}

export const AuthContext = createContext<AuthContextValue>({ status: 'checking' });