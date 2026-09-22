import { createContext, useContext } from 'react';
import type { LayoutMode } from './layoutMode';

export const LayoutModeContext = createContext<LayoutMode>('compact');

/** 어느 컴포넌트에서든 현재 기기 모드를 읽는 훅 */
export function useLayoutMode(): LayoutMode {
  return useContext(LayoutModeContext);
}