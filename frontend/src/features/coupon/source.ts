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

/** 직원에게 보여줄 임시 적립 코드. 서버가 만들어 저장하고, 사장님이 입력하면 서버가 적립한다. */
export const STAMP_CODE_TTL_SECONDS = 180;
export interface StampCode { code: string; expiresAt: number }

export async function issueStampCode(storeId: string): Promise<StampCode> {
  const { data, error } = await getSupabaseClient().rpc('issue_stamp_code', { p_store_id: storeId });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    throw new Error(error?.code === '42501' ? '로그인한 손님만 적립 코드를 받을 수 있어요.' : '적립 코드를 받지 못했어요.');
  }
  return { code: row.code, expiresAt: Date.parse(row.expires_at) };
}

/** 이 코드로 적립이 끝났으면 찍힌 개수, 아직이면 null */
export async function fetchStampCodeUse(storeId: string, code: string): Promise<number | null> {
  const { data, error } = await getSupabaseClient().from('stamp_codes')
    .select('code, used_count').eq('store_id', storeId).maybeSingle();
  if (error || !data || data.code !== code) return null;
  return data.used_count ?? null;
}
