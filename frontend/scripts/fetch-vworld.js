// =====================================================================
// 브이월드(V-World) 2D데이터 API에서 월계1동 일대의 건물·도로·경계를 받아
// public/data/vworld/*.geojson 으로 저장하는 스크립트.
// (지도 테스트 워크스페이스 V_World/scripts/fetch-vworld.js 를 옮겨 온 것. 바꾼 곳: 조회 범위, 저장 위치, 실행 방법)
//
// 실행: frontend 폴더에서 npm run fetch:vworld
//   → node --env-file-if-exists=.env.local scripts/fetch-vworld.js
//   (.env.local 은 frontend 폴더에 있다. 필요한 값: VWORLD_KEY, VWORLD_DOMAIN)
//   Node 22.9+ 내장 기능으로 .env 를 읽으므로 dotenv 패키지가 필요 없다.
//   (--env-file 대신 -if-exists 를 쓰는 이유: .env 가 없을 때 Node가 먼저
//    죽지 않고, 아래에서 직접 안내 메시지를 출력할 수 있게 하기 위함)
//
// 화면(src/shared/map)은 이 스크립트가 만든 GeoJSON 파일만 읽는다. 키는 이 스크립트에서만 쓰인다.
// 데이터 출처를 바꾸고 싶으면 이 스크립트만 교체하면 된다.
// =====================================================================

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------
// 설정 상수 (필요하면 여기만 고치면 된다)
// ---------------------------------------------------------------------
const BUILDING_LAYER = 'LT_C_SPBD';       // 건물 (도로명주소 건물)
const ROAD_LAYER = 'LT_L_SPRD';           // 도로 (도로명주소 도로구간)
const BOUNDARY_LAYER = 'LT_C_ADEMD_INFO'; // 읍면동(법정동) 경계
const BOUNDARY_EMD_CD = '11350102';       // 서울 노원구 월계동(법정동) 코드

// 행정동 경계: 2D데이터 API 에는 없고 WFS 로만 제공되는 센서스 행정동 경계 레이어를 쓴다.
// adm_cd 는 통계청 센서스 행정동 코드라서 행정안전부 행정동 코드와 체계가 다르다.
const WFS_URL = 'https://api.vworld.kr/req/wfs';
const ADMIN_DONG_LAYER = 'lt_c_cademd';   // (센서스경계) 행정동경계
const ADMIN_DONG_CD = '11110510';         // 월계1동

// 영역(면) 레이어 — 건물 아래에 깔리는 배경 영역들
const WATER_LAYER = 'LT_C_WKMSTRM';       // 하천망 (중랑천, 우이천 등 하천 면)
const FOREST_LAYER = 'LT_C_FSDIFRSTS';    // 산림입지도 (산림 토양 구분 면)
// 산림입지도에서 산림이 아닌 구분값 (제지=비산림지, 경작지, 기타) → 산 영역에서 뺀다
const FOREST_EXCLUDE_NAMES = ['제지', '경작지', '기타'];
const FACILITY_LAYER = 'LT_C_UPISUQ155';  // 도시계획(공공문화체육시설) — 학교 부지 포함
const SCHOOL_LCL_NAM = '학교';            // 위 레이어에서 학교만 고를 대분류명

// 아파트 단지는 브이월드에 전용 레이어가 없어서 세 레이어를 겹쳐 "추정"한다. (deriveApartmentComplexes 참고)
//   1) 도로명주소 건물을 "같은 도로명주소"끼리 묶는다. 한 단지는 보통 주소 하나를 같이 쓰므로
//      본동·관리실·상가가 한 묶음이 된다. (예: 새봄아파트 = 광운로17길 45-3 의 3개 건물)
//   2) 묶음이 아래 중 하나라도 만족하면 아파트 단지로 본다.
//      - 건물명(또는 건물명 상세)에 "아파트"가 들어 있다        (예: 새봄아파트관리실)
//      - 건축물정보상 공동주택이 APT_TOWER_MIN_FLOORS층 이상     (예: 월계1차한일 101동 19층)
//      - 건축물정보상 APT_MIN_FLOORS층 이상 공동주택이 APT_MIN_BUILDINGS개 동 이상
//      6~9층 공동주택 1개 동뿐이고 이름에 "아파트"가 없으면 빌라·도시형생활주택으로 보고 제외한다.
//   3) 묶음의 건물들이 놓인 지적 필지를 모두 단지 영역으로 하고, 필지를 공유하는 묶음은 하나로 합친다.
//      (주소가 여러 개인 큰 단지, 여러 필지에 걸친 단지 대응)
const BLDGINFO_LAYER = 'LT_C_BLDGINFO';     // 건축물정보 (용도·층수)
const PARCEL_LAYER = 'LP_PA_CBND_BUBUN';    // 연속지적도 (필지)
const APT_USABILITY = '02000';              // 건축물 용도코드: 공동주택
const APT_NAME_PATTERN = /아파트/;
const APT_TOWER_MIN_FLOORS = 10;
const APT_MIN_FLOORS = 6;
const APT_MIN_BUILDINGS = 2;
// 건축물정보 건물이 도로명주소 건물 도형과 겹치지 않을 때, 이 거리(m) 안의 가장 가까운 건물에 붙인다
const APT_HOST_MAX_M = 15;

// 도로 그리기용 선: 도로중심선 (수치지도 기반, 단지 안 통로까지 포함되고 도로폭·차로수가 있다)
// 도로명주소 도로(ROAD_LAYER)는 화면에 직접 그리지 않고, 중심선에 "도로 이름"을 붙이는 데만 쓴다.
// 중심선 수집에 실패하면 예전처럼 도로명주소 도로를 그대로 저장한다.
const CENTERLINE_LAYER = 'LT_L_N3A0020000';
// 중심선 구간의 중간점에서 이 거리(m) 안에 도로명주소 도로가 있으면 그 도로명을 붙인다.
// (분석 결과 72%가 3m 안에서 일치. 교차로 부근의 짧은 구간은 옆 도로 이름이 붙을 수 있음)
const NAME_MATCH_MAX_M = 10;

// 조회 범위 — 화면 src/shared/map/vworld/mapExtent.ts 와 같은 규칙·같은 값을 쓴다.
// 월계1동(행정동)을 감싸는 직사각형 (센서스 행정동 경계 lt_c_cademd, adm_cd 11110510, 기준일 20240630 의 꼭짓점 최소·최대)
const WOLGYE1_RECT = { south: 37.61426899, west: 127.04973988, north: 37.6301994, east: 127.06596365 };
// 지도 전체 범위: 세로 = 1.2H (직사각형 세로 H 에 위아래 0.1H 씩 여유), 가로 = 1.25H (직사각형 가운데 기준).
//   가장 많이 축소했을 때 가로 화면은 세로 H/2 가 보이고, PC(가로:세로 = 2.5:1)에서는 가로 1.25H 가 보이기 때문.
const MAP_WIDTH_PER_HEIGHT = 1.25;
const MAP_HEIGHT_PER_RECT = 1.2;
// 수집은 지도 범위보다 사방으로 이만큼(m) 더 넓게 받는다.
// (확대·축소나 관성 이동 중 범위 끝을 잠깐 넘어가도 빈 바탕이 아니라 실제 지도가 보이도록)
const DATA_MARGIN_M = 300;
const RANGE_M_PER_DEG_LAT = 110540;
const RANGE_M_PER_DEG_LNG = 111320 * Math.cos((((WOLGYE1_RECT.south + WOLGYE1_RECT.north) / 2) * Math.PI) / 180);
const MAP_HALF_WIDTH_DEG =
  ((WOLGYE1_RECT.north - WOLGYE1_RECT.south) * RANGE_M_PER_DEG_LAT * MAP_WIDTH_PER_HEIGHT) / 2 / RANGE_M_PER_DEG_LNG;
const MAP_CENTER_LNG = (WOLGYE1_RECT.west + WOLGYE1_RECT.east) / 2;
const round6 = (v) => Math.round(v * 1e6) / 1e6;
const MAP_VERTICAL_PAD_DEG = ((WOLGYE1_RECT.north - WOLGYE1_RECT.south) * (MAP_HEIGHT_PER_RECT - 1)) / 2;
const SOUTH = round6(WOLGYE1_RECT.south - MAP_VERTICAL_PAD_DEG - DATA_MARGIN_M / RANGE_M_PER_DEG_LAT);
const NORTH = round6(WOLGYE1_RECT.north + MAP_VERTICAL_PAD_DEG + DATA_MARGIN_M / RANGE_M_PER_DEG_LAT);
const WEST = round6(MAP_CENTER_LNG - MAP_HALF_WIDTH_DEG - DATA_MARGIN_M / RANGE_M_PER_DEG_LNG);
const EAST = round6(MAP_CENTER_LNG + MAP_HALF_WIDTH_DEG + DATA_MARGIN_M / RANGE_M_PER_DEG_LNG);

const API_URL = 'https://api.vworld.kr/req/data';
const PAGE_SIZE_CANDIDATES = [1000, 500, 200, 100]; // size 최대값이 확인되지 않아 큰 값부터 시도
const REQUEST_INTERVAL_MS = 1100; // 요청 사이 간격 (1초 이상)
const MAX_RETRIES = 3;            // 실패 시 재시도 횟수

// frontend/public/data/vworld 폴더 (스크립트를 어디서 실행해도 같은 위치에 저장. 화면은 /data/vworld/... 로 읽는다)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'public', 'data', 'vworld');

// ---------------------------------------------------------------------
// 인증키 읽기
// ---------------------------------------------------------------------
const VWORLD_KEY = (process.env.VWORLD_KEY || '').trim();
const VWORLD_DOMAIN = (process.env.VWORLD_DOMAIN || '').trim() || 'http://localhost';

if (!VWORLD_KEY) {
  console.error('VWORLD_KEY가 없습니다. .env 파일을 확인하세요');
  process.exit(1);
}

/**
 * 문자열 안의 인증키를 **** 로 바꾼다.
 * URL, 오류 메시지, 응답 원문 등 콘솔에 찍히는 모든 문자열에 적용한다.
 * (URL 인코딩된 형태로 들어갈 수도 있으므로 두 형태 모두 치환)
 */
function mask(text) {
  let s = String(text);
  s = s.split(VWORLD_KEY).join('****');
  const encoded = encodeURIComponent(VWORLD_KEY);
  if (encoded !== VWORLD_KEY) s = s.split(encoded).join('****');
  // 혹시 위 치환에서 빠진 key= 파라미터도 한 번 더 가린다
  return s.replace(/([?&]key=)[^&\s"']*/gi, '$1****');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 실제로 사용한 size 값 (첫 성공 요청에서 결정된다)
let pageSize = null;

/** 브이월드 응답의 status 가 OK 가 아닐 때 쓰는 오류 */
class VworldStatusError extends Error {
  constructor(status, code, text) {
    super(`브이월드 응답 상태 ${status} / 코드: ${code ?? '(없음)'} / 메시지: ${text ?? '(없음)'}`);
    this.status = status;
    this.code = code;
  }
}

/**
 * 요청 URL을 만든다.
 * geomFilter=BOX(minx,miny,maxx,maxy) 는 x=경도, y=위도 순서이므로
 * BOX(WEST,SOUTH,EAST,NORTH) 로 넣는다. (위도·경도 순서를 바꾸면 엉뚱한 곳이 조회됨)
 */
function buildUrl({ layer, page, size, useBox = false, attrFilter = null, geometry = true }) {
  const params = new URLSearchParams({
    service: 'data',
    request: 'GetFeature',
    data: layer,
    key: VWORLD_KEY,
    domain: VWORLD_DOMAIN,
    format: 'json',
    crs: 'EPSG:4326', // [경도, 위도] 순서의 GeoJSON을 받기 위해 지정 → 좌표 변환 불필요
    page: String(page),
    size: String(size),
    geometry: String(geometry),
  });
  if (useBox) params.set('geomFilter', `BOX(${WEST},${SOUTH},${EAST},${NORTH})`);
  if (attrFilter) params.set('attrFilter', attrFilter);
  return `${API_URL}?${params.toString()}`;
}

/**
 * 한 번의 요청을 보내고 response 객체를 돌려준다.
 * 네트워크 오류/HTTP 오류/JSON 파싱 오류는 최대 MAX_RETRIES 회 재시도한다.
 * response.status 가 OK 가 아니면(=서버가 명시적으로 거부) VworldStatusError 를 던진다.
 */
async function requestOnce(url, label) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  요청 [${label}] ${mask(url)}${attempt > 1 ? ` (재시도 ${attempt - 1})` : ''}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const body = await res.text();
      let json;
      try {
        json = JSON.parse(body);
      } catch {
        throw new Error(`JSON 파싱 실패. 응답 앞부분: ${mask(body.slice(0, 300))}`);
      }
      const response = json.response;
      if (!response) throw new Error(`예상하지 못한 응답 형식: ${mask(body.slice(0, 300))}`);

      if (response.status === 'OK' || response.status === 'NOT_FOUND') {
        // NOT_FOUND 는 "조건에 맞는 데이터 없음" 이므로 오류가 아니라 빈 결과로 취급
        return response;
      }
      // 오류 코드와 메시지 원문 출력 (키 마스킹)
      const err = response.error || {};
      throw new VworldStatusError(response.status, mask(err.code), mask(err.text));
    } catch (e) {
      lastError = e;
      console.warn(`  ! 실패 (${attempt}/${MAX_RETRIES}): ${mask(e.message)}`);
      if (attempt < MAX_RETRIES) await sleep(REQUEST_INTERVAL_MS * attempt);
    }
  }
  throw lastError;
}

/**
 * 첫 페이지를 받으면서 사용할 size 를 결정한다.
 * size 의 최대 허용값이 문서로 확인되지 않아 1000부터 시도하고,
 * 브이월드가 오류 status 를 주면 더 작은 값으로 내려가며 재시도한다.
 */
async function requestFirstPage(opts, label) {
  const candidates = pageSize ? [pageSize] : PAGE_SIZE_CANDIDATES;
  let lastError;
  for (const size of candidates) {
    try {
      const response = await requestOnce(buildUrl({ ...opts, page: 1, size }), `${label} p1 size=${size}`);
      if (pageSize !== size) {
        pageSize = size;
        console.log(`  → size=${size} 사용`);
      }
      return response;
    } catch (e) {
      lastError = e;
      // 네트워크 문제처럼 size 와 무관한 오류일 수도 있으므로, status 오류일 때만 size 를 줄인다
      if (!(e instanceof VworldStatusError)) throw e;
      console.warn(`  size=${size} 실패 → 더 작은 size 로 재시도`);
      await sleep(REQUEST_INTERVAL_MS);
    }
  }
  throw lastError;
}

/** response 에서 FeatureCollection 의 features 배열을 꺼낸다 (없으면 빈 배열) */
function featuresOf(response) {
  return response?.result?.featureCollection?.features ?? [];
}

/**
 * bbox 안의 모든 페이지를 순서대로 받아 하나의 FeatureCollection 으로 합친다.
 */
async function fetchAllPages(layer, label) {
  console.log(`\n[${label}] ${layer} 수집 시작`);
  const first = await requestFirstPage({ layer, useBox: true }, label);

  // page.total, record.total 은 문자열("12")로 오므로 숫자로 변환해야
  // 반복문 비교(page <= totalPages)가 문자열 비교가 되지 않는다.
  const totalPages = Number(first.page?.total ?? 0) || (featuresOf(first).length ? 1 : 0);
  const totalRecords = Number(first.record?.total ?? 0);
  console.log(`  전체 ${totalRecords}건, ${totalPages}페이지`);

  const all = [...featuresOf(first)];
  for (let page = 2; page <= totalPages; page++) {
    await sleep(REQUEST_INTERVAL_MS); // 서버 부담을 줄이기 위해 요청 사이 1초 이상 대기
    const res = await requestOnce(
      buildUrl({ layer, page, size: pageSize, useBox: true }),
      `${label} p${page}/${totalPages}`,
    );
    all.push(...featuresOf(res));
  }

  // feature.id 기준 중복 제거 (페이지 경계에서 같은 feature 가 반복될 수 있음)
  // id 가 없는 feature 는 비교할 수 없으므로 그대로 둔다.
  const seen = new Set();
  const unique = all.filter((f) => {
    if (f.id === undefined || f.id === null) return true;
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
  console.log(`  받은 ${all.length}건 → 중복 ${all.length - unique.length}건 제거 → ${unique.length}건`);

  return { type: 'FeatureCollection', features: unique };
}

/** 월계동(법정동) 경계를 emd_cd 로 정확히 일치 조회한다 */
async function fetchBoundary() {
  console.log(`\n[경계] ${BOUNDARY_LAYER} (emd_cd=${BOUNDARY_EMD_CD}) 수집 시작`);
  // 이름(like) 검색은 광주 광산구 월계동이 섞이므로 코드로 정확히 조회한다.
  const res = await requestOnce(
    buildUrl({
      layer: BOUNDARY_LAYER,
      page: 1,
      size: 10,
      attrFilter: `emd_cd:=:${BOUNDARY_EMD_CD}`,
      geometry: true,
    }),
    '경계',
  );
  const features = featuresOf(res);
  if (features.length !== 1) {
    console.warn(`  ! 경고: 경계 결과가 ${features.length}건입니다 (정확히 1건이어야 함). boundary.geojson 저장을 건너뜁니다.`);
    return null;
  }
  return { type: 'FeatureCollection', features };
}

/**
 * 월계1동(행정동) 경계를 WFS 로 받는다.
 * WFS 는 응답 형식이 2D데이터 API 와 달라서(바로 GeoJSON FeatureCollection) 별도로 요청한다.
 * bbox 로 주변 행정동을 받은 뒤 adm_cd 가 일치하는 1건만 남긴다.
 */
async function fetchAdminDong() {
  console.log(`\n[행정동 경계] ${ADMIN_DONG_LAYER} (adm_cd=${ADMIN_DONG_CD}) 수집 시작`);
  const params = new URLSearchParams({
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: ADMIN_DONG_LAYER,
    // WFS 1.1.0 + EPSG:4326 은 표준상 (위도, 경도) 축 순서라서 BBOX 를 남,서,북,동 으로 넣는다.
    // (테스트에서는 경도,위도 순서로 넣어도 같은 결과가 왔지만 표준 순서를 따른다)
    BBOX: `${SOUTH},${WEST},${NORTH},${EAST}`,
    SRSNAME: 'EPSG:4326', // 응답 좌표는 GeoJSON 규칙대로 [경도, 위도] 로 온다 (테스트로 확인)
    OUTPUT: 'application/json',
    MAXFEATURES: '100',
    KEY: VWORLD_KEY,
    DOMAIN: VWORLD_DOMAIN,
  });
  const url = `${WFS_URL}?${params.toString()}`;

  let json;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  요청 [행정동] ${mask(url)}${attempt > 1 ? ` (재시도 ${attempt - 1})` : ''}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const body = await res.text();
      try {
        json = JSON.parse(body);
      } catch {
        // WFS 오류는 JSON 이 아니라 XML(ExceptionReport)로 온다 → 원문 일부를 보여준다
        throw new Error(`JSON 이 아닌 응답(오류일 가능성): ${mask(body.slice(0, 300))}`);
      }
      break;
    } catch (e) {
      console.warn(`  ! 실패 (${attempt}/${MAX_RETRIES}): ${mask(e.message)}`);
      if (attempt === MAX_RETRIES) throw e;
      await sleep(REQUEST_INTERVAL_MS * attempt);
    }
  }

  const features = (json.features ?? []).filter((f) => f.properties?.adm_cd === ADMIN_DONG_CD);
  if (features.length !== 1) {
    console.warn(`  ! 경고: 행정동 경계 결과가 ${features.length}건입니다 (정확히 1건이어야 함). admin_dong.geojson 저장을 건너뜁니다.`);
    return null;
  }
  console.log(`  ${features[0].properties.adm_nm} (기준일 ${features[0].properties.base_date})`);
  return { type: 'FeatureCollection', features };
}

async function save(name, fc) {
  const file = path.join(DATA_DIR, name);
  await writeFile(file, JSON.stringify(fc), 'utf8');
  return file;
}

// ---------------------------------------------------------------------
// 영역 레이어 (산, 하천, 학교, 아파트 단지)
// ---------------------------------------------------------------------

/** 레이어를 받아 조건에 맞는 feature 만 남긴다 */
async function fetchFiltered(layer, label, keep) {
  const fc = await fetchAllPages(layer, label);
  const features = fc.features.filter(keep);
  console.log(`  조건에 맞는 ${features.length}건만 사용`);
  return { type: 'FeatureCollection', features };
}

/** Polygon / MultiPolygon 을 [폴리곤[링[좌표]]] 형태로 통일 (좌표는 [경도, 위도]) */
const polygonsOf = (g) => (g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []);

/**
 * 건물의 대표점: 첫 외곽 링 꼭짓점들의 평균.
 * 무게중심은 아니지만 건물처럼 작고 볼록한 도형은 거의 항상 자기 안에 들어온다.
 * 링의 마지막 좌표는 첫 좌표와 같으므로(GeoJSON 규칙) 평균에서 뺀다.
 */
function representativePoint(geometry) {
  const ring = polygonsOf(geometry)[0]?.[0];
  if (!ring || ring.length < 2) return null;
  const pts = ring.slice(0, -1);
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length; // 경도
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length; // 위도
  return [x, y];
}

/** 점이 링 안에 있는지 (ray casting). 점과 링 모두 [경도, 위도] 순서 */
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 점이 (Multi)Polygon 안에 있는지. 구멍(두 번째 링부터) 안이면 밖으로 본다 */
function inPolygon(point, geometry) {
  return polygonsOf(geometry).some(
    ([outer, ...holes]) => inRing(point, outer) && !holes.some((h) => inRing(point, h)),
  );
}

/** 두 점([경도, 위도]) 사이 거리(m) */
function distanceM(a, b) {
  const [ax, ay] = toMeters(a);
  const [bx, by] = toMeters(b);
  return Math.hypot(bx - ax, by - ay);
}

/** 도로명주소 건물의 주소 키 (같은 단지 묶음의 기준). 예: "노원구 월계동 광운로17길 45-3" */
function roadAddressKey(p) {
  return [p?.sigungu, p?.gu, p?.rd_nm, p?.buld_no].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ');
}

/** 건물명에서 "…아파트" 까지만 잘라 단지명으로 쓴다. 예: "새봄아파트관리실" → "새봄아파트" */
function apartmentNameFrom(text) {
  const m = String(text ?? '').match(/^(.*?아파트)/);
  return m ? m[1].trim() : '';
}

/**
 * 아파트 단지 영역을 계산한다. (맨 위 상수 설명 참고) 네트워크 없이 데이터만으로 계산하는 순수 함수.
 *   spbd    : 도로명주소 건물 FeatureCollection
 *   bldg    : 건축물정보 FeatureCollection
 *   parcels : 연속지적도 FeatureCollection
 * 반환: { complexes: FeatureCollection, excluded: [제외된 묶음 설명] }
 * 결과 feature 의 properties 는 이 스크립트가 만든 값이다:
 *   name(대표 단지명), building_count(묶음의 건물 수), max_floors(최고 층수),
 *   address(대표 도로명주소), addresses(묶음의 도로명주소 목록), pnu(필지 고유번호 목록, 쉼표 구분)
 */
export function deriveApartmentComplexes(spbd, bldg, parcels) {
  // 1) 도로명주소 건물을 주소별로 묶는다
  const groups = new Map();
  const spbdPoints = [];
  for (const f of spbd.features) {
    const key = roadAddressKey(f.properties);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { key, buildings: [], names: [], nameSignal: false, apts: [] });
    const g = groups.get(key);
    g.buildings.push(f);
    for (const text of [f.properties?.buld_nm, f.properties?.buld_nm_dc]) {
      const n = apartmentNameFrom(text);
      if (n) {
        g.names.push(n);
        g.nameSignal = true;
      }
    }
    const pt = representativePoint(f.geometry);
    if (pt) spbdPoints.push({ pt, f, key });
  }

  // 2) 건축물정보의 공동주택을 도로명주소 건물 묶음에 붙인다.
  //    도형이 겹치는 도로명주소 건물을 먼저 찾고, 없으면 APT_HOST_MAX_M 안의 가장 가까운 건물을 쓴다.
  let unattached = 0;
  for (const b of bldg.features) {
    const p = b.properties || {};
    if (p.usability !== APT_USABILITY) continue;
    // grnd_flr 는 "15" 처럼 문자열로 오므로 숫자로 바꿔 비교한다 ("9" > "15" 같은 문자열 비교 방지)
    const floors = Number(p.grnd_flr) || 0;
    const named = APT_NAME_PATTERN.test(p.bld_nm || '');
    if (floors < APT_MIN_FLOORS && !named) continue;
    const pt = representativePoint(b.geometry);
    if (!pt) continue;

    let host = spbdPoints.find((s) => inPolygon(pt, s.f.geometry));
    if (!host) {
      let best = null;
      for (const s of spbdPoints) {
        const d = distanceM(pt, s.pt);
        if (d <= APT_HOST_MAX_M && (!best || d < best.d)) best = { d, s };
      }
      host = best?.s;
    }
    if (!host) {
      unattached++;
      continue;
    }
    const g = groups.get(host.key);
    g.apts.push({ floors, named });
    // "월계동 544" 처럼 주소 형태인 건물명은 단지명으로 쓰지 않는다
    const nm = String(p.bld_nm || '').trim();
    if (nm && !/^\S+동\s*\d/.test(nm)) g.names.push(nm);
  }
  if (unattached) console.log(`  도로명주소 건물에 붙이지 못한 공동주택: ${unattached}동 (무시)`);

  // 3) 단지 조건 검사
  const qualified = [];
  const excluded = [];
  for (const g of groups.values()) {
    const tower = g.apts.some((a) => a.floors >= APT_TOWER_MIN_FLOORS || a.named);
    const multi = g.apts.filter((a) => a.floors >= APT_MIN_FLOORS).length >= APT_MIN_BUILDINGS;
    if (g.nameSignal || tower || multi) qualified.push(g);
    else if (g.apts.length) {
      const maxF = Math.max(...g.apts.map((a) => a.floors));
      excluded.push(`${g.key} (${g.names[0] || '이름 없음'}, 공동주택 ${g.apts.length}동, 최고 ${maxF}층)`);
    }
  }

  // 4) 묶음마다 건물이 놓인 필지를 찾고, 필지를 공유하는 묶음끼리 합친다 (union-find)
  const parent = qualified.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const parcelOwner = new Map(); // pnu → 묶음 index
  const groupParcels = qualified.map(() => new Map());
  qualified.forEach((g, i) => {
    for (const b of g.buildings) {
      const pt = representativePoint(b.geometry);
      const parcel = pt && parcels.features.find((c) => inPolygon(pt, c.geometry));
      if (!parcel) continue;
      const pnu = parcel.properties?.pnu ?? String(parcel.id);
      groupParcels[i].set(pnu, parcel);
      if (parcelOwner.has(pnu)) parent[find(i)] = find(parcelOwner.get(pnu));
      else parcelOwner.set(pnu, i);
    }
  });

  const merged = new Map();
  qualified.forEach((g, i) => {
    const root = find(i);
    if (!merged.has(root)) merged.set(root, { groups: [], parcels: new Map() });
    const m = merged.get(root);
    m.groups.push(g);
    for (const [pnu, parcel] of groupParcels[i]) m.parcels.set(pnu, parcel);
  });

  // 5) 단지 feature 만들기. 영역 = 필지 도형들을 하나의 MultiPolygon 으로 모은 것
  const features = [];
  for (const { groups: gs, parcels: ps } of merged.values()) {
    if (!ps.size) continue;
    const counts = {};
    for (const n of gs.flatMap((g) => g.names)) counts[n] = (counts[n] || 0) + 1;
    const name = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const buildings = gs.flatMap((g) => g.buildings);
    const maxFloors = Math.max(
      0,
      ...buildings.map((b) => Number(b.properties?.gro_flo_co) || 0),
      ...gs.flatMap((g) => g.apts.map((a) => a.floors)),
    );
    // 건물이 가장 많은 주소를 대표 주소로
    const mainGroup = [...gs].sort((a, b) => b.buildings.length - a.buildings.length)[0];
    const pnus = [...ps.keys()].sort();
    features.push({
      type: 'Feature',
      id: `apt.${pnus[0]}`,
      geometry: { type: 'MultiPolygon', coordinates: [...ps.values()].flatMap((p) => polygonsOf(p.geometry)) },
      properties: {
        name,
        building_count: buildings.length,
        max_floors: maxFloors,
        address: mainGroup.key,
        addresses: gs.map((g) => g.key).join(', '),
        pnu: pnus.join(','),
      },
    });
  }
  return { complexes: { type: 'FeatureCollection', features }, excluded };
}

/** 지적을 받아 아파트 단지를 계산한다 (도로명주소 건물·건축물정보는 이미 받은 것을 넘겨받음) */
async function fetchApartmentComplexes(spbd, bldg) {
  if (!bldg) throw new Error('건축물정보가 없어 아파트 단지를 계산할 수 없습니다');
  const parcels = await fetchAllPages(PARCEL_LAYER, '지적');

  const { complexes, excluded } = deriveApartmentComplexes(spbd, bldg, parcels);
  console.log(`  아파트 단지로 추정: ${complexes.features.length}곳`);
  // 규칙에 "걸린 것"만이 아니라 "빠진 것"도 확인할 수 있게 출력
  console.log(`  공동주택이 있지만 규칙상 제외된 주소: ${excluded.length}곳 (6~9층 1개 동, 이름에 "아파트" 없음)`);
  for (const e of excluded) console.log(`    - ${e}`);
  return complexes;
}

/**
 * 학교 부지 안에 있는 건축물정보 건물을 골라 학교 시설 파일로 만든다.
 * 건물 종류(체육관, 교사동 등) 분류는 화면 쪽 normalizeSchoolFacility 에서 한다.
 * 원본 속성은 그대로 두고 school_name(학교 부지의 시설명)만 덧붙인다.
 * ※ 운동장은 브이월드 어느 레이어에도 별도 영역으로 없어서 만들 수 없다.
 */
function deriveSchoolFacilities(bldg, schools) {
  const features = [];
  for (const b of bldg.features) {
    const pt = representativePoint(b.geometry);
    if (!pt) continue;
    const school = schools.features.find((s) => inPolygon(pt, s.geometry));
    if (!school) continue;
    features.push({ ...b, properties: { ...b.properties, school_name: school.properties?.dgm_nm ?? '' } });
  }
  console.log(`  학교 부지 안 건물: ${features.length}동`);
  return { type: 'FeatureCollection', features };
}

/**
 * 영역 레이어 하나를 받아 저장하고 FeatureCollection 을 돌려준다.
 * 실패해도 전체를 멈추지 않고 경고 후 null 을 돌려준다.
 * (건물·도로가 핵심이고, 영역은 없어도 지도가 그려지므로)
 */
async function collectOptional(fileName, label, task) {
  await sleep(REQUEST_INTERVAL_MS);
  try {
    const fc = await task();
    await save(fileName, fc);
    return fc;
  } catch (e) {
    console.warn(`  ! ${label} 수집 실패: ${mask(e.message)} — ${fileName} 저장을 건너뜁니다.`);
    return null;
  }
}

// ---------------------------------------------------------------------
// 도로중심선 + 도로명 붙이기 + 단지 내 도로 표시
// ---------------------------------------------------------------------

// 위경도 차이를 미터로 바꾸는 근사 계수 (위도 37.62° 기준).
// 경도 1도의 길이는 위도에 따라 줄어들므로 cos(위도)를 곱한다. 2km 범위에서는 오차가 무시할 만하다.
const M_PER_DEG_LNG = 111320 * Math.cos((37.62 * Math.PI) / 180);
const M_PER_DEG_LAT = 110540;
/** [경도, 위도] → 평면 미터 좌표 [x, y] */
const toMeters = ([lng, lat]) => [lng * M_PER_DEG_LNG, lat * M_PER_DEG_LAT];

/** LineString / MultiLineString 을 [선[좌표]] 형태로 통일 */
const linesOf = (g) => (g?.type === 'LineString' ? [g.coordinates] : g?.type === 'MultiLineString' ? g.coordinates : []);

/** 선의 길이 기준 중간점 [경도, 위도] (꼭짓점 평균보다 선 위에 정확히 놓인다) */
function lineMidpoint(line) {
  const lens = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = toMeters(line[i - 1]);
    const [bx, by] = toMeters(line[i]);
    const d = Math.hypot(bx - ax, by - ay);
    lens.push(d);
    total += d;
  }
  let half = total / 2;
  for (let i = 0; i < lens.length; i++) {
    if (half <= lens[i]) {
      const t = lens[i] ? half / lens[i] : 0;
      return [line[i][0] + t * (line[i + 1][0] - line[i][0]), line[i][1] + t * (line[i + 1][1] - line[i][1])];
    }
    half -= lens[i];
  }
  return line[0];
}

/** 점 p 와 선분 a-b 사이의 거리(m) */
function distToSegmentM(p, a, b) {
  const [px, py] = toMeters(p);
  const [ax, ay] = toMeters(a);
  const [bx, by] = toMeters(b);
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/**
 * 도로중심선에 파생 속성을 붙인다. (원본 속성은 그대로 두고, 이 스크립트가 만든 값만 추가)
 *   matched_rn   : 가까운 도로명주소 도로의 도로명 (없으면 '')
 *   complex_name : 단지 안 도로이면 단지 이름, 아니면 ''
 *   in_complex   : 아파트 단지 영역 안에 있고 도로명이 없는 구간이면 true
 *                  (도로명이 붙은 구간은 단지를 지나가는 공공 도로로 보고 제외)
 *   school_name  : 학교 안 도로이면 학교 시설명, 아니면 ''
 *   in_school    : 학교 부지 안에 있고 도로명이 없는 구간이면 true (단지 내 도로가 우선)
 */
function enrichCenterlines(centerlines, namedRoads, apartments, schools) {
  // 도로명 선분을 미리 펼쳐 두고, 바운딩 박스로 빠르게 걸러낸다
  const segments = [];
  for (const f of namedRoads.features) {
    const rn = (f.properties?.rn || '').trim();
    if (!rn) continue;
    for (const line of linesOf(f.geometry)) {
      for (let i = 1; i < line.length; i++) segments.push({ a: line[i - 1], b: line[i], rn });
    }
  }
  // 10m ≈ 경도 0.000113°, 위도 0.00009°. 넉넉하게 0.0002° 로 1차 필터
  const PAD = 0.0002;

  // 단지마다 "단지 내 도로가 하나라도 있는지" 표시 (아래에서 찾으면 true 로 바꾼다)
  for (const a of apartments?.features ?? []) a.properties.has_inner_roads = false;

  let named = 0;
  let inComplex = 0;
  let inSchool = 0;
  for (const f of centerlines.features) {
    const line = linesOf(f.geometry)[0];
    if (!line || line.length < 2) continue;
    const mid = lineMidpoint(line);

    let best = { d: Infinity, rn: '' };
    for (const s of segments) {
      if (mid[0] < Math.min(s.a[0], s.b[0]) - PAD || mid[0] > Math.max(s.a[0], s.b[0]) + PAD) continue;
      if (mid[1] < Math.min(s.a[1], s.b[1]) - PAD || mid[1] > Math.max(s.a[1], s.b[1]) + PAD) continue;
      const d = distToSegmentM(mid, s.a, s.b);
      if (d < best.d) best = { d, rn: s.rn };
    }
    const matchedRn = best.d <= NAME_MATCH_MAX_M ? best.rn : '';

    const complex = matchedRn ? null : apartments?.features.find((a) => inPolygon(mid, a.geometry));
    const school = matchedRn || complex ? null : schools?.features.find((s) => inPolygon(mid, s.geometry));

    f.properties = {
      ...f.properties,
      matched_rn: matchedRn,
      in_complex: Boolean(complex),
      complex_name: complex ? complex.properties?.name || '' : '',
      in_school: Boolean(school),
      school_name: school ? school.properties?.dgm_nm || '' : '',
    };
    if (matchedRn) named++;
    if (school) inSchool++;
    if (complex) {
      inComplex++;
      complex.properties.has_inner_roads = true;
    }
  }
  console.log(`  도로명 붙음: ${named}건 / 단지 내 도로: ${inComplex}건 / 학교 안 도로: ${inSchool}건 / 전체 ${centerlines.features.length}건`);

  // 단지(필지) 단위로 센다. 이름으로 묶으면 같은 이름의 여러 필지·이름 없는 단지가 합쳐져 적게 나온다.
  const withRoads = (apartments?.features ?? []).filter((a) => a.properties.has_inner_roads).length;
  console.log(`  단지 내 도로가 있는 단지: ${withRoads}곳 / ${apartments?.features.length ?? 0}곳 (나머지 단지는 원본에 단지 내 도로가 없음)`);
  return centerlines;
}

// ---------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------
async function main() {
  const started = Date.now();
  console.log(`조회 범위: 남 ${SOUTH}, 서 ${WEST}, 북 ${NORTH}, 동 ${EAST}`);
  console.log(`도메인: ${VWORLD_DOMAIN}`);

  await mkdir(DATA_DIR, { recursive: true });

  const buildings = await fetchAllPages(BUILDING_LAYER, '건물');
  await save('buildings.geojson', buildings);

  // 도로명주소 도로: 필수. 중심선에 이름을 붙이는 데 쓰고, 중심선이 실패하면 이것을 그대로 그린다
  await sleep(REQUEST_INTERVAL_MS);
  const namedRoads = await fetchAllPages(ROAD_LAYER, '도로명');

  // 경계는 실패해도 건물 결과는 이미 저장되어 있으므로 경고만 남긴다
  await sleep(REQUEST_INTERVAL_MS);
  let boundary = null;
  try {
    boundary = await fetchBoundary();
    if (boundary) await save('boundary.geojson', boundary);
  } catch (e) {
    console.warn(`  ! 경계 수집 실패: ${mask(e.message)} — 경계 저장을 건너뜁니다.`);
  }

  // 월계1동(행정동) 경계 — 실패해도 계속 진행
  await sleep(REQUEST_INTERVAL_MS);
  let adminDong = null;
  try {
    adminDong = await fetchAdminDong();
    if (adminDong) await save('admin_dong.geojson', adminDong);
  } catch (e) {
    console.warn(`  ! 행정동 경계 수집 실패: ${mask(e.message)} — admin_dong.geojson 저장을 건너뜁니다.`);
  }

  // 건축물정보: 아파트 단지 판정과 학교 시설 양쪽에 쓰므로 한 번만 받는다 (실패해도 계속 진행)
  await sleep(REQUEST_INTERVAL_MS);
  let bldgInfo = null;
  try {
    bldgInfo = await fetchAllPages(BLDGINFO_LAYER, '건축물정보');
  } catch (e) {
    console.warn(`  ! 건축물정보 수집 실패: ${mask(e.message)} — 아파트 단지·학교 시설을 건너뜁니다.`);
  }

  // 영역 레이어들 (각각 실패해도 계속 진행)
  const areas = {
    'water.geojson': await collectOptional('water.geojson', '하천', () =>
      fetchFiltered(WATER_LAYER, '하천', () => true)),
    'mountains.geojson': await collectOptional('mountains.geojson', '산림', () =>
      fetchFiltered(FOREST_LAYER, '산림', (f) => !FOREST_EXCLUDE_NAMES.includes(f.properties?.name))),
    'schools.geojson': await collectOptional('schools.geojson', '학교', () =>
      fetchFiltered(FACILITY_LAYER, '학교', (f) => f.properties?.lcl_nam === SCHOOL_LCL_NAM)),
    'apartments.geojson': await collectOptional('apartments.geojson', '아파트 단지', () =>
      fetchApartmentComplexes(buildings, bldgInfo)),
  };

  // 학교 시설 (학교 부지 + 건축물정보가 모두 있어야 계산 가능)
  let schoolFacilities = null;
  if (areas['schools.geojson'] && bldgInfo) {
    console.log('\n[학교 시설] 학교 부지 안 건물 계산');
    schoolFacilities = deriveSchoolFacilities(bldgInfo, areas['schools.geojson']);
    await save('school_facilities.geojson', schoolFacilities);
  }

  // 도로중심선 (단지 판정에 아파트 영역이 필요하므로 영역 다음에 처리)
  await sleep(REQUEST_INTERVAL_MS);
  let roads;
  let roadSource;
  try {
    const centerlines = await fetchAllPages(CENTERLINE_LAYER, '도로중심선');
    roads = enrichCenterlines(centerlines, namedRoads, areas['apartments.geojson'], areas['schools.geojson']);
    roadSource = `도로중심선(${CENTERLINE_LAYER}) + 도로명`;
    // 단지마다 has_inner_roads 가 붙었으므로 아파트 단지 파일을 다시 저장
    if (areas['apartments.geojson']) await save('apartments.geojson', areas['apartments.geojson']);
  } catch (e) {
    console.warn(`  ! 도로중심선 수집 실패: ${mask(e.message)} — 도로명주소 도로로 대신 저장합니다.`);
    roads = namedRoads;
    roadSource = `도로명주소 도로(${ROAD_LAYER})`;
  }
  await save('roads.geojson', roads);

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log('\n========== 결과 ==========');
  console.log(`public/data/vworld/buildings.geojson : ${buildings.features.length}개`);
  console.log(`public/data/vworld/roads.geojson     : ${roads.features.length}개 — ${roadSource}`);
  console.log(`public/data/vworld/boundary.geojson  : ${boundary ? `${boundary.features.length}개` : '저장 안 함'}`);
  console.log(`public/data/vworld/admin_dong.geojson: ${adminDong ? `${adminDong.features.length}개` : '저장 안 함'}`);
  console.log(`public/data/vworld/school_facilities.geojson: ${schoolFacilities ? `${schoolFacilities.features.length}개` : '저장 안 함'}`);
  for (const [file, fc] of Object.entries(areas)) {
    console.log(`public/data/vworld/${file.padEnd(18)}: ${fc === null ? '저장 안 함' : `${fc.features.length}개`}`);
  }
  console.log(`첫 도로 geometry.type  : ${roads.features[0]?.geometry?.type ?? '(도로 없음)'}`);
  console.log(`실제 사용한 size       : ${pageSize}`);
  console.log(`소요 시간              : ${seconds}초`);
}

// 직접 실행할 때만 수집한다. (다른 스크립트가 deriveApartmentComplexes 만 가져다 시험할 수 있도록)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`\n수집 중단: ${mask(e?.stack || e)}`);
    process.exit(1);
  });
}
