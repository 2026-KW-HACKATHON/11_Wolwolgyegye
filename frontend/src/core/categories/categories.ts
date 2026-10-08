import type { Category, PanelMeta } from './categoryTypes';

/**
 * 카테고리 마스터 목록.
 * 네비게이션은 이 배열을 순회해서 그리므로, 항목이 늘거나 줄어도 레이아웃 코드는 바꾸지 않는다.
 * 규칙: 기존 필드는 바꾸지 않고 필요한 필드는 추가만 한다.
 */
export const CATEGORIES: Category[] = [
  {
    id: 'recommend',
    name: '동네 소식',
    path: '/recommend',
    icon: 'megaphone',
    sheetHalf: 0.6,
    panelHalf: 440,
  },
  {
    id: 'space-rental',
    name: '공간 대여',
    path: '/space-rental',
    icon: 'sofa',
    sheetHalf: 0.5,
    panelHalf: 420,
  },
  {
    id: 'oneday-class',
    name: '원데이클래스',
    path: '/oneday-class',
    icon: 'palette',
    sheetHalf: 0.5,
    panelHalf: 420,
  },
  {
    id: 'roulette',
    name: '룰렛',
    path: '/roulette',
    icon: 'wheel',
    sheetHalf: 0.8, // 반만 열어도 원판이 다 보이게
    panelHalf: 480,
  },
  {
    id: 'closing-sale',
    name: '마감세일',
    path: '/closing-sale',
    icon: 'tag',
    sheetHalf: 0.45,
    panelHalf: 380,
  },
  {
    id: 'coupon',
    name: '스탬프',
    path: '/coupon',
    icon: 'gift',
    sheetHalf: 0.55,
    panelHalf: 420,
  },
  {
    id: 'partner-stores',
    name: '제휴 가게',
    path: '/partner-stores',
    icon: 'ticket',
    sheetHalf: 0.6,
    panelHalf: 460,
  },
  {
    id: 'owner',
    name: '가게 관리',
    path: '/owner',
    icon: 'storefront',
    ownerOnly: true,
    sheetHalf: 0.85,
    panelHalf: 520,
  },
];

/**
 * 세로 화면(모바일·태블릿 세로) 하단 바에 남기는 카테고리 id. 이 순서대로 나열한다.
 * 나머지 카테고리와 유저 탭은 지도 왼쪽 위 전체 메뉴(세줄 버튼)에서 연다.
 */
export const PORTRAIT_BAR_IDS: string[] = ['recommend', 'coupon', 'partner-stores', 'roulette'];

/** 사장님 계정의 세로 화면 하단 바. 가게 관리(사장님 센터)와 유저(내 정보) 버튼을 함께 둔다 */
export const OWNER_PORTRAIT_BAR_IDS: string[] = ['recommend', 'coupon', 'owner'];

/**
 * 유저 및 설정 탭. 카테고리 바에 나열하지 않고 전용 유저 버튼으로만 연다.
 * 로그인 창이며 그 안에 설정이 함께 들어 있다.
 */
export const USER_PANEL: PanelMeta = {
  id: 'user',
  name: '내 정보',
  path: '/user',
  sheetHalf: 0.7,
  panelHalf: 400,
};

/** 1차 탭으로 열리는 전체 목록 (경로 매칭용) */
export const ALL_PANELS: PanelMeta[] = [...CATEGORIES, USER_PANEL];

export const DEFAULT_LANDING_PATH = '/recommend';
