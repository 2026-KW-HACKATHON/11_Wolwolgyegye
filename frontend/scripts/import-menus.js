// =====================================================================
// 팀원이 판독한 메뉴 CSV 를 DB(store_menus 표)에 넣는 스크립트.
//
// 실행: frontend 폴더에서
//   npm run import:menus -- "CSV 경로"           미리보기 (DB 는 안 바꾼다)
//   npm run import:menus -- "CSV 경로" --apply   실제로 넣기
//   CSV 는 database/scripts/menu_excel_to_csv.py 가 만든 파일.
//
// 필요한 키: frontend/.env.local (import-stores.js 와 같다)
//   VITE_SUPABASE_URL, SUPABASE_SECRET_KEY
//
// 하는 일
//   1. CSV 식당명을 DB 가게(stores, 예시 가게 제외)와 이름으로 잇는다.
//      - 띄어쓰기·괄호를 무시하고 같으면 연결
//      - 아니면 지점명(…점)을 떼고 비교해서 후보가 하나뿐이면 연결 (미리보기에 "확인 필요"로 보여준다)
//      - 자동으로 못 잇거나 같은 이름이 여러 곳이면 STORE_ALIASES 에 상가업소번호(sbiz_id)를 직접 적는다
//   2. 연결된 가게마다 같은 엑셀 원본(data_source)과 예전 메뉴판 가져오기(board_image) 메뉴만 지우고 다시 넣는다.
//      여러 번 실행해도 두 번 쌓이지 않고, 사장님이 직접 넣은 메뉴(data_source 빈칸)는 건드리지 않는다.
//   3. 사장님이 연결된 가게는 사장님 정보를 지키기 위해 건너뛴다 (import-stores.js 와 같은 원칙).
// =====================================================================

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const CHUNK = 500;

// CSV 식당명 → DB 가게의 상가업소번호(sbiz_id). 자동 연결이 안 되거나 틀릴 때만 적는다. 빈 문자열이면 넣지 않는다.
// (2026-10-05 확인. DB 에 같은 가게가 두 번 있으면 최신 번호에 넣고 옛 번호 가게는 숨겼다)
const STORE_ALIASES = {
  '1일1잔': 'MA010120220805346928', // 카페1일1잔
  '고씨네 광운대점': 'MA0101202409A0238950', // 광운로 37-1 (광운로 17-5 에도 같은 이름이 있음)
  '또와집순대국': 'MA010120220804348911', // 또와집
  '미스터피자 석계역점': 'MA0101202209A0006794', // 미스터피자석계역점 (중복)
  '썬더치킨 광운대점': 'MA010120220811627518', // 썬더치킨 광운로 44
  '썬더치킨 석계역점': 'MA0101202411A0056746', // 썬더치킨 석계로3길 21
  '영축산 정육식당': 'MA0101202406A0461790', // 정육식당
  '이디야커피 월계인덕점': 'MA010120220803515154', // 이디야월계인덕점
  '저팔계족발 석계점': 'MA010120220804359718', // 저팔계
  '진로포차': 'MA0101202511A0024245', // 진로포차1924 (중복)
  '진미통닭': 'MA010120220809783540', // 진미
  '카페 베르데': 'MA010120220813105212', // 베르데
  '클라우드9': 'MA010120220804350568', // 클라우드
  '파리바게뜨 광운대역': 'MA010120220803617036', // 파리바게뜨광운대역점
  '파스토보이 월계점': 'MA0101202209A0035956', // 파스토보이 (중복)
  '한국통닭 석계점': 'MA0101202209A0002672', // 한국통닭석계점 (중복)
  'FM25.1ST': 'MA010120220805289171', // 에프엠25.1
  '더진국 수육국밥 광운대점': 'MA0101202406A0280430', // 더진국 광운대점
  '민들레뜨락2': 'MA0101202406A0013025', // 민들레뜨락이 (같은 가게의 두 번째 메뉴판)
  '서초우동 광운대역점': 'MA010120220803943534', // 서초우동2
  '진심카츠 광운대점': 'MA010120220805188847', // 카츠3.3 광운대점
  '매머드익스프레스 광운대후문점': 'MA0106202408A0426243',
  '빽다방 석계역문화공원점': 'MA0101202311A0057160',
  '로스2000': 'MA010120220803957956', // DB에는 전각 숫자 로스２０００으로 저장됨
  '아따통닭석계점': 'MA0101202503A0038522', // 아따통닭
  '펍피맥 석계점': 'MA010120220804367296', // 피맥
};

// 두 엑셀 식당명이 실제로 같은 DB 가게를 가리키는 경우만 허용한다.
const MERGED_STORE_NAMES = new Set(['민들레뜨락', '민들레뜨락2']);

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
const mask = (text) => String(text).split(SECRET).join('****');

// ---------------------------------------------------------------------
// CSV 읽기 (따옴표 안의 쉼표·줄바꿈 처리)
// ---------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((v) => v !== ''));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

// ---------------------------------------------------------------------
// 가게 이름 잇기
// ---------------------------------------------------------------------
/** 비교용 이름: 전각 문자(２０００)를 보통 문자로, 띄어쓰기·기호 제거, 소문자 */
const norm = (name) => name.normalize('NFKC').toLowerCase().replace(/[\s()[\]&·.,'’\-_/]/g, '');
/** 끝의 지점명(…점) 떼기: "시마스시 스타필드마켓 월계점" → "시마스시 스타필드마켓" → 비교는 첫 낱말부터 */
const baseName = (name) => {
  const words = name.trim().split(/\s+/);
  while (words.length > 1 && /점$/.test(words.at(-1))) words.pop();
  if (words.length === 1) return words[0].replace(/(?<=..)[가-힣]{1,6}(역|대|본)?점$/, ''); // 아따통닭석계점 → 아따통닭
  return words[0];
};

function matchStores(csvNames, stores) {
  const byNorm = new Map();
  for (const s of stores) {
    const key = norm(s.name);
    byNorm.set(key, [...(byNorm.get(key) ?? []), s]);
  }
  const bySbiz = new Map(stores.map((s) => [s.sbiz_id, s]));
  const result = new Map(); // csv 이름 → { store, how, candidates }
  for (const name of csvNames) {
    if (name in STORE_ALIASES) {
      const store = bySbiz.get(STORE_ALIASES[name]);
      result.set(name, store ? { store, how: '직접 지정' } : { how: STORE_ALIASES[name] ? '직접 지정한 번호가 DB 에 없음' : '넣지 않기로 함' });
      continue;
    }
    const exact = byNorm.get(norm(name)) ?? [];
    if (exact.length === 1) { result.set(name, { store: exact[0], how: '같은 이름' }); continue; }
    if (exact.length > 1) { result.set(name, { how: '같은 이름 여러 곳', candidates: exact }); continue; }

    const base = norm(baseName(name));
    const candidates = base.length < 2 ? [] : stores.filter((s) => norm(s.name).startsWith(base));
    if (candidates.length === 1) result.set(name, { store: candidates[0], how: '지점명 빼고 비교' });
    else result.set(name, { how: candidates.length ? '후보 여러 곳' : '못 찾음', candidates });
  }
  return result;
}

// ---------------------------------------------------------------------
// CSV 행 → store_menus 행
// ---------------------------------------------------------------------
function toMenu(r, storeId) {
  return {
    store_id: storeId,
    name: r.menu_name.slice(0, 100),
    price: Number.parseInt(r.price, 10),
    section: r.section.slice(0, 200),
    kind: r.kind || null,
    description: r.description.slice(0, 300),
    board_date: r.menu_registered_on || null,
    board_image: r.menu_image.slice(0, 300),
    review_status: r.review_status === '확인 필요' ? 'needs_review' : 'confirmed',
    data_source: r.data_source.slice(0, 100),
    sort_order: Number.parseInt(r.sort_order, 10) || 0,
  };
}

// ---------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const input = args.find((a) => !a.startsWith('--'));
  if (!input) {
    console.error('CSV 경로를 주세요: npm run import:menus -- "경로.csv" [--apply]');
    process.exit(1);
  }
  const rows = parseCsv((await readFile(input, 'utf8')).replace(/^﻿/, ''));
  const bad = rows.filter((r) => !r.menu_name || !Number.isFinite(Number.parseInt(r.price, 10)));
  if (bad.length) {
    console.error(`메뉴 이름이나 가격이 빈 행이 있습니다 (엑셀 ${bad.map((r) => r.source_row).join(', ')}행).`);
    process.exit(1);
  }
  const csvNames = [...new Set(rows.map((r) => r.store_name))];
  console.log(`[메뉴 넣기] ${apply ? '실제 넣기' : '미리보기 (DB 안 바꿈)'} — CSV 메뉴 ${rows.length}개, 가게 ${csvNames.length}곳`);

  const db = createClient(URL_TEXT, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });

  const stores = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db.from('stores').select('id, sbiz_id, name, address, owner_id')
      .eq('is_mock', false).order('id').range(start, start + 999);
    if (error) throw new Error(`가게 조회 실패: ${error.message}`);
    stores.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`  DB 가게 ${stores.length}곳 (예시 가게 제외)`);

  const matches = matchStores(csvNames, stores);
  const count = (name) => rows.filter((r) => r.store_name === name).length;
  const linked = csvNames.filter((n) => matches.get(n).store);
  const owned = linked.filter((n) => matches.get(n).store.owner_id);
  const targets = linked.filter((n) => !matches.get(n).store.owner_id);
  const unlinked = csvNames.filter((n) => !matches.get(n).store);

  // 같은 DB 가게에 서로 다른 CSV 가게가 붙으면 메뉴가 섞일 수 있으므로, 확인된 병합만 허용한다.
  const used = new Map();
  for (const n of linked) {
    const id = matches.get(n).store.id;
    if (used.has(id) && !(MERGED_STORE_NAMES.has(used.get(id)) && MERGED_STORE_NAMES.has(n))) {
      console.error(`"${used.get(id)}" 와 "${n}" 이 같은 DB 가게(${matches.get(n).store.name})에 연결됐습니다. STORE_ALIASES 로 나눠 주세요.`);
      process.exit(1);
    }
    used.set(id, n);
  }

  const fuzzy = linked.filter((n) => matches.get(n).how !== '같은 이름');
  if (fuzzy.length) {
    console.log(`\n[확인 필요] 이름이 달라 추정으로 연결한 가게 ${fuzzy.length}곳`);
    for (const n of fuzzy) {
      const { store, how } = matches.get(n);
      console.log(`  ${n}  →  ${store.name}  (${store.address}) [${how}]`);
    }
  }
  if (unlinked.length) {
    console.log(`\n[연결 안 됨] ${unlinked.length}곳 — 메뉴를 넣지 않는다. STORE_ALIASES 에 상가업소번호를 적어 주세요.`);
    for (const n of unlinked) {
      const { how, candidates } = matches.get(n);
      const hint = candidates?.length ? ` 후보: ${candidates.slice(0, 5).map((s) => s.name).join(' / ')}` : '';
      console.log(`  ${n} (메뉴 ${count(n)}개) [${how}]${hint}`);
    }
  }
  if (owned.length) console.log(`\n[사장님 가게라 건너뜀] ${owned.join(', ')}`);

  const menuKeys = new Set();
  const menus = targets.flatMap((n) => rows.filter((r) => r.store_name === n).map((r) => toMenu(r, matches.get(n).store.id)))
    .filter((menu) => {
      const key = [menu.store_id, menu.name, menu.price, menu.section, menu.description].join('\u001f');
      if (menuKeys.has(key)) return false;
      menuKeys.add(key);
      return true;
    });
  console.log(`\n넣을 메뉴: ${menus.length}개 / 가게 ${targets.length}곳`);
  if (!apply) {
    console.log('미리보기라 DB 는 바꾸지 않았습니다. 확인 후 --apply 를 붙여 다시 실행하세요.');
    return;
  }

  const ids = [...new Set(targets.map((n) => matches.get(n).store.id))];
  const sources = [...new Set(menus.map((menu) => menu.data_source).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { error: legacyError } = await db.from('store_menus').delete().in('store_id', batch).neq('board_image', '');
    if (legacyError) throw new Error(`예전 메뉴판 가져오기 데이터 지우기 실패: ${legacyError.message}`);
    const { error: sourceError } = await db.from('store_menus').delete().in('store_id', batch).in('data_source', sources);
    if (sourceError) throw new Error(`같은 엑셀 원본 메뉴 지우기 실패: ${sourceError.message}`);
  }
  for (let i = 0; i < menus.length; i += CHUNK) {
    const { error } = await db.from('store_menus').insert(menus.slice(i, i + CHUNK));
    if (error) throw new Error(`메뉴 저장 실패 (${i + 1}번째부터): ${error.message}`);
    console.log(`  저장 ${Math.min(i + CHUNK, menus.length)} / ${menus.length}`);
  }
  console.log('완료.');
}

main().catch((e) => {
  console.error(`\n메뉴 넣기 중단: ${mask(e?.message || e)}`);
  process.exit(1);
});
