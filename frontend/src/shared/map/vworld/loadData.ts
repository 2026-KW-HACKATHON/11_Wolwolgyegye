// ---------------------------------------------------------------------
// 데이터 로딩 (어디서 왔는지 모르는 GeoJSON 만 다룬다) — V_World/main.js 의 loadData() 를 옮긴 것
// ---------------------------------------------------------------------
import type { FeatureCollection } from 'geojson';
import { AREA_LAYERS, DATA_URLS, type AreaKey } from './config';

interface MapData {
  buildings: FeatureCollection;
  roads: FeatureCollection;
  adminDong: FeatureCollection | null;
  schoolFacilities: FeatureCollection | null;
  areas: Record<AreaKey, FeatureCollection | null>;
}

/** GeoJSON 하나를 읽는다. 파일이 없으면 null */
async function fetchGeoJSON(url: string): Promise<FeatureCollection | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null; // 없는 파일
    // 개발 서버는 없는 파일에 index.html 을 돌려주기도 하므로 JSON 이 아니면 없는 것으로 본다
    if (!(res.headers.get('content-type') ?? '').match(/json|geo/)) return null;
    return (await res.json()) as FeatureCollection;
  } catch {
    return null; // 네트워크 오류 또는 JSON 이 아님
  }
}

/**
 * 지도에 필요한 데이터를 모두 읽어 { buildings, roads, adminDong, schoolFacilities, areas } 로 돌려준다.
 * buildings, roads 는 필수. 나머지와 areas 의 각 항목은 없으면 null 이다.
 *   areas = { water, mountain, school, apartment }
 * 필수 파일이 없으면 null 을 돌려준다. (안내문은 화면 컴포넌트가 띄운다)
 */
export async function loadData(): Promise<MapData | null> {
  const [buildings, roads, adminDong, schoolFacilities, ...areaList] = await Promise.all([
    fetchGeoJSON(DATA_URLS.buildings),
    fetchGeoJSON(DATA_URLS.roads),
    fetchGeoJSON(DATA_URLS.adminDong),
    fetchGeoJSON(DATA_URLS.schoolFacilities),
    ...AREA_LAYERS.map((a) => fetchGeoJSON(a.url)),
  ]);

  if (!buildings || !roads) return null;

  const areas = { water: null, mountain: null, school: null, apartment: null } as MapData['areas'];
  AREA_LAYERS.forEach((a, i) => {
    areas[a.key] = areaList[i];
  });
  return { buildings, roads, adminDong, schoolFacilities, areas };
}
