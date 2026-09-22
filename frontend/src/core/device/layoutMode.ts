/**
 * 기기 판별 규칙 (한 곳에서만 관리)
 *
 * 1단계: 입력 장치로 "터치 기기 vs PC" 를 먼저 가른다.
 *        - 주 입력이 터치(hover 없음 + 거친 포인터) -> 터치 기기(모바일/태블릿)
 *        - 그 외(마우스 등)                         -> PC
 * 2단계: 각 그룹 안에서 크기/방향으로 세분화한다.
 *        - PC   : 창 너비가 desktopMinWidth 미만이면 compact (PC에서 창을 줄여 확인할 수 있게 하는 대체 규칙)
 *        - 터치 : 화면 짧은 변이 phoneMaxShortSide 미만이고 가로 방향이면 compact-landscape (스마트폰 가로)
 *                 그 외(스마트폰 세로, 태블릿 세로/가로)는 compact
 */

export type LayoutMode = 'compact' | 'compact-landscape' | 'desktop';

export const DEVICE_RULES = {
  /** PC(마우스) 환경에서 이 너비 이상이면 desktop 배치 */
  desktopMinWidth: 768,
  /** 화면 짧은 변이 이 값 미만이면 스마트폰, 이상이면 태블릿 (CSS px) */
  phoneMaxShortSide: 600,
} as const;

export const TOUCH_PRIMARY_QUERY = '(hover: none) and (pointer: coarse)';

export function isTouchPrimary(): boolean {
  return window.matchMedia(TOUCH_PRIMARY_QUERY).matches;
}

export function detectLayoutMode(): LayoutMode {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // 1단계: PC vs 터치 기기
  if (!isTouchPrimary()) {
    return width >= DEVICE_RULES.desktopMinWidth ? 'desktop' : 'compact';
  }

  // 2단계: 터치 기기 안에서 스마트폰 vs 태블릿 (창 크기가 아닌 실제 화면 크기 기준)
  const shortSide = Math.min(window.screen.width, window.screen.height);
  const isPhone = shortSide < DEVICE_RULES.phoneMaxShortSide;
  const isLandscape = width > height;

  return isPhone && isLandscape ? 'compact-landscape' : 'compact';
}