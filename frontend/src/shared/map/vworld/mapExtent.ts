/**
 * 지도 범위 규칙. scripts/fetch-vworld.js 의 "조회 범위" 와 같은 규칙·같은 값을 쓴다. (한쪽을 바꾸면 다른 쪽도 바꿀 것)
 *
 * - 월계1동(행정동)을 감싸는 직사각형(회전 없음, 세로로 긴 모양)의 세로를 H 라고 할 때
 *   지도 전체 범위 = 세로 1.2H (위아래 0.1H 씩 여유) × 가로 1.25H, 직사각형 가운데 기준.
 * - 가장 많이 축소했을 때 화면 세로에 보이는 범위 (MIN_ZOOM_HEIGHT_RATIO)
 *     PC·태블릿 가로·모바일 가로: H 의 0.5배 (PC 가로:세로 = 2.5:1 이면 가로 1.25H 가 보인다)
 *     세로 화면(모바일·태블릿 세로): 지도 영역 세로 px 에 따라 PORTRAIT_MIN_ZOOM_STEPS 로 정한다 (작은 화면일수록 더 축소)
 *   1차 탭이 열려 있는지와는 관계없이 지도 영역 전체 기준이다.
 * - 범위 끝에서는 더 끌리지 않고 멈춘다. 수집 데이터는 이 범위보다 사방으로 300m 더 넓다.
 *   (확대·축소나 관성 이동 중 범위 끝을 잠깐 넘어가도 빈 바탕이 보이지 않게)
 * - 좌표는 위도(lat)·경도(lng) 도 단위.
 */

/** 센서스 행정동 경계(lt_c_cademd, adm_cd 11110510, 기준일 20240630)의 꼭짓점 최소·최대 */
export const WOLGYE1_RECT = { south: 37.61426899, west: 127.04973988, north: 37.6301994, east: 127.06596365 } as const;

const MAP_WIDTH_PER_HEIGHT = 1.25;
/** 지도 범위 세로 = 직사각형 세로 H 의 이 배수 (위아래로 0.1H 씩 여유) */
export const MAP_HEIGHT_PER_RECT = 1.2;
const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LNG = 111320 * Math.cos((((WOLGYE1_RECT.south + WOLGYE1_RECT.north) / 2) * Math.PI) / 180);

const halfWidthDeg = ((WOLGYE1_RECT.north - WOLGYE1_RECT.south) * M_PER_DEG_LAT * MAP_WIDTH_PER_HEIGHT) / 2 / M_PER_DEG_LNG;
const centerLng = (WOLGYE1_RECT.west + WOLGYE1_RECT.east) / 2;
const verticalPadDeg = ((WOLGYE1_RECT.north - WOLGYE1_RECT.south) * (MAP_HEIGHT_PER_RECT - 1)) / 2;

/** 지도 전체 범위 (이 밖으로는 이동할 수 없다) */
export const MAP_EXTENT = {
  south: WOLGYE1_RECT.south - verticalPadDeg,
  north: WOLGYE1_RECT.north + verticalPadDeg,
  west: centerLng - halfWidthDeg,
  east: centerLng + halfWidthDeg,
} as const;

/** 지도 중심 = 월계1동 직사각형 가운데 */
export const MAP_CENTER = { lat: (WOLGYE1_RECT.south + WOLGYE1_RECT.north) / 2, lng: centerLng } as const;

/** 월계1동 직사각형의 세로 H (도) */
export const WOLGYE1_LAT_SPAN = WOLGYE1_RECT.north - WOLGYE1_RECT.south;

/** 가로 화면(PC·태블릿 가로·모바일 가로): 가장 많이 축소했을 때 화면 세로에 보이는 범위 (H 대비 비율) */
export const LANDSCAPE_MIN_ZOOM_HEIGHT_RATIO = 0.5;

/**
 * 세로 화면: 지도 영역 세로(px)별로 가장 많이 축소했을 때 화면 세로에 보이는 범위 (H 대비 비율).
 * 기준점 사이 크기는 직선으로 이어(보간) 화면 크기에 따라 자연스럽게 바뀐다. 첫 기준점보다 작거나
 * 마지막 기준점보다 크면 양 끝 값을 쓴다. 비율은 MAP_HEIGHT_PER_RECT(1.2) 를 넘을 수 없다 (지도 범위 세로).
 * 조절하려면 이 표만 고치면 된다. (heightPx 오름차순)
 */
const PORTRAIT_MIN_ZOOM_STEPS = [
  { heightPx: 640, ratio: 0.95 }, // 작은 폰: 월계1동이 거의 한눈에 보이게
  { heightPx: 1100, ratio: 0.8 }, // 태블릿 세로
] as const;

/** 세로 화면에서 지도 영역 세로 heightPx 일 때의 비율 (PORTRAIT_MIN_ZOOM_STEPS 보간) */
export function portraitMinZoomHeightRatio(heightPx: number): number {
  const steps = PORTRAIT_MIN_ZOOM_STEPS;
  if (heightPx <= steps[0].heightPx) return steps[0].ratio;
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1];
    const b = steps[i];
    if (heightPx <= b.heightPx) return a.ratio + ((heightPx - a.heightPx) / (b.heightPx - a.heightPx)) * (b.ratio - a.ratio);
  }
  return steps[steps.length - 1].ratio;
}
