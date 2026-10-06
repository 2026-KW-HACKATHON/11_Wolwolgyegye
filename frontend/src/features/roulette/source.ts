import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { getSupabaseClient } from '../../core/supabase/client';
import { walkMinutes } from '../../core/utils/geo';
import type { MenuMatch, RouletteStoreLink, RouletteStoreView, WheelMenu } from './types';

interface MenuRow { id: string; store_id: string; name: string; price: number }
interface StoreHitRow { id: string; name: string; industry: string; store_menus: { count: number }[] }

/** 음료·추가·사이드·주류는 그 메뉴를 "파는 가게"로 보기 어려워 뺀다 (예: 치킨집 사이드 떡볶이) */
const MEAL_KINDS = ['main', 'set', 'dessert'];
/** 한 번에 받는 메뉴 행 수. 한 가게가 같은 키워드 메뉴를 여러 개 가진 경우가 많아 넉넉히 받는다 */
const MENU_LIMIT = 600;

/** PostgREST or() 안에 넣을 "포함" 패턴. % _ \ 는 글자 그대로, 쉼표·괄호가 있어도 깨지지 않게 따옴표로 감싼다 */
function containsPattern(term: string) {
  const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

function matchOf(menu: WheelMenu & Partial<MenuMatch>): MenuMatch {
  const keywords = (menu.keywords?.length ? menu.keywords : [menu.name]).map((k) => k.trim()).filter(Boolean);
  return {
    keywords, exclude: menu.exclude ?? [], storeNames: menu.storeNames ?? [],
    industries: menu.industries ?? [], looseIndustries: menu.looseIndustries ?? [],
  };
}

/** 메뉴판에 그 메뉴가 있는 가게. 가게마다 메뉴판 순서상 첫 메뉴 하나로 소개한다 */
async function fetchMenuHits({ keywords, exclude = [] }: MenuMatch, menuName: string): Promise<RouletteStoreLink[]> {
  const { data, error } = await getSupabaseClient().from('store_menus')
    .select('id, store_id, name, price')
    .or(keywords.map((k) => `name.ilike.${containsPattern(k)}`).join(','))
    .in('kind', MEAL_KINDS)
    .order('sort_order')
    .limit(MENU_LIMIT);
  if (error) throw error;

  const seen = new Set<string>();
  return ((data ?? []) as MenuRow[]).flatMap((m) => {
    if (seen.has(m.store_id) || exclude.some((e) => m.name.includes(e))) return [];
    seen.add(m.store_id);
    return [{
      id: m.id, menuName, storeId: m.store_id, specialty: false,
      desc: `${m.name} ${m.price.toLocaleString('ko-KR')}원`,
    }];
  });
}

/** 업종이 맞거나 가게 이름에 키워드가 든 가게 후보 (메뉴판 메뉴 수 포함) */
async function fetchSpecialtyStores({ keywords, storeNames = [], industries = [], looseIndustries = [] }: MenuMatch): Promise<StoreHitRow[]> {
  const filters = [...keywords, ...storeNames].map((k) => `name.ilike.${containsPattern(k)}`);
  const allIndustries = [...industries, ...looseIndustries];
  if (allIndustries.length) filters.push(`industry.in.(${allIndustries.map((i) => `"${i}"`).join(',')})`);
  const { data, error } = await getSupabaseClient().from('stores')
    .select('id, name, industry, store_menus(count)').or(filters.join(',')).limit(200);
  if (error) throw error;
  return (data ?? []) as StoreHitRow[];
}

/**
 * 룰렛에서 뽑힌 메뉴로 추천 가게를 찾아오는 지점. 우리 DB 의 메뉴판·업종·가게 이름을 함께 본다.
 * - 가게 이름에 키워드가 있거나, 믿는 업종(industries)이면 전문점
 * - 확인하는 업종(looseIndustries)만 맞으면: 메뉴판에 그 메뉴가 있거나, 메뉴판이 아예 없을 때만 전문점.
 *   메뉴판은 있는데 그 메뉴가 없으면 업종이 틀린 것으로 보고 뺀다 (예: 횟집으로 등록된 부대찌개집)
 * 전문점을 먼저, 그다음 가까운 순. 메뉴판에 없는 전문점은 업종으로 소개한다.
 */
async function fetchLinksByMenu(menu: WheelMenu & Partial<MenuMatch>): Promise<RouletteStoreLink[]> {
  const match = matchOf(menu);
  if (!match.keywords.length) return [];
  const [menuHits, specialty] = await Promise.all([
    fetchMenuHits(match, menu.name).catch(() => []),
    fetchSpecialtyStores(match).catch(() => []),
  ]);

  const links = new Map(menuHits.map((l) => [l.storeId, l]));
  const nameWords = [...match.keywords, ...(match.storeNames ?? [])];
  for (const s of specialty) {
    const hit = links.get(s.id);
    const trusted = nameWords.some((k) => s.name.includes(k)) || (match.industries ?? []).includes(s.industry);
    const hasMenus = (s.store_menus?.[0]?.count ?? 0) > 0;
    if (!trusted && !hit && hasMenus) continue;
    links.set(s.id, hit
      ? { ...hit, specialty: true }
      : { id: `store-${s.id}`, menuName: menu.name, storeId: s.id, specialty: true, desc: s.industry || `${menu.name} 전문` });
  }
  return [...links.values()];
}

/** 메뉴를 파는 가게 목록에 가게 정보와 도보 시간을 붙여 돌려준다. 가게 정보가 없는 연결(비공개 등)은 뺀다 */
export async function fetchStoresByMenu(menu: WheelMenu & Partial<MenuMatch>): Promise<RouletteStoreView[]> {
  const [links, here] = await Promise.all([fetchLinksByMenu(menu), getUserLocation()]);
  const stores = await fetchStoresByIds(links.map((l) => l.storeId));

  return links
    .flatMap((link) => {
      const store = stores.get(link.storeId);
      return store ? [{
        ...link, store,
        walkMinutes: walkMinutes(here, store.location),
        tagLabel: link.specialty ? `${menu.name} 전문` : (store.cuisineType ?? '메뉴'),
      }] : [];
    })
    .sort((a, b) => Number(b.specialty) - Number(a.specialty) || a.walkMinutes - b.walkMinutes);
}
