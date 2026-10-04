import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { walkMinutes } from '../../core/utils/geo';
import type { RouletteStoreLink, RouletteStoreView } from './types';

/**
 * 룰렛에서 뽑힌 메뉴로 추천 가게를 찾아오는 지점.
 * TODO(DB): 메뉴(store_menus)·메뉴 유형 연결. 그 전까지는 빈 목록이다. (가짜 데이터를 쓰지 않는다)
 */
async function fetchLinksByMenu(menuName: string): Promise<RouletteStoreLink[]> {
  void menuName;
  return [];
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
