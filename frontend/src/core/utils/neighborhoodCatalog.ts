import type { Store } from '../types/place';
import { toStore, type PublicStoreRow } from '../supabase/storeMapper.ts';

interface CatalogData { as_of: string; stores: PublicStoreRow[] }

/** 공개 공공데이터 스냅샷에 같은 ID의 실시간 가게 정보가 있으면 그 정보를 우선한다. */
export function mergeNeighborhoodStores(candidates: Store[], published: Store[]): Store[] {
  const byId = new Map(candidates.map((store) => [store.id, store]));
  for (const store of published) byId.set(store.id, store);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export async function fetchNeighborhoodCatalog(signal?: AbortSignal): Promise<Store[]> {
  const response = await fetch('/data/wolgye1-candidates.json', { signal });
  if (!response.ok) throw new Error('공공데이터 가게 목록을 불러오지 못했습니다.');
  const catalog = await response.json() as CatalogData;
  if (catalog.as_of !== '2026-06-30' || !Array.isArray(catalog.stores)) {
    throw new Error('공공데이터 가게 목록 형식이 올바르지 않습니다.');
  }
  return catalog.stores.map(toStore);
}
