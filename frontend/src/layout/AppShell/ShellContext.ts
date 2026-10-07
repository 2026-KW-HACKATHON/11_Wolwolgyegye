import { createContext, useContext } from 'react';
import type { Store } from '../../core/types/place';
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
  /** 가게를 지도에서 선택하고 2차 탭을 연다 (1차 탭은 지도를 가리지 않게 접는다). focus 가 있으면 그 카테고리(항목)가 맨 위에 오도록 스크롤한다 */
  openStore: (storeId: string, focus?: SecondaryFocus) => void;
  /** 지금 열린 1차 탭의 상태를 바꾼다 (예: 'closed' = 지도 크게 보기) */
  setActivePanelState: (state: PanelState) => void;
  /**
   * 현재 카테고리에서 지도에 표시할 가게 id를 제한한다. null이면 카테고리 전체를 표시한다.
   * stores 를 같이 넘기면 카테고리 가게 목록에 없는 가게도 그 정보로 핀을 찍는다 (예: 룰렛 추천 가게)
   */
  setMapStoreIds: (storeIds: string[] | null, stores?: Store[]) => void;
}

export const ShellContext = createContext<ShellApi>({
  openStore: () => {},
  setActivePanelState: () => {},
  setMapStoreIds: () => {},
});

export function useShell(): ShellApi {
  return useContext(ShellContext);
}
