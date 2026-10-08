// ---------------------------------------------------------------------
// 광운대학교 건물 이름 라벨.
// 브이월드 건물 데이터의 이름(buld_nm_dc)은 비어 있거나 예전 이름이라(예: 80주년기념관 → "광운학술정보관",
// 새빛관 → "중앙도서관"), 건물관리번호(bd_mgt_sn)로 건물을 찾아 지금 부르는 이름을 붙인다.
// 라벨 위치는 그 건물에서 가장 큰 동의 무게중심. 확대했을 때만 보인다 (LABEL_MIN_ZOOM).
// ---------------------------------------------------------------------
import type { FeatureCollection, Position } from 'geojson';

/**
 * 건물관리번호 → 화면에 쓸 이름. at 이 있으면 계산한 무게중심 대신 그 자리에 쓴다
 * (80주년기념관·비마관: 무게중심이 건물 한쪽으로 치우쳐 보여서 건물 가운데로,
 *  옥의관: 데이터 외곽선의 무게중심이 비마관 동쪽으로 잡혀서, 실제 건물인 비마관 서남쪽 긴 건물 위로 직접 지정)
 */
const CAMPUS_BUILDINGS: { id: string; name: string; at?: [number, number] }[] = [
  { id: '1135010200104470001019231', name: '화도관' },
  { id: '1135010200104470001019798', name: '80주년기념관', at: [37.620149, 127.058815] },
  { id: '1135010200104470001019286', name: '비마관', at: [37.61954, 127.059932] },
  { id: '1135010200104470001019283', name: '새빛관' },
  { id: '1135010200104470001019797', name: '참빛관' },
  { id: '1135010200104470001019117', name: '복지관' },
  { id: '1135010200104470001019331', name: '옥의관', at: [37.618837, 127.059073] },
  // 동해문화예술관·연구관: 데이터에서는 "광운대학교 문화관" 외곽선 하나라 각각 자리를 지정 (본관 가운데 / 아래 오른쪽 날개)
  { id: '1135010200104660000018644', name: '동해문화예술관', at: [37.619862, 127.05763] },
  { id: '1135010200104660000018644', name: '연구관', at: [37.619517, 127.057732] },
];

/** 이 줌부터 라벨을 보여준다. 멀리서 볼 때(처음 화면 포함)는 숨기고, 캠퍼스를 확대했을 때만 보인다 */
export const CAMPUS_LABEL_MIN_ZOOM = 17;

/** 고리(외곽선) 하나의 면적과 무게중심 (경위도 평면 근사, 건물 크기에서는 충분) */
export function ringCentroid(ring: Position[]): { area: number; lat: number; lng: number } {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (area === 0) return { area: 0, lat: ring[0][1], lng: ring[0][0] };
  return { area: Math.abs(area / 2), lat: cy / (3 * area), lng: cx / (3 * area) };
}

/** 캠퍼스 건물 이름과 라벨 위치 [위도, 경도]. 건물을 데이터에서 찾지 못하고 at 도 없으면 뺀다 */
export function campusLabelPoints(buildingsGeoJSON: FeatureCollection): { name: string; at: [number, number] }[] {
  const names = new Map(CAMPUS_BUILDINGS.map((b) => [b.id, b.name]));
  // 같은 건물관리번호가 여러 행(여러 동)으로 나뉘어 있을 수 있어서, 모든 동 중 가장 큰 동을 고른다
  const largest = new Map<string, ReturnType<typeof ringCentroid>>();
  for (const feature of buildingsGeoJSON.features ?? []) {
    const id = String(feature.properties?.bd_mgt_sn ?? '');
    const geometry = feature.geometry;
    if (!names.has(id) || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) continue;
    const rings = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((polygon) => polygon[0]);
    for (const part of rings.map(ringCentroid)) {
      if (part.area > (largest.get(id)?.area ?? 0)) largest.set(id, part);
    }
  }
  return CAMPUS_BUILDINGS.flatMap((building) => {
    const part = largest.get(building.id);
    const at = building.at ?? (part ? [part.lat, part.lng] as [number, number] : null);
    return at ? [{ name: building.name, at }] : [];
  });
}
