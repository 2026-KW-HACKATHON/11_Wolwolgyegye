import { createContext } from 'react';
import type { AuthStatus } from './authTypes';

interface AuthContextValue {
  status: AuthStatus;
}

export const AuthContext = createContext<AuthContextValue>({ status: 'checking' });