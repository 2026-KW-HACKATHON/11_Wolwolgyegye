import { useContext } from 'react';
import { AuthContext } from './AuthContext';
import type { AuthStatus } from './authTypes';

/** 현재 계정 상태를 읽는 훅 */
export function useAuthStatus(): AuthStatus {
  return useContext(AuthContext).status;
}