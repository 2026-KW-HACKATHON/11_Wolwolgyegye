import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { getSupabaseClient } from '../../core/supabase/client';
import { walkMinutes } from '../../core/utils/geo';
import type { RouletteStoreLink, RouletteStoreView } from './types';

/**
 * 룰렛에서 뽑힌 메뉴로 추천 가게를 찾아오는 지점.
 *
 * 메뉴 이름이 같은 공개 DB 연결을 가져온다.
 */
async function fetchLinksByMenu(menuName: string): Promise<RouletteStoreLink[]> {
  const { data, error } = await getSupabaseClient().from('roulette_store_links')
    .select('id, store_id, menu_name, description, tag_label, emoji')
    .eq('menu_name', menuName);
  if (error) throw new Error('추천 가게를 불러오지 못했어요.');
  return (data ?? []).map((row) => ({
    id: row.id, storeId: row.store_id, menuName: row.menu_name,
    desc: row.description, tagLabel: row.tag_label, emoji: row.emoji,
  }));
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
