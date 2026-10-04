import type { Store } from '../types/place';
import { getSupabaseClient } from './client';
import { toStore } from './storeMapper';

const PAGE_SIZE = 500;

/** 공개 승인된 실제 가게만 전체 페이지에 걸쳐 가져온다. 비공개 후보와 데모는 RLS/필터로 제외한다. */
export async function fetchPublicStores(signal?: AbortSignal): Promise<Store[]> {
  const client = getSupabaseClient();
  const stores: Store[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    let query = client.from('stores')
      .select('id, name, cuisine_type, address, lat, lng, phone, business_hours, thumbnail_path, supported_features')
      .eq('is_published', true)
      .eq('is_demo', false)
      .order('name')
      .order('id')
      .range(start, start + PAGE_SIZE - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (error) throw new Error('가게 정보를 불러오지 못했습니다. 연결 상태와 DB 조회 권한을 확인해 주세요.');
    stores.push(...(data ?? []).map((row) => toStore(row)));
    if (!data || data.length < PAGE_SIZE) return stores;
  }
}
