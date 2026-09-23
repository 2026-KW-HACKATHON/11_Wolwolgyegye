import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { walkMinutes } from '../../core/utils/geo';
import { MOCK_MY_STAMPS, MOCK_STAMP_POLICIES } from './mock';
import type { StampView } from './types';

/**
 * 스탬프 가게 목록을 가져오는 지점. 화면은 이 함수만 바라본다.
 * Supabase 연동 시 아래 두 줄만 바꾸면 된다.
 *
 *   const { data: policies } = await supabase.from('stamp_policies').select('*');
 *   const { data: mine } = await supabase.from('user_stamps').select('*').eq('user_id', userId);
 */
export async function fetchStamps(): Promise<StampView[]> {
  const policies = MOCK_STAMP_POLICIES;
  const mine = new Map(MOCK_MY_STAMPS.map((m) => [m.storeId, m.count]));
  const [stores, here] = await Promise.all([fetchStoresByIds(policies.map((p) => p.storeId)), getUserLocation()]);
  return policies.flatMap((policy) => {
    const store = stores.get(policy.storeId);
    if (!store) return [];
    const count = Math.min(mine.get(policy.storeId) ?? 0, policy.requiredStamps);
    return [{ ...policy, store, count, walkMinutes: walkMinutes(here, store.location) }];
  });
}
