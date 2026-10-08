// =====================================================================
// 소상공인시장진흥공단 상가(상권)정보 API 로 월계1동 가게(상가업소)를 받아
// scripts/.data/sbiz-stores.geojson 으로 저장하는 스크립트. (git 에 넣지 않는 작업 파일)
// 받은 가게는 npm run import:stores 로 DB(stores 표)에 넣는다. 앱은 DB 에서만 가게를 읽는다.
// (지도 테스트 워크스페이스 V_World_OSM/scripts/fetch-sbiz.js 를 옮겨 온 것. 바꾼 곳: 읽고 저장하는 위치, 키 이름, 대체 조회 범위)
//
// 실행: frontend 폴더에서 npm run fetch:sbiz → npm run import:stores
//   (먼저 npm run fetch:vworld 로 월계1동 경계·건물·단지 데이터를 받아 둬야 한다)
//
// 인증키: frontend/.env.local 의 SBIZ_KEY (또는 SBIZ_SERVICE_KEY). 공공데이터포털 Decoding 키
//   - URLSearchParams 가 주소를 만들 때 인코딩하므로 원래 형태(Decoding) 키가 필요하다.
//   - 혹시 Encoding 키(%가 들어간 형태)를 넣었으면 여기서 먼저 원래 형태로 되돌린다.
//
// 저장하는 가게 속성: API 원본 필드 중 지도에 쓰는 것만 남기고, 이 스크립트가 만든
//   complex_id / complex_name (가게 좌표가 들어가는 아파트 단지) 를 덧붙인다.
// =====================================================================

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------
// 설정
// ---------------------------------------------------------------------
const SBIZ_URL = 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRectangle'; // 사각형내 상가업소 조회
const ADONG_CD = '11350560';   // 월계1동 행정동코드 (이 API 기준. 브이월드 센서스 경계의 코드와는 체계가 다르다)
const ADONG_NAME = '월계1동';
const PAGE_SIZE = 1000;        // 한 번에 받는 건수 (1000 으로 시험해 정상 응답 확인)
const REQUEST_INTERVAL_MS = 600;
const MAX_RETRIES = 3;
// 경계 파일이 없을 때 쓸 조회 범위: 월계1동을 감싸는 직사각형 (scripts/fetch-vworld.js 의 WOLGYE1_RECT 와 같은 값)
const FALLBACK_BOX = { minx: 127.04973988, miny: 37.61426899, maxx: 127.06596365, maxy: 37.6301994 };
// 월계1동 경계 사각형에 더할 여유 (도). 경계에 걸친 가게를 놓치지 않기 위함
const BOX_PAD = 0.0005;

// 저장할 원본 필드 (API 응답의 필드 이름 그대로)
const KEEP_FIELDS = [
  'bizesId', 'bizesNm', 'brchNm',
  'indsLclsCd', 'indsLclsNm', 'indsMclsNm', 'indsSclsNm',
  'adongCd', 'adongNm', 'lnoCd', 'lnoAdr', 'rdnmAdr',
  'bldMngNo', 'bldNm', 'flrNo', 'hoNo',
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 브이월드 수집 결과(경계·단지·건물)를 읽는 곳과, 가게 결과를 저장하는 곳
const VWORLD_DIR = path.resolve(__dirname, '..', 'public', 'data', 'vworld');
const DATA_DIR = path.resolve(__dirname, '.data');
const OUTPUT_FILE = 'sbiz-stores.geojson';

// ---------------------------------------------------------------------
// 인증키
// ---------------------------------------------------------------------
let SBIZ_KEY = (process.env.SBIZ_KEY || process.env.SBIZ_SERVICE_KEY || '').trim();
if (!SBIZ_KEY) {
  console.error('SBIZ_KEY(또는 SBIZ_SERVICE_KEY)가 없습니다. frontend/.env.local 파일을 확인하세요');
  process.exit(1);
}
if (SBIZ_KEY.includes('%')) SBIZ_KEY = decodeURIComponent(SBIZ_KEY); // Encoding 키를 넣은 경우

/** 콘솔에 찍히는 문자열에서 키를 **** 로 가린다 (원래 형태·인코딩된 형태 모두) */
function mask(text) {
  return String(text).split(SBIZ_KEY).join('****').split(encodeURIComponent(SBIZ_KEY)).join('****');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------
// 기하 (단지 안 가게 판정용)
// ---------------------------------------------------------------------
const polygonsOf = (g) => (g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []);
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPolygon = (pt, g) => polygonsOf(g).some(([outer, ...holes]) => inRing(pt, outer) && !holes.some((h) => inRing(pt, h)));

// ---------------------------------------------------------------------
// API
// ---------------------------------------------------------------------
async function fetchPage(box, pageNo) {
  const params = new URLSearchParams({
    serviceKey: SBIZ_KEY,
    type: 'json',
    pageNo: String(pageNo),
    numOfRows: String(PAGE_SIZE),
    // 이 API 의 사각형은 x=경도, y=위도 (minx=서, miny=남, maxx=동, maxy=북)
    minx: String(box.minx), miny: String(box.miny), maxx: String(box.maxx), maxy: String(box.maxy),
  });
  const url = `${SBIZ_URL}?${params}`;
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  요청 p${pageNo} ${mask(url)}${attempt > 1 ? ` (재시도 ${attempt - 1})` : ''}`);
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        // 키 오류 등은 XML 로 오는 경우가 있다
        throw new Error(`JSON 이 아닌 응답(HTTP ${res.status}): ${mask(text.replace(/\s+/g, ' ').slice(0, 200))}`);
      }
      const h = json.header ?? {};
      if (h.resultCode !== '00') throw new Error(`API 오류 ${h.resultCode}: ${mask(h.resultMsg)}`);
      return { items: json.body?.items ?? [], total: Number(json.body?.totalCount ?? 0), stdrYm: h.stdrYm ?? '' };
    } catch (e) {
      lastError = e;
      console.warn(`  ! 실패 (${attempt}/${MAX_RETRIES}): ${mask(e.message)}`);
      if (attempt < MAX_RETRIES) await sleep(REQUEST_INTERVAL_MS * attempt * 2);
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------
async function main() {
  const started = Date.now();
  const readJson = async (name) => {
    try {
      return JSON.parse(await readFile(path.join(VWORLD_DIR, name), 'utf8'));
    } catch {
      return null;
    }
  };

  // 조회 사각형: 월계1동 경계의 바깥 사각형 (+여유). 경계 파일이 없으면 지도 조회 범위
  const adminDong = await readJson('admin_dong.geojson');
  let box = FALLBACK_BOX;
  if (adminDong?.features?.[0]) {
    const pts = polygonsOf(adminDong.features[0].geometry).flat(2);
    box = {
      minx: Math.min(...pts.map((p) => p[0])) - BOX_PAD, miny: Math.min(...pts.map((p) => p[1])) - BOX_PAD,
      maxx: Math.max(...pts.map((p) => p[0])) + BOX_PAD, maxy: Math.max(...pts.map((p) => p[1])) + BOX_PAD,
    };
  } else {
    console.warn('  ! public/data/vworld/admin_dong.geojson 이 없어 월계1동 직사각형으로 받습니다.');
  }

  console.log(`[상가] 소상공인 상가(상권)정보 — ${ADONG_NAME} 가게 받기`);
  const all = [];
  let total = Infinity;
  let stdrYm = '';
  for (let page = 1; (page - 1) * PAGE_SIZE < total; page++) {
    const r = await fetchPage(box, page);
    total = r.total;
    stdrYm = r.stdrYm || stdrYm;
    all.push(...r.items);
    console.log(`  ${page}페이지: ${r.items.length}건 (사각형 안 전체 ${total}건)`);
    if (!r.items.length) break;
    await sleep(REQUEST_INTERVAL_MS);
  }

  // 사각형에는 이웃 동 가게도 들어오므로 월계1동 코드로 거른다
  const stores = all.filter((s) => s.adongCd === ADONG_CD);
  console.log(`  ${ADONG_NAME}: ${stores.length}곳 (데이터 기준월 ${stdrYm || '알 수 없음'})`);

  // 가게 좌표가 들어가는 아파트 단지
  const apartments = await readJson('apartments.geojson');
  const complexes = apartments?.features ?? [];

  const features = [];
  for (const s of stores) {
    // lon, lat 은 숫자로 온다. 혹시 문자열이어도 되도록 Number() 로 변환
    const lon = Number(s.lon);
    const lat = Number(s.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const props = {};
    for (const k of KEEP_FIELDS) if (s[k] !== undefined && s[k] !== null && s[k] !== '') props[k] = s[k];
    const complex = complexes.find((c) => inPolygon([lon, lat], c.geometry));
    if (complex) {
      props.complex_id = complex.id;
      props.complex_name = complex.properties?.name || '';
    }
    // GeoJSON 좌표는 [경도, 위도] 순서
    features.push({ type: 'Feature', id: `sbiz.${s.bizesId}`, geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props });
  }

  const fc = { type: 'FeatureCollection', stdrYm, features };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, OUTPUT_FILE), JSON.stringify(fc), 'utf8');

  // 확인용 통계
  const byCat = {};
  for (const f of features) byCat[f.properties.indsLclsNm] = (byCat[f.properties.indsLclsNm] || 0) + 1;
  const buildings = await readJson('buildings.geojson');
  const buildingIds = new Set((buildings?.features ?? []).map((b) => b.properties?.bd_mgt_sn));
  const linked = features.filter((f) => buildingIds.has(f.properties.bldMngNo)).length;
  const inComplex = features.filter((f) => f.properties.complex_id).length;

  console.log('\n========== 결과 ==========');
  console.log(`scripts/.data/${OUTPUT_FILE} : ${features.length}곳 (${ADONG_NAME}, 기준월 ${stdrYm})`);
  console.log(`업종 대분류         : ${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`건물과 연결         : ${linked}곳 (건물관리번호 일치) / 연결 안 됨 ${features.length - linked}곳 → 지도에 점으로 표시`);
  console.log(`아파트 단지 안 가게 : ${inComplex}곳`);
  console.log(`소요 시간           : ${((Date.now() - started) / 1000).toFixed(1)}초`);
  console.log('\n다음 단계: npm run import:stores 로 DB 에 넣는다.');
}

main().catch((e) => {
  console.error(`\n상가 수집 중단: ${mask(e?.stack || e)}`);
  process.exit(1);
});
