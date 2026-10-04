import { createContext, useContext } from 'react';
import type { PanelState } from '../SwipePanel/SwipePanel';

/** 카테고리 화면(1차 탭 내용)에서 지도·탭을 조작할 때 쓰는 기능 */
export interface ShellApi {
  /** 가게를 지도에서 선택하고 보이게 한다 (2차 탭 자리 열림). 세로 화면에서는 1차 탭을 접어 지도를 보여준다 */
  showStoreOnMap: (storeId: string) => void;
  /** 지금 열린 1차 탭의 상태를 바꾼다 (예: 'closed' = 지도 크게 보기) */
  setActivePanelState: (state: PanelState) => void;
}

export const ShellContext = createContext<ShellApi>({
  showStoreOnMap: () => {},
  setActivePanelState: () => {},
});

export function useShell(): ShellApi {
  return useContext(ShellContext);
}
