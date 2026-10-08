// ---------------------------------------------------------------------
// 데이터 로딩 (어디서 왔는지 모르는 GeoJSON 만 다룬다) — V_World/main.js 의 loadData() 를 옮긴 것
// ---------------------------------------------------------------------
import type { FeatureCollection } from 'geojson';
import { AREA_LAYERS, DATA_URLS, type AreaKey } from './config';

interface MapData {
  buildings: FeatureCollection;
  /** 도로·철도 (OpenStreetMap). 아직 받지 않았으면 null */
  roads: FeatureCollection | null;
  railways: FeatureCollection | null;
  /** 지하철 노선·역·출구 (OpenStreetMap). 없으면 null */
  subwayLines: FeatureCollection | null;
  stations: FeatureCollection | null;
  stationExits: FeatureCollection | null;
  adminDong: FeatureCollection | null;
  schoolFacilities: FeatureCollection | null;
  landmarks: FeatureCollection | null;
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
 * 지도에 필요한 데이터를 모두 읽어 { buildings, roads, railways, subwayLines, stations, stationExits, adminDong, schoolFacilities, areas } 로 돌려준다.
 * buildings 는 필수. 나머지와 areas 의 각 항목은 없으면 null 이다.
 *   areas = { water, mountain, school, apartment }
 * 필수 파일이 없으면 null 을 돌려준다. (안내문은 화면 컴포넌트가 띄운다)
 */
export async function loadData(): Promise<MapData | null> {
  const [buildings, roads, railways, subwayLines, stations, stationExits, adminDong, schoolFacilities, landmarks, ...areaList] = await Promise.all([
    fetchGeoJSON(DATA_URLS.buildings),
    fetchGeoJSON(DATA_URLS.roads),
    fetchGeoJSON(DATA_URLS.railways),
    fetchGeoJSON(DATA_URLS.subwayLines),
    fetchGeoJSON(DATA_URLS.stations),
    fetchGeoJSON(DATA_URLS.stationExits),
    fetchGeoJSON(DATA_URLS.adminDong),
    fetchGeoJSON(DATA_URLS.schoolFacilities),
    fetchGeoJSON(DATA_URLS.landmarks),
    ...AREA_LAYERS.map((a) => fetchGeoJSON(a.url)),
  ]);

  if (!buildings) return null;

  const areas = { water: null, mountain: null, school: null, apartment: null } as MapData['areas'];
  AREA_LAYERS.forEach((a, i) => {
    areas[a.key] = areaList[i];
  });
  return { buildings, roads, railways, subwayLines, stations, stationExits, adminDong, schoolFacilities, landmarks, areas };
}
