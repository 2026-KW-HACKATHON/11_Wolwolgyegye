import { WOLGYE_CENTER } from '../location/wolgye';
import { getSupabaseClient } from '../supabase/client';
import { toStore } from '../supabase/storeMapper';
import type { GeoPoint, Store } from '../types/place';

/**
 * 가게 공통 정보를 가져오는 지점. 모든 카테고리의 source.ts 가 이 함수로 storeId 를 가게로 바꾼다.
 *
 * RLS가 공개 가게 또는 로그인한 사장님의 가게만 반환한다.
 */
export async function fetchStoresByIds(ids: string[]): Promise<Map<string, Store>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data, error } = await getSupabaseClient().from('stores')
    .select('id, name, cuisine_type, address, lat, lng, phone, business_hours, thumbnail_path, supported_features')
    .in('id', unique);
  if (error) throw new Error('가게 정보를 불러오지 못했어요.');
  const stores = (data ?? []).map((row) => toStore(row));
  return new Map(stores.map((store) => [store.id, store]));
}

/** 사용자 현재 위치. 위치 권한 연동 전까지는 고정된 기준점을 돌려준다 */
export async function getUserLocation(): Promise<GeoPoint> {
  return WOLGYE_CENTER;
}
