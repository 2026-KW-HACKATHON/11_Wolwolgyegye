/**
 * 기기 판별 규칙 (한 곳에서만 관리) — 로딩 순서도 기준
 *
 * 1단계: PC 여부를 먼저 가른다. (주 입력이 터치가 아니면 PC)
 *        - PC -> wide
 *          단, 창 너비가 pcMinWidth 미만이면 portrait (PC 에서 창을 줄여 모바일 화면을 확인하기 위한 대체 규칙)
 * 2단계: 터치 기기는 화면의 짧은 변(세로로 들었을 때의 가로 길이)으로 모바일 / 태블릿을 가른다.
 *        - 모바일 약 360 ~ 440px, 태블릿 약 740 ~ 1030px -> 그 사이 값(tabletMinShortSide)을 경계로 쓴다.
 * 3단계: 세로 / 가로 방향으로 나눈다. 창 크기가 아니라 기기 방향으로 본다
 *        (모바일에서 키보드가 올라오면 창 높이가 줄어 폭보다 작아지는데, 이때 가로 화면으로 바뀌면 안 된다)
 *        - 모바일 가로              -> mobile-landscape
 *        - 모바일 세로 + 태블릿 세로 -> portrait
 *        - 태블릿 가로 (+ PC)        -> wide
 *
 * 가로:세로 비는 극단적인 경우 1:2.5 (역도 성립) 까지를 가정한다.
 */

export type LayoutMode = 'portrait' | 'mobile-landscape' | 'wide';

const DEVICE_RULES = {
  /** PC(마우스) 환경에서 창 너비가 이 값 미만이면 portrait 배치로 확인 */
  pcMinWidth: 768,
  /** 화면 짧은 변이 이 값 이상이면 태블릿, 미만이면 모바일 (CSS px) */
  tabletMinShortSide: 600,
} as const;

export const TOUCH_PRIMARY_QUERY = '(hover: none) and (pointer: coarse)';

function isTouchPrimary(): boolean {
  return window.matchMedia(TOUCH_PRIMARY_QUERY).matches;
}

/** 기기를 가로로 들었는지. 키보드로 창 높이가 줄어도 바뀌지 않는다 */
function isDeviceLandscape(width: number, height: number): boolean {
  const type = window.screen.orientation?.type;
  if (type) return type.startsWith('landscape');
  // 예전 iOS Safari 는 screen.orientation 이 없어서 window.orientation(0 / ±90 / 180)을 쓴다
  const angle = (window as Window & { orientation?: number }).orientation;
  if (typeof angle === 'number') return Math.abs(angle) === 90;
  return width > height;
}

export function detectLayoutMode(): LayoutMode {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // 1단계: PC
  if (!isTouchPrimary()) {
    return width >= DEVICE_RULES.pcMinWidth ? 'wide' : 'portrait';
  }

  // 2단계: 모바일 vs 태블릿 (창 크기가 아닌 실제 화면 크기 기준)
  const shortSide = Math.min(window.screen.width, window.screen.height);
  const isTablet = shortSide >= DEVICE_RULES.tabletMinShortSide;

  // 3단계: 세로 vs 가로
  const isLandscape = isDeviceLandscape(width, height);
  if (!isLandscape) return 'portrait';
  return isTablet ? 'wide' : 'mobile-landscape';
}

/** 1차 탭이 펼쳐지는 방향: 세로 화면은 아래에서 위로(y), 가로 화면은 오른쪽에서 왼쪽으로(x) */
export function panelAxis(mode: LayoutMode): 'x' | 'y' {
  return mode === 'portrait' ? 'y' : 'x';
}
