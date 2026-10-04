import type { FeatureCollection, Geometry, Position } from 'geojson';
import { WOLGYE1_RECT } from './mapExtent';

/** Polygon / MultiPolygon 을 [폴리곤[링[좌표]]] 형태로 통일 (좌표는 [경도, 위도]) */
const polygonsOf = (g: Geometry | null): Position[][][] =>
  g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];

/** 점이 링 안에 있는지 (ray casting). 점과 링 모두 [경도, 위도] 순서 */
function inRing([x, y]: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 점이 (Multi)Polygon 안에 있는지. 구멍(두 번째 링부터) 안이면 밖으로 본다 */
function inPolygon(point: Position, geometry: Geometry | null): boolean {
  return polygonsOf(geometry).some(([outer, ...holes]) => inRing(point, outer) && !holes.some((h) => inRing(point, h)));
}

/**
 * 월계1동(행정동) 안의 점인지. 가게 핀·가게 정보는 월계1동 안쪽만 쓴다.
 * 행정동 경계 파일이 있으면 그 폴리곤으로, 없으면 월계1동을 감싸는 직사각형으로 판단한다.
 */
export function isInWolgye1(lat: number, lng: number, adminDong: FeatureCollection | null): boolean {
  if (adminDong?.features.length) return adminDong.features.some((f) => inPolygon([lng, lat], f.geometry));
  return lat >= WOLGYE1_RECT.south && lat <= WOLGYE1_RECT.north && lng >= WOLGYE1_RECT.west && lng <= WOLGYE1_RECT.east;
}
