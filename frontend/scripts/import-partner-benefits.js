// 제휴매장 엑셀에서 만든 CSV를 단과대-가게 연결과 제휴 혜택 표에 넣는다.
//
// 1) database/scripts/partner_excel_to_csv.py 로 CSV 생성
// 2) frontend 폴더에서 실행
//    npm run import:partner-benefits -- "제휴혜택.csv"          # 미리보기
//    npm run import:partner-benefits -- "제휴혜택.csv" --apply  # 실제 반영

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

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
const mask = (value) => String(value).split(SECRET).join('****');

const STORE_ALIASES = {
  'FM25.1ST': 'MA010120220805289171',
  '경대컵밥': 'MA010120220811889529',
  '고씨네 광운대점': 'MA0101202409A0238950',
  '더진국 수육국밥 광운대점': 'MA0101202406A0280430',
  '디델리 서울 광운대점': 'MA010120220804349201',
  '로스2000': 'MA010120220803957956',
  '민들레뜨락': 'MA0101202406A0013025',
  '민들레뜨락2': 'MA0101202406A0013025',
  '샐러리아': 'MA0101202406A0019454',
  '썬더치킨 광운대점': 'MA010120220811627518',
  '연어시장 석계본점': 'MA010120220800370480',
  '영축산 정육식당': 'MA0101202406A0461790',
  '와플대학 광운대캠퍼스': 'MA010120220806841762',
  '육회바른연어 석계역점': 'MA0101202509A0009951',
  '중화호반닭갈비 광운대점': 'MA010120220814215899',
  '저팔계족발 석계점': 'MA010120220804359718',
  '진로포차': 'MA0101202511A0024245',
  '진심카츠 광운대점': 'MA010120220805188847',
  '치킨클럽 성북역본점': 'MA010120220808675870',
  '치킨플러스 월계점': 'MA010120220808528045',
  '카페 베르데': 'MA010120220813105212',
  '푸른스시 광운대본점': 'MA010120220804914354',
  '펍피맥 석계점': 'MA010120220804367296',
};

// 원본의 민들레뜨락/민들레뜨락2는 같은 실제 가게의 메뉴판이다.
const MERGED_STORE_NAMES = new Set(['민들레뜨락', '민들레뜨락2']);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((values) => values.some(Boolean));
  return body.map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ''])));
}

const norm = (name) => name.normalize('NFKC').toLocaleLowerCase().replace(/[\s()[\]&·.,'’\-_/]/g, '');
const baseName = (name) => {
  const words = name.trim().split(/\s+/);
  while (words.length > 1 && /점$/.test(words.at(-1))) words.pop();
  return words[0].replace(/(?<=..)[가-힣]{1,6}(역|대|본)?점$/, '');
};

function matchStores(names, stores) {
  const byNorm = new Map();
  for (const store of stores) byNorm.set(norm(store.name), [...(byNorm.get(norm(store.name)) ?? []), store]);
  const bySbiz = new Map(stores.map((store) => [store.sbiz_id, store]));
  return new Map(names.map((name) => {
    const alias = STORE_ALIASES[name];
    if (alias) return [name, { store: bySbiz.get(alias), how: '직접 지정' }];
    const exact = byNorm.get(norm(name)) ?? [];
    if (exact.length === 1) return [name, { store: exact[0], how: '같은 이름' }];
    if (exact.length > 1) return [name, { candidates: exact, how: '같은 이름 여러 곳' }];
    const base = norm(baseName(name));
    const candidates = base.length < 2 ? [] : stores.filter((store) => norm(store.name).startsWith(base));
    return [name, candidates.length === 1
      ? { store: candidates[0], how: '지점명 빼고 비교' }
      : { candidates, how: candidates.length ? '후보 여러 곳' : '못 찾음' }];
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const input = args.find((argument) => !argument.startsWith('--'));
  if (!input) throw new Error('CSV 경로를 주세요: npm run import:partner-benefits -- "제휴혜택.csv" [--apply]');
  const rows = parseCsv((await readFile(input, 'utf8')).replace(/^﻿/, ''));
  const required = ['store_name', 'colleges', 'offer', 'source_ref', 'data_source'];
  const invalid = rows.filter((row) => required.some((column) => !row[column]) || row.offer.length > 1500);
  if (invalid.length) throw new Error(`필수 값이 비었거나 혜택이 너무 긴 행이 있습니다: ${invalid.map((row) => row.source_row).join(', ')}`);
  const sources = [...new Set(rows.map((row) => row.data_source))];
  if (sources.length !== 1) throw new Error('한 번에 하나의 엑셀 원본만 넣을 수 있습니다.');

  const db = createClient(URL_TEXT, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
  const stores = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await db.from('stores').select('id, sbiz_id, name, address').eq('is_mock', false).order('id').range(start, start + 999);
    if (error) throw error;
    stores.push(...data);
    if (data.length < 1000) break;
  }
  const storeNames = [...new Set(rows.map((row) => row.store_name))];
  const matches = matchStores(storeNames, stores);
  const unlinked = storeNames.filter((name) => !matches.get(name)?.store);
  if (unlinked.length) {
    console.log('[연결 안 됨]');
    for (const name of unlinked) {
      const match = matches.get(name);
      console.log(`  ${name} [${match.how}]${match.candidates?.length ? ` 후보: ${match.candidates.slice(0, 5).map((store) => store.name).join(' / ')}` : ''}`);
    }
    throw new Error(`${unlinked.length}개 가게가 DB와 연결되지 않았습니다. STORE_ALIASES를 확인하세요.`);
  }
  const usedStoreIds = new Map();
  for (const name of storeNames) {
    const id = matches.get(name).store.id;
    const previousName = usedStoreIds.get(id);
    if (previousName && !(MERGED_STORE_NAMES.has(previousName) && MERGED_STORE_NAMES.has(name))) {
      throw new Error(`${previousName}와 ${name}이 같은 DB 가게에 연결되었습니다.`);
    }
    usedStoreIds.set(id, name);
  }

  const { data: partnerRows, error: partnerError } = await db.from('partners').select('id, name');
  if (partnerError) throw partnerError;
  const partnerByName = new Map(partnerRows.map((partner) => [partner.name, partner.id]));
  const collegeNames = [...new Set(rows.flatMap((row) => row.colleges.split('|')))];
  const missingColleges = collegeNames.filter((name) => !partnerByName.has(name));
  if (missingColleges.length) throw new Error(`DB에 없는 단과대입니다: ${missingColleges.join(', ')}`);

  const targets = rows.map((row) => ({ ...row, storeId: matches.get(row.store_name).store.id }));
  const storeIds = [...new Set(targets.map((row) => row.storeId))];
  const storePartners = [...new Map(targets.flatMap((row) => row.colleges.split('|').map((college) => {
    const link = { store_id: row.storeId, partner_id: partnerByName.get(college) };
    return [`${link.store_id}:${link.partner_id}`, link];
  }))).values()];

  console.log(`[제휴 혜택] ${apply ? '실제 넣기' : '미리보기'} — 가게 ${storeIds.length}곳 / 단과대 연결 ${storePartners.length}건 / 혜택 ${targets.length}건`);
  for (const name of storeNames) {
    const match = matches.get(name);
    if (match.how !== '같은 이름') console.log(`  ${name} → ${match.store.name} [${match.how}]`);
  }
  if (!apply) {
    console.log('미리보기라 DB는 바꾸지 않았습니다. 확인 후 --apply를 붙여 다시 실행하세요.');
    return;
  }

  const source = sources[0];
  for (let index = 0; index < storePartners.length; index += 500) {
    const { error } = await db.from('store_partners').upsert(storePartners.slice(index, index + 500), {
      onConflict: 'store_id,partner_id',
      ignoreDuplicates: true,
    });
    if (error) throw error;
  }

  const benefits = targets.map((row) => ({
    store_id: row.storeId,
    offer: row.offer,
    condition: '',
    data_source: source,
    source_ref: row.source_ref,
  }));
  const inserted = [];
  for (let index = 0; index < benefits.length; index += 500) {
    const { data, error } = await db.from('partner_benefits').upsert(benefits.slice(index, index + 500), {
      onConflict: 'store_id,data_source,source_ref',
    }).select('id, source_ref');
    if (error) throw error;
    inserted.push(...data);
  }
  const benefitByRef = new Map(inserted.map((benefit) => [benefit.source_ref, benefit.id]));
  const benefitPartners = targets.flatMap((row) => row.colleges.split('|').map((college) => ({
    benefit_id: benefitByRef.get(row.source_ref),
    partner_id: partnerByName.get(college),
  })));
  if (benefitPartners.some((row) => !row.benefit_id)) throw new Error('저장한 혜택의 ID를 찾지 못했습니다.');
  for (let index = 0; index < benefitPartners.length; index += 500) {
    const { error } = await db.from('benefit_partners').upsert(benefitPartners.slice(index, index + 500), {
      onConflict: 'benefit_id,partner_id',
      ignoreDuplicates: true,
    });
    if (error) throw error;
  }
  console.log('완료.');
}

main().catch((error) => {
  console.error(`제휴 혜택 넣기 중단: ${mask(error?.message || error)}`);
  process.exit(1);
});
