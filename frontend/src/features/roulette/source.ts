import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { walkMinutes } from '../../core/utils/geo';
import { MOCK_ROULETTE_LINKS } from './mock';
import type { RouletteStoreLink, RouletteStoreView } from './types';

/**
 * 룰렛에서 뽑힌 메뉴로 추천 가게를 찾아오는 지점.
 *
 * 지금은 예시 데이터에서 메뉴 이름이 같은 연결을 골라 주지만, 백엔드가 준비되면
 * fetchLinksByMenu 안만 아래처럼 바꾸면 화면 코드는 그대로 둬도 된다.
 *
 *   const { data } = await supabase.from('roulette_store_links').select('*').eq('menu_name', menuName);
 *   return data;
 */
async function fetchLinksByMenu(menuName: string): Promise<RouletteStoreLink[]> {
  return MOCK_ROULETTE_LINKS.filter((link) => link.menuName === menuName);
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
