import type { GeoPoint } from '../types/place';

/** 성인 평균 도보 속도 (m/분). 약 시속 4.8km */
const WALK_METERS_PER_MINUTE = 80;

/** 두 좌표 사이의 직선 거리(m). 하버사인 공식 */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * 직선 거리 기준 도보 시간(분). 실제 길찾기 경로가 아니라 대략값이며, 최소 1분.
 * 지도 연동(5단계)에서 실제 경로 시간으로 바꿀 수 있다.
 */
export function walkMinutes(from: GeoPoint, to: GeoPoint): number {
  return Math.max(1, Math.round(distanceMeters(from, to) / WALK_METERS_PER_MINUTE));
}
