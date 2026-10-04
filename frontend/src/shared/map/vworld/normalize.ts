// ---------------------------------------------------------------------
// 속성 정규화 (원본 속성 이름은 여기서만 사용한다)
// 지도 테스트 워크스페이스 V_World/main.js 의 정규화 함수를 그대로 옮긴 것. 규칙을 바꾸려면 이 파일만 고친다.
// ---------------------------------------------------------------------
import type { Feature } from 'geojson';

type Props = Record<string, unknown>;
const propsOf = (feature: Feature): Props => (feature.properties ?? {}) as Props;

/** 앞뒤 공백을 지운 문자열. null/undefined 는 빈 문자열 */
const clean = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

export interface BuildingInfo {
  /** 건물관리번호 (가게 데이터의 건물관리번호와 같은 값. 가게가 있는 건물 찾기에 쓴다). 없으면 '' */
  id: string;
  name: string;
  address: string;
  floors: number | null;
}

/**
 * 건물 feature → { name, address, floors }
 *   name    : 건물명, 비어 있으면 "이름 없음"
 *   address : "시도 시군구 동 도로명 건물번호" (빈 값은 건너뜀)
 *   floors  : 지상 층수(숫자). 0이거나 없으면 null
 */
export function normalizeBuilding(feature: Feature): BuildingInfo {
  const p = propsOf(feature);

  const name = clean(p.buld_nm) || '이름 없음';

  const address = [p.sido, p.sigungu, p.gu, p.rd_nm, p.buld_no]
    .map(clean)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');

  // gro_flo_co 는 "3" 처럼 문자열로 온다. 그대로 쓰면 "0" 이 truthy 라서
  // 값이 있는 것으로 오인되므로 반드시 숫자로 바꾼 뒤 0/NaN 을 걸러낸다.
  // 원본에서 0은 "층수 미입력"인 경우가 많아 0층 건물로 보지 않고 null 로 처리한다.
  const floorsNum = Number.parseInt(clean(p.gro_flo_co), 10);
  const floors = Number.isFinite(floorsNum) && floorsNum > 0 ? floorsNum : null;

  return { id: clean(p.bd_mgt_sn), name, address, floors };
}

export type SchoolFacilityKind = 'classroom' | 'gym' | 'cafeteria' | 'dorm' | 'etc';

interface SchoolFacilityInfo {
  kind: SchoolFacilityKind | null;
  name: string;
  school: string;
  floors: number | null;
}

/**
 * 학교 건물 feature → { kind, name, school, floors }
 *   kind: 'classroom' | 'gym' | 'cafeteria' | 'dorm' | 'etc' | null(그리지 않음)
 *
 * ※ 추정 규칙: 원본(건축물정보)에는 학교 안 건물의 세부 용도가 없어서 동 이름(dong_nm)·건물명(bld_nm)
 *   글자로 나눈다. 위에서부터 먼저 걸리는 규칙을 쓴다.
 *   - "체육관", "강당"            → gym        (예: 강당겸체육관)
 *   - "급식", "식당"              → cafeteria  (예: N동(급식실))
 *   - "기숙사", "생활관"          → dorm
 *   - "창고", "보일러", "경비", "화장실", "주차" → etc
 *   - 그 밖에 이름이나 용도가 있는 건물 → classroom (교사동, 본관, ○○관 등)
 *   - 이름·용도가 모두 빈 기록 → null (그리지 않음. 같은 자리에 내용 있는 기록이 따로 있는 경우가 많아
 *     회색으로 덮어 그리면 분류된 건물을 가린다. 일반 건물 색이 그대로 보인다)
 */
export function normalizeSchoolFacility(feature: Feature): SchoolFacilityInfo {
  const p = propsOf(feature);
  const dong = clean(p.dong_nm);
  const bld = clean(p.bld_nm);
  const text = `${dong} ${bld}`;
  if (!dong && !bld && !clean(p.usability)) return { kind: null, name: '', school: clean(p.school_name), floors: null };
  let kind: SchoolFacilityKind = 'etc';
  if (/체육관|강당/.test(text)) kind = 'gym';
  else if (/급식|식당/.test(text)) kind = 'cafeteria';
  else if (/기숙사|생활관/.test(text)) kind = 'dorm';
  else if (/창고|보일러|경비|화장실|주차/.test(text)) kind = 'etc';
  else kind = 'classroom';

  // grnd_flr 는 "4" 처럼 문자열로 온다. 0 이나 빈 값은 정보 없음(null)
  const floors = Number.parseInt(clean(p.grnd_flr), 10) || null;
  return { kind, name: dong || bld, school: clean(p.school_name), floors };
}

// 영역 feature → { title, lines } (팝업 제목, 설명 줄 배열. 빈 줄은 표시하지 않음)
export interface AreaInfo {
  title: string;
  lines: string[];
}

/** 강·하천: 하천명, 하천 등급(국가하천/지방하천) */
export function normalizeWater(feature: Feature): AreaInfo {
  const p = propsOf(feature);
  return { title: clean(p.riv_nm) || '하천', lines: [clean(p.cat_nam)] };
}

/** 산: 산림 토양 구분(예: 갈색약건산림토양). 산 이름 정보는 원본에 없다 */
export function normalizeMountain(feature: Feature): AreaInfo {
  const p = propsOf(feature);
  return { title: '산림', lines: [clean(p.name)] };
}

/**
 * 학교: 도시계획 시설명 + 학교급.
 * 시설명이 "학교", "초등학교(국민학교)" 처럼 일반명인 경우가 많고, 학교급이 "미분류"이면 표시하지 않는다.
 */
export function normalizeSchool(feature: Feature): AreaInfo {
  const p = propsOf(feature);
  const level = clean(p.mls_nam);
  return { title: clean(p.dgm_nm) || '학교', lines: [level === '미분류' ? '' : level] };
}

/** 아파트 단지(수집 스크립트가 추정해서 만든 영역): 대표 단지명, 동 수, 최고 층수, 필지 주소 */
export function normalizeApartment(feature: Feature): AreaInfo {
  const p = propsOf(feature);
  // 수집 스크립트가 숫자로 저장하지만, 출처가 바뀌어 문자열로 와도 되도록 Number() 로 변환
  const count = Number(p.building_count) || 0;
  const maxFloors = Number(p.max_floors) || 0;
  const summary = [count ? `아파트 ${count}개 동` : '', maxFloors ? `최고 ${maxFloors}층` : '']
    .filter(Boolean)
    .join(', ');
  return { title: clean(p.name) || '아파트 단지', lines: [summary, clean(p.address)] };
}
