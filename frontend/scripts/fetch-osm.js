// =====================================================================
// OpenStreetMap(Overpass API)에서 월계1동 일대의 도로·철도를 받아
// public/data/osm/roads.geojson, public/data/osm/railways.geojson 으로 저장하는 스크립트.
//
// 실행: frontend 폴더에서 npm run fetch:osm   (인증키가 필요 없다)
//
// - 조회 범위: 지도 범위(src/shared/map/vworld/mapExtent.ts 의 MAP_EXTENT)에서 사방 300m 더 넓게.
//   브이월드 수집(scripts/fetch-vworld.js)과 같은 규칙이다.
// - 저장하는 속성: OSM 태그 중 지도에 쓰는 것만 (아래 ROAD_TAGS, RAIL_TAGS). 원래 태그 이름 그대로.
// - 화면(src/shared/map)은 이 파일만 읽는다. 속성 해석은 src/shared/map/osm/normalize.ts 에서만 한다.
// - 데이터 © OpenStreetMap contributors (ODbL). 지도 아래 출처에 표시한다.
// =====================================================================

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_EXTENT } from '../src/shared/map/vworld/mapExtent.ts';

// ---------------------------------------------------------------------
// 설정
// ---------------------------------------------------------------------
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const DATA_MARGIN_M = 300;
const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LNG = 111320 * Math.cos((((MAP_EXTENT.south + MAP_EXTENT.north) / 2) * Math.PI) / 180);
const round6 = (n) => Math.round(n * 1e6) / 1e6;
const BOX = {
  south: round6(MAP_EXTENT.south - DATA_MARGIN_M / M_PER_DEG_LAT),
  west: round6(MAP_EXTENT.west - DATA_MARGIN_M / M_PER_DEG_LNG),
  north: round6(MAP_EXTENT.north + DATA_MARGIN_M / M_PER_DEG_LAT),
  east: round6(MAP_EXTENT.east + DATA_MARGIN_M / M_PER_DEG_LNG),
};
// 철도 중 지도에 그릴 종류 (폐선·공사 중은 뺀다. 경춘선 숲길은 폐선이라 도로/길로만 나온다)
const RAIL_KINDS = ['rail', 'subway', 'light_rail', 'narrow_gauge'];
const ROAD_TAGS = ['highway', 'name', 'ref', 'lanes', 'width', 'oneway', 'bridge', 'tunnel', 'layer', 'service', 'area'];
const RAIL_TAGS = ['railway', 'name', 'usage', 'service', 'bridge', 'tunnel', 'layer'];
const MAX_RETRIES = 3;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'public', 'data', 'osm');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------
// Overpass
// ---------------------------------------------------------------------
function buildQuery() {
  const bbox = `${BOX.south},${BOX.west},${BOX.north},${BOX.east}`; // Overpass 는 남,서,북,동 순서
  return `[out:json][timeout:90];
(
  way["highway"](${bbox});
  way["railway"~"^(${RAIL_KINDS.join('|')})$"](${bbox});
);
out tags geom;`;
}

async function fetchOverpass() {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  요청 ${OVERPASS_URL}${attempt > 1 ? ` (재시도 ${attempt - 1})` : ''}`);
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'wolwolgyegye-map-fetch/1.0' },
        body: new URLSearchParams({ data: buildQuery() }),
        signal: AbortSignal.timeout(120_000),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.replace(/\s+/g, ' ').slice(0, 200)}`);
      return JSON.parse(text);
    } catch (e) {
      lastError = e;
      console.warn(`  ! 실패 (${attempt}/${MAX_RETRIES}): ${e.message}`);
      // 서버가 바쁠 때(429·504)가 많아 점점 길게 기다린다
      if (attempt < MAX_RETRIES) await sleep(5000 * attempt);
    }
  }
  throw lastError;
}

/** Overpass way(out geom) → GeoJSON LineString feature. 좌표가 2개 미만이면 null */
function toFeature(way, keepTags) {
  const coords = (way.geometry ?? []).map((p) => [round6(p.lon), round6(p.lat)]); // GeoJSON 은 [경도, 위도]
  if (coords.length < 2) return null;
  const properties = { osm_id: way.id };
  for (const k of keepTags) if (way.tags?.[k] !== undefined) properties[k] = way.tags[k];
  return { type: 'Feature', id: `osm.way.${way.id}`, geometry: { type: 'LineString', coordinates: coords }, properties };
}

// ---------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------
async function main() {
  const started = Date.now();
  console.log(`[OSM] 도로·철도 받기 — 범위: 남 ${BOX.south}, 서 ${BOX.west}, 북 ${BOX.north}, 동 ${BOX.east}`);
  const json = await fetchOverpass();
  const ways = (json.elements ?? []).filter((e) => e.type === 'way');

  const roads = [];
  const railways = [];
  for (const way of ways) {
    if (way.tags?.highway) {
      const f = toFeature(way, ROAD_TAGS);
      if (f) roads.push(f);
    } else if (RAIL_KINDS.includes(way.tags?.railway)) {
      const f = toFeature(way, RAIL_TAGS);
      if (f) railways.push(f);
    }
  }

  await mkdir(DATA_DIR, { recursive: true });
  const timestamp = json.osm3s?.timestamp_osm_base ?? '';
  const save = (name, features) =>
    writeFile(path.join(DATA_DIR, name), JSON.stringify({ type: 'FeatureCollection', timestamp, features }), 'utf8');
  await save('roads.geojson', roads);
  await save('railways.geojson', railways);

  const byHighway = {};
  for (const f of roads) byHighway[f.properties.highway] = (byHighway[f.properties.highway] || 0) + 1;
  const railNames = [...new Set(railways.map((f) => f.properties.name).filter(Boolean))];
  console.log('\n========== 결과 ==========');
  console.log(`public/data/osm/roads.geojson    : ${roads.length}개`);
  console.log(`  종류: ${Object.entries(byHighway).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`public/data/osm/railways.geojson : ${railways.length}개 (지하 구간 ${railways.filter((f) => f.properties.tunnel && f.properties.tunnel !== 'no').length}개는 지도에 안 그림)`);
  console.log(`  노선: ${railNames.join(', ') || '(이름 없음)'}`);
  console.log(`OSM 데이터 기준 시각: ${timestamp || '알 수 없음'}`);
  console.log(`소요 시간: ${((Date.now() - started) / 1000).toFixed(1)}초`);
}

main().catch((e) => {
  console.error(`\nOSM 수집 중단: ${e?.stack || e}`);
  process.exit(1);
});
