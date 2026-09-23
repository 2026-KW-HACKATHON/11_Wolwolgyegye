import { MOCK_STORES, MOCK_USER_LOCATION } from '../mock/stores';
import type { GeoPoint, Store } from '../types/place';

/**
 * 가게 공통 정보를 가져오는 지점. 모든 카테고리의 source.ts 가 이 함수로 storeId 를 가게로 바꾼다.
 *
 * 지금은 core/mock/stores.ts 에서 찾지만, Supabase 연동(3단계) 때 이 함수 안만 아래처럼 바꾸면
 * 각 카테고리 코드는 그대로 둬도 된다.
 *
 *   const { data } = await supabase.from('stores').select('*').in('id', ids);
 */
export async function fetchStoresByIds(ids: string[]): Promise<Map<string, Store>> {
  const wanted = new Set(ids);
  return new Map(MOCK_STORES.filter((s) => wanted.has(s.id)).map((s) => [s.id, s]));
}

/** 사용자 현재 위치. 위치 권한 연동 전까지는 고정된 기준점을 돌려준다 */
export async function getUserLocation(): Promise<GeoPoint> {
  return MOCK_USER_LOCATION;
}
