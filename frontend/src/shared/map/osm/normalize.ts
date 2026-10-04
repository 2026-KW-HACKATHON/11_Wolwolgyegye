// ---------------------------------------------------------------------
// OpenStreetMap 도로·철도 속성 정규화 (OSM 태그 이름은 여기서만 사용한다)
// 데이터: scripts/fetch-osm.js 가 저장한 public/data/osm/*.geojson. 규칙을 바꾸려면 이 파일만 고친다.
// ---------------------------------------------------------------------
import type { Feature } from 'geojson';

type Props = Record<string, unknown>;
const propsOf = (feature: Feature): Props => (feature.properties ?? {}) as Props;
const clean = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
/** OSM 의 bridge·tunnel 은 yes 외에도 viaduct, building_passage 같은 값이 온다. no 가 아니면 있는 것으로 본다 */
const flag = (v: unknown): boolean => { const s = clean(v); return s !== '' && s !== 'no'; };

/** 도로 등급. ROAD_STYLES(config.ts)의 키와 짝 */
export type RoadGrade = 'major' | 'medium' | 'minor' | 'service' | 'path';

/** OSM highway 값 → 등급. 목록에 없는 값(공사 중·계획 등)은 그리지 않는다 */
const HIGHWAY_GRADES: Record<string, RoadGrade> = {
  motorway: 'major', motorway_link: 'major', trunk: 'major', trunk_link: 'major', primary: 'major', primary_link: 'major',
  secondary: 'medium', secondary_link: 'medium', tertiary: 'medium', tertiary_link: 'medium',
  residential: 'minor', unclassified: 'minor', living_street: 'minor', road: 'minor',
  service: 'service',
  pedestrian: 'path', footway: 'path', path: 'path', steps: 'path', cycleway: 'path', track: 'path',
};

export interface RoadInfo {
  name: string;
  /** null 이면 그리지 않는다 (모르는 종류, 지하 구간) */
  grade: RoadGrade | null;
  lanes: number | null;
  widthM: number | null;
  bridge: boolean;
}

/**
 * 도로 feature → { name, grade, lanes, widthM, bridge }
 * 지하차도(tunnel)는 지상 지도에 그리면 건물을 가로지르는 선이 되므로 그리지 않는다(grade null).
 */
export function normalizeOsmRoad(feature: Feature): RoadInfo {
  const p = propsOf(feature);
  const grade = flag(p.tunnel) ? null : HIGHWAY_GRADES[clean(p.highway)] ?? null;
  return {
    name: clean(p.name) || clean(p.ref),
    grade,
    lanes: Number.parseInt(clean(p.lanes), 10) || null,
    widthM: Number.parseFloat(clean(p.width)) || null,
    bridge: flag(p.bridge),
  };
}

export interface RailwayInfo {
  name: string;
  /** 일반 철도 / 지하철 / 경전철 */
  kindLabel: string;
  /** 지하 구간이면 그리지 않는다 */
  underground: boolean;
}

const RAIL_LABELS: Record<string, string> = { rail: '철도', subway: '지하철', light_rail: '경전철', narrow_gauge: '협궤 철도' };

/** 철도 feature → { name, kindLabel, underground } */
export function normalizeRailway(feature: Feature): RailwayInfo {
  const p = propsOf(feature);
  return {
    name: clean(p.name),
    kindLabel: RAIL_LABELS[clean(p.railway)] ?? '철도',
    underground: flag(p.tunnel) || Number.parseInt(clean(p.layer), 10) < 0,
  };
}
