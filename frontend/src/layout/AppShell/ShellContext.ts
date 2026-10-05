import { createContext, useContext } from 'react';
import type { PanelState } from '../SwipePanel/SwipePanel';

/**
 * 2차 탭을 열 때 처음 보여줄 곳.
 * category: 2차 탭의 카테고리 묶음 id (space-rental · oneday-class · closing-sale · partner-stores)
 * target: 그 묶음 안의 항목 (예: post-<글 id>, sale-<세일 id>). 없으면 묶음 맨 위
 */
export interface SecondaryFocus {
  category: string;
  target?: string;
}

/** 카테고리 화면(1차 탭 내용)에서 지도·탭을 조작할 때 쓰는 기능 */
export interface ShellApi {
  /** 가게를 지도에서 선택하고 보이게 한다 (2차 탭 열림). 세로 화면에서는 1차 탭을 접어 지도를 보여준다 */
  showStoreOnMap: (storeId: string) => void;
  /** 가게의 2차 탭을 열고, focus 가 있으면 그 카테고리(항목)가 맨 위에 오도록 스크롤한다 */
  openStore: (storeId: string, focus?: SecondaryFocus) => void;
  /** 지금 열린 1차 탭의 상태를 바꾼다 (예: 'closed' = 지도 크게 보기) */
  setActivePanelState: (state: PanelState) => void;
}

export const ShellContext = createContext<ShellApi>({
  showStoreOnMap: () => {},
  openStore: () => {},
  setActivePanelState: () => {},
});

export function useShell(): ShellApi {
  return useContext(ShellContext);
}
