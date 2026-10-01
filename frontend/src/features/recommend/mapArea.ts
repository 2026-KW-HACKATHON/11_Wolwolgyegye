/** 탐색 시작점. 행정동 경계나 사용자의 GPS 위치를 의미하지 않는다. */
export const WOLGYE_MAP = {
  center: { lat: 37.6195, lng: 127.0595 },
  defaultLevel: 4,
  minLevel: 2,
  maxLevel: 5,
  returnHintMeters: 1500,
} as const;

// 카카오 지도는 level이 작을수록 확대된다.
export function clampMapLevel(level: number): number {
  return Math.min(WOLGYE_MAP.maxLevel, Math.max(WOLGYE_MAP.minLevel, level));
}
