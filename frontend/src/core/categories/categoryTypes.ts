import type { IconName } from '../../shared/icons';

/** 화면(경로)을 가진 모든 항목의 최소 공통 정보 */
interface PageMeta {
  id: string;
  name: string;
  path: string;
}

/**
 * 지도 위에 올라오는 1차 탭(스와이프 탭) 정보.
 * 탭은 닫힘(바에 붙음) / 반쯤 열림 / 전체 3단계이며, 반쯤 열린 크기는 정보량에 따라 카테고리마다 다르다.
 */
export interface PanelMeta extends PageMeta {
  /** 세로 화면: 반쯤 열렸을 때 높이 (지도 영역 높이 대비 비율, 0 ~ 1) */
  sheetHalf: number;
  /** 가로 화면: 반쯤 열렸을 때 폭 (px). 화면이 좁으면 자동으로 줄어든다 */
  panelHalf: number;
}

/** 카테고리 네비게이션 바에 나열되는 카테고리 */
export interface Category extends PanelMeta {
  icon: IconName;
  /** true 면 사용자가 끌 수 없이 항상 노출 */
  isFixed: boolean;
  /** true 면 사장님 계정(가게를 가진 사용자)에게만 보인다 */
  ownerOnly?: boolean;
}
