// ---------------------------------------------------------------------
// 설정 (V_World/main.js 의 "설정" 부분을 옮긴 것)
// 색은 MainMap.css 의 .mm-root CSS 변수 한 곳에서 관리하고, 지도를 만들 때 그 값을 읽는다.
// ---------------------------------------------------------------------
import type { Feature } from 'geojson';
import type { PathOptions } from 'leaflet';
import type { RoadGrade } from '../osm/normalize';
import {
  normalizeApartment,
  normalizeMountain,
  normalizeSchool,
  normalizeWater,
  type AreaInfo,
  type SchoolFacilityKind,
} from './normalize';

/** 수집 스크립트가 저장한 파일 위치 (frontend/public/data/vworld, frontend/public/data/osm) */
const DATA_DIR = '/data/vworld';
const OSM_DIR = '/data/osm';
const MAP_DATA_DIR = '/data/3d';

export const DATA_URLS = {
  buildings: `${DATA_DIR}/buildings.geojson`,
  adminDong: `${DATA_DIR}/admin_dong.geojson`,
  schoolFacilities: `${DATA_DIR}/school_facilities.geojson`,
  /** 2D·3D가 함께 쓰는 주요 시설 이름표 */
  landmarks: `${MAP_DATA_DIR}/landmarks.geojson`,
  /** 도로·철도는 OpenStreetMap (scripts/fetch-osm.js) */
  roads: `${OSM_DIR}/roads.geojson`,
  railways: `${OSM_DIR}/railways.geojson`,
  /** 지하철 노선·역·출구도 OpenStreetMap */
  subwayLines: `${OSM_DIR}/subway_lines.geojson`,
  stations: `${OSM_DIR}/stations.geojson`,
  stationExits: `${OSM_DIR}/station_exits.geojson`,
};

export type AreaKey = 'water' | 'mountain' | 'school' | 'apartment';

export interface AreaLayerConfig {
  key: AreaKey;
  url: string;
  label: string;
  normalize: (feature: Feature) => AreaInfo;
  /** false 면 눌러도 안내창을 띄우지 않고, 클릭을 아래로 통과시킨다 */
  popup?: boolean;
}

/**
 * 영역 레이어 설정. 배열 순서 = 그리는 순서 (앞쪽이 아래).
 * 학교·아파트 단지 "영역 구분" 을 맨 아래에 깔고, 강·산은 그 위에 덮는다. (도로·건물은 영역 위)
 * 영역 종류를 추가·삭제하거나 순서를 바꾸려면 여기만 고치면 된다.
 */
export const AREA_LAYERS: AreaLayerConfig[] = [
  // 학교 영역은 이름 없이 "학교 / 대학" 만 나와서 안내창을 띄우지 않는다
  { key: 'school', url: `${DATA_DIR}/schools.geojson`, label: '학교', normalize: normalizeSchool, popup: false },
  { key: 'apartment', url: `${DATA_DIR}/apartments.geojson`, label: '아파트 단지 (추정)', normalize: normalizeApartment },
  { key: 'water', url: `${DATA_DIR}/water.geojson`, label: '강·하천', normalize: normalizeWater },
  { key: 'mountain', url: `${DATA_DIR}/mountains.geojson`, label: '산', normalize: normalizeMountain },
];

export const ROAD_GRADE_LABELS: Record<RoadGrade, string> = {
  major: '큰 도로',
  medium: '중간 도로',
  minor: '골목길',
  service: '단지·주차장 통로',
  path: '보행로',
};

export type RoadStyle = PathOptions & { minZoom: number };

export interface MapStyles {
  ROAD_STYLES: Record<RoadGrade, RoadStyle>;
  BUILDING_STYLE: PathOptions;
  BUILDING_HOVER_STYLE: PathOptions;
  /** 가게 핀이 있는 건물의 테두리 (색은 핀 색으로 채운다) */
  BUILDING_OUTLINE_STYLE: PathOptions;
  AREA_STYLES: Record<AreaKey, PathOptions>;
  /** 철도: 바탕 선 위에 흰 점선을 겹쳐 그린다 */
  RAILWAY_BASE_STYLE: PathOptions;
  RAILWAY_DASH_STYLE: PathOptions;
  /** 지하철 노선: 철도 위에 겹치는 얇은 선 (색은 노선 색) */
  SUBWAY_LINE_STYLE: PathOptions;
  /** 역 이름표와 출구를 잇는 점선 */
  STATION_EXIT_LINK_STYLE: PathOptions;
  ADMIN_DONG_STYLE: PathOptions;
}

/** 학교 건물 종류 이름 (팝업용. 색은 일반 건물과 같다) */
export const SCHOOL_FACILITY_LABELS: Record<SchoolFacilityKind, string> = {
  classroom: '교사·강의동',
  gym: '체육관·강당',
  cafeteria: '급식실·식당',
  dorm: '기숙사',
  etc: '기타 (창고·부속)',
};

export const ADMIN_DONG_LABEL = '월계1동(행정동)';
export const NO_INFO = '정보 없음';

/**
 * CSS 변수에서 색을 읽어 스타일을 만든다. (원본은 파일을 읽을 때 바로 만들었지만,
 * 이 앱에서는 CSS 가 컴포넌트와 함께 들어오므로 지도를 만들 때 호출한다)
 */
export function createStyles(css: (name: string) => string): MapStyles {
  return {
    // 도로 등급별 스타일 (굵기·색·보이는 최소 줌은 여기 한 곳에서만 정한다)
    // 키 순서 = 그리는 순서 (뒤쪽이 위). 넓은 길이 좁은 길을 덮도록 좁은 길부터 그린다.
    ROAD_STYLES: {
      path: { color: css('--road-path'), weight: 1, opacity: 0.9, dashArray: '2 3', minZoom: 17 },
      service: { color: css('--road-service'), weight: 1.5, opacity: 0.9, minZoom: 16 },
      minor: { color: css('--road-minor'), weight: 2, opacity: 0.95, minZoom: 15 },
      medium: { color: css('--road-medium'), weight: 3.5, opacity: 1, minZoom: 0 },
      major: { color: css('--road-major'), weight: 5, opacity: 1, minZoom: 0 },
    },
    RAILWAY_BASE_STYLE: { color: css('--rail-base'), weight: 4, opacity: 0.95, lineCap: 'butt' },
    RAILWAY_DASH_STYLE: { color: css('--rail-dash'), weight: 2, opacity: 1, dashArray: '8 8', lineCap: 'butt', interactive: false },
    SUBWAY_LINE_STYLE: { color: css('--map-line-default'), weight: 3, opacity: 0.9, lineCap: 'round', lineJoin: 'round' },
    STATION_EXIT_LINK_STYLE: { color: css('--station-exit-link'), weight: 1.5, opacity: 0.9, dashArray: '3 4', interactive: false },
    BUILDING_STYLE: {
      fillColor: css('--building-fill'),
      fillOpacity: 0.85,
      color: css('--building-stroke'),
      weight: 0.5,
      opacity: 0.9,
    },
    BUILDING_HOVER_STYLE: { fillColor: css('--building-hover'), fillOpacity: 0.95 },
    BUILDING_OUTLINE_STYLE: { weight: 2, opacity: 1 },
    // 영역은 모두 테두리 없이 면만. 학교·아파트 단지는 바탕색보다 아주 조금 진한 색이다.
    AREA_STYLES: {
      water: { fillColor: css('--water-fill'), fillOpacity: 0.9, stroke: false },
      mountain: { fillColor: css('--mountain-fill'), fillOpacity: 0.85, stroke: false },
      school: { fillColor: css('--school-fill'), fillOpacity: 1, stroke: false },
      apartment: { fillColor: css('--apartment-fill'), fillOpacity: 1, stroke: false },
    },
    // 월계1동 경계 (점선 외곽선, 채우지 않음). 아래 건물 클릭을 가로막지 않도록 interactive false
    ADMIN_DONG_STYLE: { color: css('--admin-dong'), weight: 2.5, dashArray: '4 6', fill: false, interactive: false },
  };
}
