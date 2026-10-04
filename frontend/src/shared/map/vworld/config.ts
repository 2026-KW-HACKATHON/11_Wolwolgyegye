// ---------------------------------------------------------------------
// 설정 (V_World/main.js 의 "설정" 부분을 옮긴 것)
// 색은 MainMap.css 의 .mm-root CSS 변수 한 곳에서 관리하고, 지도를 만들 때 그 값을 읽는다.
// ---------------------------------------------------------------------
import type { Feature } from 'geojson';
import type { PathOptions } from 'leaflet';
import {
  normalizeApartment,
  normalizeMountain,
  normalizeSchool,
  normalizeWater,
  type AreaInfo,
  type RoadGrade,
  type SchoolFacilityKind,
} from './normalize';

/** 수집 스크립트가 저장한 파일 위치 (frontend/public/data/vworld) */
const DATA_DIR = '/data/vworld';

export const DATA_URLS = {
  buildings: `${DATA_DIR}/buildings.geojson`,
  roads: `${DATA_DIR}/roads.geojson`,
  adminDong: `${DATA_DIR}/admin_dong.geojson`,
  schoolFacilities: `${DATA_DIR}/school_facilities.geojson`,
};

export type AreaKey = 'water' | 'mountain' | 'school' | 'apartment';
type AreaStyleKey = AreaKey | 'apartmentNoRoads';

export interface AreaLayerConfig {
  key: AreaKey;
  url: string;
  label: string;
  normalize: (feature: Feature) => AreaInfo;
  /** feature 마다 다른 스타일이 필요하면 AREA_STYLES 의 키를 고른다. 없으면 key 를 쓴다 */
  styleKey?: (info: AreaInfo) => AreaStyleKey;
}

/**
 * 영역 레이어 설정. 배열 순서 = 그리는 순서 (앞쪽이 아래).
 * 학교·아파트 단지 "영역 구분" 을 맨 아래에 깔고, 강·산은 그 위에 덮는다. (도로·건물은 영역 위)
 * 영역 종류를 추가·삭제하거나 순서를 바꾸려면 여기만 고치면 된다.
 */
export const AREA_LAYERS: AreaLayerConfig[] = [
  { key: 'school', url: `${DATA_DIR}/schools.geojson`, label: '학교', normalize: normalizeSchool },
  {
    key: 'apartment',
    url: `${DATA_DIR}/apartments.geojson`,
    label: '아파트 단지 (추정)',
    normalize: normalizeApartment,
    // 단지 내 도로가 없다고 확인된 단지만 따로 표시. 판단 정보가 없으면(null) 기본 색 유지
    styleKey: (info) => (info.hasInnerRoads === false ? 'apartmentNoRoads' : 'apartment'),
  },
  { key: 'water', url: `${DATA_DIR}/water.geojson`, label: '강·하천', normalize: normalizeWater },
  { key: 'mountain', url: `${DATA_DIR}/mountains.geojson`, label: '산', normalize: normalizeMountain },
];

export const ROAD_GRADE_LABELS: Record<RoadGrade, string> = {
  major: '큰 도로',
  medium: '중간 도로',
  minor: '작은 길',
  complex: '단지 내 도로',
  school: '학교 안 도로',
};

export type RoadStyle = PathOptions & { minZoom: number };

export interface MapStyles {
  ROAD_STYLES: Record<RoadGrade, RoadStyle>;
  BUILDING_STYLE: PathOptions;
  BUILDING_HOVER_STYLE: PathOptions;
  AREA_STYLES: Record<AreaStyleKey, PathOptions>;
  ADMIN_DONG_STYLE: PathOptions;
  SCHOOL_FACILITY_STYLES: Record<SchoolFacilityKind, { fillColor: string; label: string }>;
  SCHOOL_FACILITY_BASE_STYLE: PathOptions;
}

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
      complex: { color: css('--road-complex'), weight: 1.5, opacity: 0.9, minZoom: 15 },
      school: { color: css('--road-school'), weight: 1.5, opacity: 0.9, minZoom: 15 },
      minor: { color: css('--road-minor'), weight: 1, opacity: 0.85, minZoom: 16 },
      medium: { color: css('--road-medium'), weight: 2.5, opacity: 0.9, minZoom: 0 },
      major: { color: css('--road-major'), weight: 4, opacity: 0.95, minZoom: 0 },
    },
    BUILDING_STYLE: {
      fillColor: css('--building-fill'),
      fillOpacity: 0.85,
      color: css('--building-stroke'),
      weight: 0.5,
      opacity: 0.9,
    },
    BUILDING_HOVER_STYLE: { fillColor: css('--building-hover'), fillOpacity: 0.95 },
    // 산·강은 테두리 없이 면만, 학교·아파트 단지는 영역이 구분되도록 테두리를 둔다.
    AREA_STYLES: {
      water: { fillColor: css('--water-fill'), fillOpacity: 0.9, stroke: false },
      mountain: { fillColor: css('--mountain-fill'), fillOpacity: 0.85, stroke: false },
      school: { fillColor: css('--school-fill'), fillOpacity: 0.7, color: css('--school-stroke'), weight: 1.2, opacity: 0.9 },
      apartment: { fillColor: css('--apartment-fill'), fillOpacity: 0.7, color: css('--apartment-stroke'), weight: 1.2, opacity: 0.9 },
      // 단지 내 도로 데이터가 없는 아파트 단지 (테스트용 구분 표시)
      apartmentNoRoads: { fillColor: css('--apartment-noroad-fill'), fillOpacity: 0.75, color: css('--apartment-noroad-stroke'), weight: 1.2, opacity: 0.9 },
    },
    // 월계1동 경계 (점선 외곽선, 채우지 않음). 아래 건물 클릭을 가로막지 않도록 interactive false
    // (월계동 법정동 경계는 지금은 그리지 않는다. 수집 스크립트는 boundary.geojson 을 계속 저장한다)
    ADMIN_DONG_STYLE: { color: css('--admin-dong'), weight: 2.5, dashArray: '4 6', fill: false, interactive: false },
    // 학교 건물 종류별 스타일 (normalizeSchoolFacility 의 kind 와 짝)
    SCHOOL_FACILITY_STYLES: {
      classroom: { fillColor: css('--school-bld-class'), label: '교사·강의동' },
      gym: { fillColor: css('--school-bld-gym'), label: '체육관·강당' },
      cafeteria: { fillColor: css('--school-bld-food'), label: '급식실·식당' },
      dorm: { fillColor: css('--school-bld-dorm'), label: '기숙사' },
      etc: { fillColor: css('--school-bld-etc'), label: '기타 (창고·부속)' },
    },
    SCHOOL_FACILITY_BASE_STYLE: { fillOpacity: 0.95, color: css('--map-bg'), weight: 0.6, opacity: 0.9 },
  };
}
