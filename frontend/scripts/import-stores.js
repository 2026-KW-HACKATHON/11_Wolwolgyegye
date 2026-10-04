// =====================================================================
// 상가정보 가게를 DB(stores 표)에 넣는 스크립트.
//
// 실행: frontend 폴더에서 npm run fetch:sbiz → npm run import:stores
//   읽는 파일: scripts/.data/sbiz-stores.geojson (fetch:sbiz 가 만든 작업 파일)
//
// 필요한 키: frontend/.env.local
//   VITE_SUPABASE_URL      프로젝트 주소 (앱과 같은 값)
//   SUPABASE_SECRET_KEY    sb_secret_ 로 시작하는 관리자 키. 이 스크립트에서만 쓴다.
//                          VITE_ 를 붙이지 않는다 (붙이면 브라우저 코드에 들어간다).
//
// 하는 일
//   1. store_types(대표 유형)를 앱의 그 외 카테고리 목록(src/core/categories/subCategories.ts)으로 맞춘다.
//   2. 가게를 상가업소번호(sbiz_id) 기준으로 넣거나 고친다. 여러 번 실행해도 같은 가게가 두 번 생기지 않는다.
//      - 사장님이 연결된 가게는 사장님이 고친 정보를 지키기 위해 건너뛴다.
//      - 공개 여부(is_published)는 보내지 않는다. 새 가게는 공개로 들어가고, 운영자가 숨긴 가게는 그대로 둔다.
//   3. DB 에는 있는데 이번 상가정보에 없는 가게(폐업 등) 수를 알려준다. 지우지는 않는다.
// =====================================================================

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { SUB_CATEGORIES, subCategoryOfIndustry } from '../src/core/categories/subCategories.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.resolve(__dirname, '.data', 'sbiz-stores.geojson');
const CHUNK = 500;

// ---------------------------------------------------------------------
// 키 (값은 어디에도 출력하지 않는다)
// ---------------------------------------------------------------------
const URL_TEXT = (process.env.VITE_SUPABASE_URL || '').trim();
const SECRET = (process.env.SUPABASE_SECRET_KEY || '').trim();
if (!URL_TEXT || !SECRET) {
  console.error('VITE_SUPABASE_URL 과 SUPABASE_SECRET_KEY 가 필요합니다. frontend/.env.local 을 확인하세요.');
  process.exit(1);
}
if (!SECRET.startsWith('sb_secret_')) {
  console.error('SUPABASE_SECRET_KEY 에는 sb_secret_ 로 시작하는 관리자 키를 넣어 주세요.');
  process.exit(1);
}
/** 콘솔에 찍히는 문자열에서 키를 **** 로 가린다 */
const mask = (text) => String(text).split(SECRET).join('****');

// ---------------------------------------------------------------------
// 상가정보 feature → stores 행
// ---------------------------------------------------------------------
const clean = (v) => (v === null || v === undefined ? '' : String(v).trim());

/** 층 → 숫자. "B1"·"-1" 은 지하(음수). 모르거나 DB 범위(-10~200) 밖이면 null */
function floorOf(raw) {
  if (!raw) return null;
  const basement = /^(B|b|-)/.test(raw);
  const n = Number.parseInt(raw.replace(/^(B|b|-)/, ''), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const floor = basement ? -n : n;
  return floor >= -10 && floor <= 200 ? floor : null;
}

function toRow(feature, month) {
  const p = feature.properties ?? {};
  const [lng, lat] = feature.geometry?.coordinates ?? [];
  const sbizId = clean(p.bizesId);
  const baseName = clean(p.bizesNm);
  const branch = clean(p.brchNm);
  const name = (branch ? `${baseName} ${branch}` : baseName).slice(0, 100);
  const address = (clean(p.rdnmAdr) || clean(p.lnoAdr)).slice(0, 300);
  if (!sbizId || !name || !address || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const industry = { large: clean(p.indsLclsNm), middle: clean(p.indsMclsNm), small: clean(p.indsSclsNm) };
  return {
    sbiz_id: sbizId,
    sbiz_month: /^\d{6}$/.test(month) ? month : null,
    name,
    type_id: subCategoryOfIndustry(industry)?.id ?? null,
    industry: (industry.small || industry.middle).slice(0, 100),
    address,
    lng,
    lat,
    floor: floorOf(clean(p.flrNo)),
    building_id: clean(p.bldMngNo).slice(0, 40),
    building_name: clean(p.bldNm).slice(0, 100),
  };
}

// ---------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------
async function main() {
  let fc;
  try {
    fc = JSON.parse(await readFile(INPUT, 'utf8'));
  } catch {
    console.error('scripts/.data/sbiz-stores.geojson 이 없습니다. 먼저 npm run fetch:sbiz 를 실행하세요.');
    process.exit(1);
  }
  const month = clean(fc.stdrYm);
  const rows = (fc.features ?? []).map((f) => toRow(f, month));
  const valid = rows.filter(Boolean);
  console.log(`[가게 넣기] 파일 ${rows.length}곳 (기준월 ${month || '알 수 없음'}), 넣을 수 있는 가게 ${valid.length}곳`);

  const db = createClient(URL_TEXT, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. 대표 유형
  const types = SUB_CATEGORIES.map((c, i) => ({ id: c.id, name: c.label, group_name: c.group, sort_order: i + 1 }));
  const typeResult = await db.from('store_types').upsert(types, { onConflict: 'id' });
  if (typeResult.error) throw new Error(`대표 유형 저장 실패: ${typeResult.error.message}`);
  console.log(`  대표 유형 ${types.length}개 맞춤`);

  // 2. 이미 DB 에 있는 상가정보 가게 (사장님 연결 여부 확인)
  const existing = new Map();
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db.from('stores').select('sbiz_id, owner_id')
      .not('sbiz_id', 'is', null).order('sbiz_id').range(start, start + 999);
    if (error) throw new Error(`기존 가게 조회 실패: ${error.message}`);
    for (const r of data) existing.set(r.sbiz_id, r.owner_id);
    if (data.length < 1000) break;
  }
  const owned = valid.filter((r) => existing.get(r.sbiz_id));
  const targets = valid.filter((r) => !existing.get(r.sbiz_id));

  for (let i = 0; i < targets.length; i += CHUNK) {
    const { error } = await db.from('stores').upsert(targets.slice(i, i + CHUNK), { onConflict: 'sbiz_id' });
    if (error) throw new Error(`가게 저장 실패 (${i + 1}번째부터): ${error.message}`);
    console.log(`  저장 ${Math.min(i + CHUNK, targets.length)} / ${targets.length}`);
  }

  // 3. 결과
  const inFile = new Set(valid.map((r) => r.sbiz_id));
  const added = targets.filter((r) => !existing.has(r.sbiz_id)).length;
  const missing = [...existing.keys()].filter((id) => !inFile.has(id)).length;
  const untyped = valid.filter((r) => !r.type_id).length;
  console.log('\n========== 결과 ==========');
  console.log(`새로 넣음            : ${added}곳`);
  console.log(`정보 갱신            : ${targets.length - added}곳`);
  console.log(`사장님 가게라 건너뜀 : ${owned.length}곳`);
  console.log(`유형 없음            : ${untyped}곳`);
  console.log(`DB 에만 있음(폐업?)  : ${missing}곳 — 지우지 않았다. 확인 후 SQL Editor 에서 숨긴다.`);
}

main().catch((e) => {
  console.error(`\n가게 넣기 중단: ${mask(e?.message || e)}`);
  process.exit(1);
});
