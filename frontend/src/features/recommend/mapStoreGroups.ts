import type { Store } from '../../core/types/place';

export interface MapStoreGroup {
  key: string;
  address: string;
  lat: number;
  lng: number;
  stores: Store[];
}

/** 같은 도로명 주소의 가게는 지도에서 한 핀으로 표시하고 목록에서 각각 고른다. */
export function groupMapStores(stores: Store[]): MapStoreGroup[] {
  const groups = new Map<string, MapStoreGroup>();
  for (const store of stores) {
    const address = store.address.trim();
    const key = address || `store:${store.id}`;
    const group = groups.get(key);
    if (group) {
      group.stores.push(store);
    } else {
      groups.set(key, { key, address, lat: store.location.lat, lng: store.location.lng, stores: [store] });
    }
  }
  return [...groups.values()].map((group) => ({
    ...group,
    lat: group.stores.reduce((sum, store) => sum + store.location.lat, 0) / group.stores.length,
    lng: group.stores.reduce((sum, store) => sum + store.location.lng, 0) / group.stores.length,
    stores: group.stores.sort((a, b) => a.name.localeCompare(b.name, 'ko')),
  }));
}
