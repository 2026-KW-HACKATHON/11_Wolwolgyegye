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

/** 데이터의 노선 색(hex 형식)만 받는다. 없거나 형식이 다르면 '' → 그리는 쪽이 theme.css 의 --map-line-default 를 쓴다 */
const colourOf = (v: unknown): string => (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(clean(v)) ? clean(v) : '');

/** 노선 칩에 넣을 짧은 이름: "1호선" → "1", "경춘선" → "경춘" */
export const shortLineLabel = (label: string): string => (/^\d+호선$/.test(label) ? label.replace('호선', '') : label.replace(/선$/, '').slice(0, 2));

export interface SubwayLineInfo {
  /** 예: 1호선, 6호선, 경춘선 */
  label: string;
  /** 노선 색 (hex). 데이터에 없으면 '' */
  colour: string;
}

/** 지하철 노선 feature → { label, colour } (수집 스크립트가 붙인 line_label / line_colour) */
export function normalizeSubwayLine(feature: Feature): SubwayLineInfo {
  const p = propsOf(feature);
  return { label: clean(p.line_label) || clean(p.name), colour: colourOf(p.line_colour) };
}

export interface StationInfo {
  name: string;
  /** 이 역에 서는 노선 (수집 스크립트가 노선 경로의 정차 위치로 계산) */
  lines: SubwayLineInfo[];
}

/** 노선 이름에서 계통·급행 같은 말을 뗀다: "1호선 경원·경부 계통" → "1호선" */
const baseLineLabel = (label: string): string => label.trim().split(/\s+/)[0] ?? '';

/** 역 feature → { name, lines }. 같은 노선이 계통별로 여러 번 들어 있어도 한 번만 */
export function normalizeStation(feature: Feature): StationInfo {
  const p = propsOf(feature);
  const labels = clean(p.station_lines).split(';').filter(Boolean);
  const colours = clean(p.station_colours).split(';');
  const lines = new Map<string, SubwayLineInfo>();
  labels.forEach((label, i) => {
    const base = baseLineLabel(label);
    if (base && !lines.has(base)) lines.set(base, { label: base, colour: colourOf(colours[i]) });
  });
  return { name: clean(p.name), lines: [...lines.values()] };
}

/** 노선 feature 의 묶음 이름 (역의 노선과 비교용) */
export const subwayLineBase = (feature: Feature): string => baseLineLabel(normalizeSubwayLine(feature).label);

export interface StationExitInfo {
  /** 출구 번호 (예: 1, 2-1). 없으면 '' */
  number: string;
  /** 붙은 역의 feature id */
  stationId: string;
}

/** 역 출구 feature → { number, stationId } */
export function normalizeStationExit(feature: Feature): StationExitInfo {
  const p = propsOf(feature);
  return { number: clean(p.ref) || clean(p.name).replace(/[^0-9-]/g, ''), stationId: clean(p.station_id) };
}
