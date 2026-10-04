import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
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

/** 도형의 대표점: 첫 외곽 링 꼭짓점들의 평균 (건물처럼 작고 볼록한 도형은 거의 항상 자기 안에 들어온다) */
function representativePoint(geometry: Geometry | null): Position | null {
  const ring = polygonsOf(geometry)[0]?.[0];
  if (!ring || ring.length < 2) return null;
  const pts = ring.slice(0, -1);
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

type Box = [number, number, number, number]; // 서, 남, 동, 북
function boxOf(geometry: Geometry | null): Box | null {
  const pts = polygonsOf(geometry).flat(2);
  if (!pts.length) return null;
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
}
const boxesTouch = (a: Box, b: Box) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/**
 * features 중에서 others 의 어느 도형과도 겹치지 않는 것만 남긴다.
 * "겹친다" = 한쪽의 대표점이 다른 쪽 안에 있다. (같은 건물이 두 데이터에 조금씩 다른 모양으로 들어 있는 경우를 잡는다)
 */
export function withoutOverlaps(features: Feature[], others: Feature[]): Feature[] {
  const targets = others
    .map((f) => ({ geometry: f.geometry, box: boxOf(f.geometry), point: representativePoint(f.geometry) }))
    .filter((t): t is { geometry: Geometry; box: Box; point: Position | null } => t.box !== null);
  return features.filter((f) => {
    const box = boxOf(f.geometry);
    if (!box) return true;
    const point = representativePoint(f.geometry);
    return !targets.some((t) => boxesTouch(box, t.box)
      && ((point !== null && inPolygon(point, t.geometry)) || (t.point !== null && inPolygon(t.point, f.geometry))));
  });
}
