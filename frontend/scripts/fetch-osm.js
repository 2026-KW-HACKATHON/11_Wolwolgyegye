// =====================================================================
// OpenStreetMap(Overpass API)에서 월계1동 일대의 도로·철도·지하철역·노선을 받아
// public/data/osm/*.geojson 으로 저장하는 스크립트.
//
// 실행: frontend 폴더에서 npm run fetch:osm   (인증키가 필요 없다)
//
// 저장하는 파일
//   roads.geojson          도로
//   railways.geojson       철도 선로 (차량기지·측선 포함, 실제 선로 모양)
//   subway_lines.geojson   지하철 노선 (노선마다 선 하나. 철도 위에 얇게 겹쳐 그린다)
//   stations.geojson       역 (지나가는 노선 목록 포함)
//   station_exits.geojson  역 출구 (가장 가까운 역에 붙인다)
//
// - 조회 범위: 지도 범위(src/shared/map/vworld/mapExtent.ts 의 MAP_EXTENT)에서 사방 300m 더 넓게.
//   브이월드 수집(scripts/fetch-vworld.js)과 같은 규칙이다.
// - 저장하는 속성: OSM 태그 중 지도에 쓰는 것만 (아래 *_TAGS). 원래 태그 이름 그대로.
//   이 스크립트가 계산해 덧붙인 값(노선 이름·역 노선 목록·출구의 역)은 이름 앞에 line_ / station_ 을 붙인다.
// - 화면(src/shared/map)은 이 파일들만 읽는다. 속성 해석은 src/shared/map/osm/normalize.ts 에서만 한다.
// - 데이터 © OpenStreetMap contributors (ODbL). 지도 아래 출처에 표시한다.
// =====================================================================

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_EXTENT } from '../src/shared/map/vworld/mapExtent.ts';

// ---------------------------------------------------------------------
// 설정
// ---------------------------------------------------------------------
// Overpass 서버. 첫 서버가 바쁘면(429·504·시간 초과) 다음 서버로 바꿔 가며 다시 요청한다
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
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
// 지하철 노선으로 볼 경로: route=subway·light_rail 전부, route=train 은 수도권 전철(경춘선 등)만
const ROUTE_KINDS = ['subway', 'light_rail', 'train'];
const METRO_NETWORK = /수도권|Seoul Metropolitan|광역/i;
// 노선 경로에 적힌 정차 위치가 역에서 이 거리(m) 안이면 그 역에 서는 노선으로 본다
// (정차 위치가 하나도 없는 노선만, 선이 역에서 STATION_LINE_MAX_M 안을 지나가는지로 대신 판단한다)
const STATION_STOP_MAX_M = 300;
const STATION_LINE_MAX_M = 150;
// 출구는 이 거리(m) 안의 가장 가까운 역에 붙인다
const EXIT_STATION_MAX_M = 400;

const ROAD_TAGS = ['highway', 'name', 'ref', 'lanes', 'width', 'oneway', 'bridge', 'tunnel', 'layer', 'service', 'area'];
const RAIL_TAGS = ['railway', 'name', 'usage', 'service', 'bridge', 'tunnel', 'layer'];
const STATION_TAGS = ['name', 'name:en', 'railway', 'station', 'subway'];
const EXIT_TAGS = ['ref', 'name', 'wheelchair'];
const MAX_RETRIES = 4;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'public', 'data', 'osm');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------
// Overpass
// ---------------------------------------------------------------------
const bboxText = () => `${BOX.south},${BOX.west},${BOX.north},${BOX.east}`; // Overpass 는 남,서,북,동 순서

/** 요청 1: 도로·철도 선로·역·출구 (예전부터 쓰던 가벼운 요청) */
function baseQuery() {
  const bbox = bboxText();
  return `[out:json][timeout:120];
(
  way["highway"](${bbox});
  way["railway"~"^(${RAIL_KINDS.join('|')})$"](${bbox});
  node["railway"~"^(station|subway_entrance)$"](${bbox});
);
out tags geom;`;
}

/**
 * 요청 2: 노선 경로(relation). 경로를 이루는 선로 목록이 필요해서 body 로 받고,
 * 선 모양은 범위 안쪽만 받는다 (전국을 달리는 노선도 있어서). 실패해도 요청 1 결과는 저장한다.
 */
function routeQuery() {
  const bbox = bboxText();
  return `[out:json][timeout:180];
relation["route"~"^(${ROUTE_KINDS.join('|')})$"](${bbox});
out body geom(${bbox});`;
}

async function fetchOverpass(label, query) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const url = OVERPASS_URLS[(attempt - 1) % OVERPASS_URLS.length];
    try {
      console.log(`  [${label}] 요청 ${new URL(url).host}${attempt > 1 ? ` (재시도 ${attempt - 1})` : ''}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'wolwolgyegye-map-fetch/1.0' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(200_000),
      });
      const text = await res.text();
      const detail = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
      // 400 은 요청 문장이 틀린 것이라 다시 보내도 같다. 바로 멈추고 내용을 보여준다
      if (res.status === 400) throw Object.assign(new Error(`HTTP 400 (요청 오류): ${detail}`), { fatal: true });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${detail}`);
      return JSON.parse(text);
    } catch (e) {
      lastError = e;
      console.warn(`  ! 실패 (${attempt}/${MAX_RETRIES}): ${e.name === 'TimeoutError' ? '응답 시간 초과' : e.message}`);
      if (e.fatal) break;
      // 서버가 바쁠 때가 많아 점점 길게 기다린다
      if (attempt < MAX_RETRIES) await sleep(10_000 * attempt);
    }
  }
  throw lastError;
}

const pick = (tags, keys) => Object.fromEntries(keys.filter((k) => tags?.[k] !== undefined).map((k) => [k, tags[k]]));

/** Overpass way(out geom) → GeoJSON LineString feature. 좌표가 2개 미만이면 null */
function toLineFeature(way, keepTags) {
  const coords = (way.geometry ?? []).map((p) => [round6(p.lon), round6(p.lat)]); // GeoJSON 은 [경도, 위도]
  if (coords.length < 2) return null;
  return { type: 'Feature', id: `osm.way.${way.id}`, geometry: { type: 'LineString', coordinates: coords }, properties: { osm_id: way.id, ...pick(way.tags, keepTags) } };
}

const toPointFeature = (node, props) => ({
  type: 'Feature', id: `osm.node.${node.id}`, geometry: { type: 'Point', coordinates: [round6(node.lon), round6(node.lat)] }, properties: { osm_id: node.id, ...props },
});

// ---------------------------------------------------------------------
// 거리
// ---------------------------------------------------------------------
const toM = ([lng, lat]) => [lng * M_PER_DEG_LNG, lat * M_PER_DEG_LAT];
function distToSegmentM(p, a, b) {
  const [px, py] = toM(p);
  const [ax, ay] = toM(a);
  const [bx, by] = toM(b);
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
const distM = (a, b) => { const [ax, ay] = toM(a); const [bx, by] = toM(b); return Math.hypot(bx - ax, by - ay); };
const lineLengthM = (coords) => coords.slice(1).reduce((s, c, i) => s + distM(coords[i], c), 0);

// ---------------------------------------------------------------------
// 지하철 노선: 노선(1호선·6호선·경춘선…)마다 경로 relation 하나만 골라 선으로 만든다
// (OSM 은 방향마다 relation 이 따로 있어서 모두 그리면 같은 노선이 두 줄이 된다)
// ---------------------------------------------------------------------
/**
 * 노선 묶음: OSM 은 같은 노선도 운행 계통·급행·방향마다 경로가 따로 있다 (1호선만 해도 여러 개).
 * ref(노선 번호)가 같으면 한 노선으로 묶는다. 이름은 ref 가 숫자면 "N호선", 아니면 경로 이름 앞부분 (예: 경춘선).
 */
function lineKeyOf(tags) {
  const ref = String(tags.ref ?? '').trim();
  if (/^\d+$/.test(ref)) return { key: ref, label: `${ref}호선` };
  const base = String(tags.name ?? '').split(/[:(]/)[0]
    .replace(/^수도권\s*전철\s*/, '').replace(/^서울\s*(지하철|도시철도)\s*/, '').trim();
  const label = base.split(/\s+/)[0]; // "1호선 급행" → "1호선"
  return label ? { key: ref || label, label } : null;
}
const isColour = (v) => /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(v ?? ''));

/** relation 의 선로 부분(정차 위치·승강장 제외)을 선 조각들로. 범위 밖으로 잘린 좌표(null)에서 조각을 나눈다 */
function relationLines(rel) {
  const lines = [];
  for (const m of rel.members ?? []) {
    if (m.type !== 'way' || /platform|stop/.test(m.role ?? '')) continue;
    let current = [];
    for (const p of m.geometry ?? []) {
      if (!p || p.lat === undefined) {
        if (current.length > 1) lines.push(current);
        current = [];
      } else current.push([round6(p.lon), round6(p.lat)]);
    }
    if (current.length > 1) lines.push(current);
  }
  return lines;
}

/** relation 의 정차 위치 (role 이 stop, stop_entry_only, stop_exit_only 인 점) */
const relationStops = (rel) => (rel.members ?? [])
  .filter((m) => m.type === 'node' && /^stop/.test(m.role ?? '') && m.lat !== undefined)
  .map((m) => [m.lon, m.lat]);

/**
 * 노선마다: 선은 범위 안에서 가장 긴 경로 하나(같은 노선이 여러 줄로 그려지지 않게),
 * 정차 위치는 그 노선의 모든 경로에서 모은다 (급행·계통마다 서는 역이 달라서).
 */
function buildSubwayLines(relations) {
  const groups = new Map();
  for (const rel of relations) {
    const t = rel.tags ?? {};
    if (t.route === 'train' && !METRO_NETWORK.test(`${t.network ?? ''} ${t.name ?? ''}`)) continue;
    const id = lineKeyOf(t);
    if (!id) continue;
    const group = groups.get(id.key) ?? { label: id.label, best: null, stops: [] };
    const lines = relationLines(rel);
    const length = lines.reduce((sum, l) => sum + lineLengthM(l), 0);
    if (length && (!group.best || length > group.best.length)) group.best = { rel, lines, length };
    group.stops.push(...relationStops(rel));
    groups.set(id.key, group);
  }
  return [...groups.values()].filter((g) => g.best).map(({ label, best: { rel, lines }, stops }) => ({
    type: 'Feature',
    id: `osm.relation.${rel.id}`,
    geometry: { type: 'MultiLineString', coordinates: lines },
    properties: {
      osm_id: rel.id,
      ...pick(rel.tags, ['route', 'ref', 'network', 'operator']),
      line_label: label,
      line_colour: isColour(rel.tags?.colour) ? rel.tags.colour : '',
    },
    stops, // 저장 전에 뺀다 (역 판단용)
  }));
}

/** 이 노선이 역에 서는지: 정차 위치가 있으면 그것으로, 없으면 선이 가까이 지나가는지로 */
function servesStation(line, point) {
  if (line.stops.length) return line.stops.some((stop) => distM(point, stop) <= STATION_STOP_MAX_M);
  return line.geometry.coordinates.some((l) => l.some((c, i) => i > 0 && distToSegmentM(point, l[i - 1], c) <= STATION_LINE_MAX_M));
}

// ---------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------
async function main() {
  const started = Date.now();
  console.log(`[OSM] 도로·철도·역 받기 — 범위: 남 ${BOX.south}, 서 ${BOX.west}, 북 ${BOX.north}, 동 ${BOX.east}`);
  const json = await fetchOverpass('도로·철도·역', baseQuery());
  let routeElements = [];
  try {
    routeElements = (await fetchOverpass('지하철 노선', routeQuery())).elements ?? [];
  } catch (e) {
    console.warn(`  ! 지하철 노선을 받지 못했습니다 (${e.message}). 도로·철도는 저장하고, 노선·역·출구는 비워 둡니다. 잠시 뒤 다시 실행하세요.`);
  }
  const elements = [...(json.elements ?? []), ...routeElements];

  const roads = [];
  const railways = [];
  for (const way of elements.filter((e) => e.type === 'way')) {
    if (way.tags?.highway) {
      const f = toLineFeature(way, ROAD_TAGS);
      if (f) roads.push(f);
    } else if (RAIL_KINDS.includes(way.tags?.railway)) {
      const f = toLineFeature(way, RAIL_TAGS);
      if (f) railways.push(f);
    }
  }

  const subwayLines = buildSubwayLines(elements.filter((e) => e.type === 'relation'));

  // 역: 지하철 노선이 하나라도 서는 역만 (화물역 등은 뺀다)
  const stations = [];
  for (const node of elements.filter((e) => e.type === 'node' && e.tags?.railway === 'station' && e.tags?.name)) {
    const point = [node.lon, node.lat];
    const lines = subwayLines.filter((line) => servesStation(line, point));
    if (!lines.length) continue;
    stations.push(toPointFeature(node, {
      ...pick(node.tags, STATION_TAGS),
      station_lines: lines.map((l) => l.properties.line_label).join(';'),
      station_colours: lines.map((l) => l.properties.line_colour).join(';'),
    }));
  }
  // 같은 이름의 역이 여러 점이면(노선별로 따로 있는 경우) 하나로 합친다
  const byName = new Map();
  for (const s of stations) {
    const prev = byName.get(s.properties.name);
    if (!prev) { byName.set(s.properties.name, s); continue; }
    const labels = new Set(prev.properties.station_lines.split(';'));
    const colours = prev.properties.station_colours.split(';');
    s.properties.station_lines.split(';').forEach((label, i) => {
      if (labels.has(label)) return;
      labels.add(label);
      colours.push(s.properties.station_colours.split(';')[i]);
    });
    prev.properties.station_lines = [...labels].join(';');
    prev.properties.station_colours = colours.join(';');
  }
  const mergedStations = [...byName.values()];

  // 출구: 가장 가까운 역에 붙인다
  const exits = [];
  for (const node of elements.filter((e) => e.type === 'node' && e.tags?.railway === 'subway_entrance')) {
    let nearest = null;
    for (const s of mergedStations) {
      const d = distM([node.lon, node.lat], s.geometry.coordinates);
      if (d <= EXIT_STATION_MAX_M && (!nearest || d < nearest.d)) nearest = { s, d };
    }
    if (!nearest) continue;
    exits.push(toPointFeature(node, { ...pick(node.tags, EXIT_TAGS), station_id: nearest.s.id, station_name: nearest.s.properties.name }));
  }

  await mkdir(DATA_DIR, { recursive: true });
  const timestamp = json.osm3s?.timestamp_osm_base ?? '';
  const save = (name, features) =>
    writeFile(path.join(DATA_DIR, name), JSON.stringify({ type: 'FeatureCollection', timestamp, features }), 'utf8');
  await save('roads.geojson', roads);
  await save('railways.geojson', railways);
  await save('subway_lines.geojson', subwayLines.map(({ stops, ...feature }) => { void stops; return feature; }));
  await save('stations.geojson', mergedStations);
  await save('station_exits.geojson', exits);

  const byHighway = {};
  for (const f of roads) byHighway[f.properties.highway] = (byHighway[f.properties.highway] || 0) + 1;
  console.log('\n========== 결과 ==========');
  console.log(`roads.geojson         : ${roads.length}개`);
  console.log(`  종류: ${Object.entries(byHighway).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`railways.geojson      : ${railways.length}개 (지하 구간 ${railways.filter((f) => f.properties.tunnel && f.properties.tunnel !== 'no').length}개는 지도에 안 그림)`);
  console.log(`subway_lines.geojson  : ${subwayLines.length}개 — ${subwayLines.map((l) => `${l.properties.line_label}${l.properties.line_colour ? '' : '(색 없음)'}`).join(', ') || '없음'}`);
  console.log(`stations.geojson      : ${mergedStations.length}개 — ${mergedStations.map((s) => `${s.properties.name}(${s.properties.station_lines.replace(/;/g, '·')})`).join(', ') || '없음'}`);
  console.log(`station_exits.geojson : ${exits.length}개`);
  console.log(`OSM 데이터 기준 시각: ${timestamp || '알 수 없음'}`);
  console.log(`소요 시간: ${((Date.now() - started) / 1000).toFixed(1)}초`);
}

main().catch((e) => {
  console.error(`\nOSM 수집 중단: ${e?.stack || e}`);
  process.exit(1);
});
