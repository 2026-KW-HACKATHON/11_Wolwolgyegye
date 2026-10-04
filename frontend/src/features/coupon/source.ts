import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { getSupabaseClient } from '../../core/supabase/client';
import { walkMinutes } from '../../core/utils/geo';
import type { MyStampProgress, StampPolicy, StampTransaction, StampView } from './types';
import { isStampPolicy, validBalance } from './policy';

export async function fetchStampPolicies(): Promise<StampPolicy[]> {
  const { data, error } = await getSupabaseClient().from('stamp_policies')
    .select('store_id, required_stamps, reward, unit, condition');
  if (error) throw new Error('스탬프 정책을 불러오지 못했어요.');
  return (data ?? []).map((row) => ({
    storeId: row.store_id,
    requiredStamps: row.required_stamps,
    reward: row.reward,
    unit: row.unit,
    condition: row.condition,
  })).filter(isStampPolicy);
}

const byNewest = (a: StampTransaction, b: StampTransaction) => Date.parse(b.createdAt) - Date.parse(a.createdAt);

export async function fetchStamps(): Promise<StampView[]> {
  const client = getSupabaseClient();
  const policies = await fetchStampPolicies();
  const { data: { session } } = await client.auth.getSession();
  let mineRows: MyStampProgress[] = [];
  let historyRows: StampTransaction[] = [];
  if (session) {
    const [mine, history] = await Promise.all([
      client.from('user_stamps').select('store_id, count'),
      client.from('stamp_transactions').select('request_id, store_id, delta, balance_after, reason, created_at').order('created_at', { ascending: false }),
    ]);
    if (mine.error || history.error) throw new Error('내 스탬프 내역을 불러오지 못했어요.');
    mineRows = (mine.data ?? []).map((row) => ({ storeId: row.store_id, count: row.count }));
    historyRows = (history.data ?? []).map((row) => ({
      id: row.request_id, storeId: row.store_id, delta: row.delta,
      balanceAfter: row.balance_after, reason: row.reason, createdAt: row.created_at,
    }));
  }
  const mine = new Map(mineRows.map((row) => [row.storeId, row.count]));
  const [stores, here] = await Promise.all([fetchStoresByIds(policies.map((policy) => policy.storeId)), getUserLocation()]);
  return policies.flatMap((policy) => {
    const store = stores.get(policy.storeId);
    if (!store) return [];
    const history = historyRows.filter((row) => row.storeId === policy.storeId).sort(byNewest);
    return [{
      ...policy,
      store,
      count: validBalance(mine.get(policy.storeId)),
      walkMinutes: walkMinutes(here, store.location),
      history,
      redeemedTimes: history.filter((row) => row.delta < 0).length,
      lastActivityAt: history[0]?.createdAt ?? null,
    }];
  });
}

/** 직원에게 보여줄 임시 적립 코드. 실제 잔액 변경은 서버의 검증된 처리만 수행한다. */
export const STAMP_CODE_TTL_SECONDS = 180;
export function issueStampCode(): { code: string; expiresAt: number } {
  const n = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
  return { code: n, expiresAt: Date.now() + STAMP_CODE_TTL_SECONDS * 1000 };
}
