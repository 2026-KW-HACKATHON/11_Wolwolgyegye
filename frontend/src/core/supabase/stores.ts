import { getSupabaseClient } from './client';

/** 실제 공개 가게 조회. 아직 기존 예시 데이터 공급 함수와 자동 교체하지 않는다. */
export async function fetchPublicStores(signal?: AbortSignal) {
  const query = getSupabaseClient()
    .from('stores')
    .select('id, name, cuisine_type, address, lat, lng, phone, business_hours, thumbnail_path, supported_features')
    .eq('is_published', true)
    .order('name')
    .order('id')
    .limit(100);
  if (signal) query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw new Error('가게 정보를 불러오지 못했습니다. 연결 상태와 DB 조회 권한을 확인해 주세요.');
  return data;
}
