import { subCategoryById } from '../../core/categories/subCategories';
import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { getSupabaseClient } from '../../core/supabase/client';
import { walkMinutes } from '../../core/utils/geo';
import type { RouletteStoreLink, RouletteStoreView } from './types';

interface MenuRow { id: string; store_id: string; name: string; price: number; type_id: string | null }

/**
 * 룰렛에서 뽑힌 메뉴로 추천 가게를 찾아오는 지점.
 * DB store_menus 에서 이름에 그 메뉴가 들어간 메뉴를 찾는다 (예: "김치찌개" → "김치찌개 정식"). 한 가게는 한 번만.
 */
async function fetchLinksByMenu(menuName: string): Promise<RouletteStoreLink[]> {
  const term = menuName.trim();
  if (!term) return [];
  try {
    // % _ \ 는 검색 패턴 기호라 글자 그대로 찾도록 막는다
    const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const { data, error } = await getSupabaseClient().from('store_menus')
      .select('id, store_id, name, price, type_id').ilike('name', pattern).limit(50);
    if (error) throw error;
    const seen = new Set<string>();
    return ((data ?? []) as MenuRow[]).flatMap((m) => {
      if (seen.has(m.store_id)) return [];
      seen.add(m.store_id);
      return [{
        id: m.id, menuName, storeId: m.store_id,
        desc: `${m.name} ${m.price.toLocaleString('ko-KR')}원`,
        tagLabel: subCategoryById(m.type_id)?.label ?? '메뉴',
        emoji: '🍽️',
      }];
    });
  } catch {
    return [];
  }
}

/** 메뉴를 파는 가게 목록에 가게 정보와 도보 시간을 붙여 돌려준다. 가게 정보가 없는 연결은 뺀다 */
export async function fetchStoresByMenu(menuName: string): Promise<RouletteStoreView[]> {
  const [links, here] = await Promise.all([fetchLinksByMenu(menuName), getUserLocation()]);
  const stores = await fetchStoresByIds(links.map((l) => l.storeId));

  return links.flatMap((link) => {
    const store = stores.get(link.storeId);
    return store ? [{ ...link, store, walkMinutes: walkMinutes(here, store.location) }] : [];
  });
}
