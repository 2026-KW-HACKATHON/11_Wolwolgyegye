import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { walkMinutes } from '../../core/utils/geo';
import { MOCK_MY_STAMPS, MOCK_STAMP_HISTORY, MOCK_STAMP_POLICIES } from './mock';
import type { StampTransaction, StampView } from './types';

/**
 * 스탬프 데이터를 가져오고 바꾸는 지점. 화면은 이 파일의 함수만 바라본다.
 * Supabase 연동 시 이 파일 안만 바꾸면 된다.
 *
 *   const { data: policies } = await supabase.from('stamp_policies').select('*');
 *   const { data: mine } = await supabase.from('user_stamps').select('*').eq('user_id', userId);
 *   const { data: history } = await supabase.from('stamp_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
 *
 * 실제 적립·교환은 손님 앱이 직접 하지 않는다. 직원(사장님 화면)이 적립 코드를 확인하면
 * 서버가 apply_stamp_change() 로 처리한다. 아래 recordDemoStamp 는 발표·시연용으로
 * 그 과정을 이 브라우저(localStorage)에서만 흉내 낸다.
 */

const DEMO_KEY = 'wolwol.stamp.demo.v1';

function isTransaction(value: unknown): value is StampTransaction {
  const v = value as StampTransaction;
  return !!v && typeof v.id === 'string' && typeof v.storeId === 'string' && Number.isInteger(v.delta)
    && Number.isInteger(v.balanceAfter) && typeof v.reason === 'string' && Number.isFinite(Date.parse(v.createdAt));
}

function loadDemo(): StampTransaction[] {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(DEMO_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter(isTransaction).map((t) => ({ ...t, origin: 'demo' as const })) : [];
  } catch {
    return [];
  }
}

function saveDemo(list: StampTransaction[]) {
  try { window.localStorage.setItem(DEMO_KEY, JSON.stringify(list)); } catch { /* 저장 실패 시 이번 화면에서만 반영 */ }
}

const byNewest = (a: StampTransaction, b: StampTransaction) => Date.parse(b.createdAt) - Date.parse(a.createdAt);

export async function fetchStamps(): Promise<StampView[]> {
  const policies = MOCK_STAMP_POLICIES;
  const mine = new Map(MOCK_MY_STAMPS.map((m) => [m.storeId, m.count]));
  const demo = loadDemo();
  const [stores, here] = await Promise.all([fetchStoresByIds(policies.map((p) => p.storeId)), getUserLocation()]);
  return policies.flatMap((policy) => {
    const store = stores.get(policy.storeId);
    if (!store) return [];
    const mineDemo = demo.filter((t) => t.storeId === policy.storeId);
    let count = Math.min(mine.get(policy.storeId) ?? 0, policy.requiredStamps);
    [...mineDemo].sort((a, b) => -byNewest(a, b)).forEach((t) => { count = Math.max(0, Math.min(policy.requiredStamps, count + t.delta)); });
    const history = [...MOCK_STAMP_HISTORY.filter((t) => t.storeId === policy.storeId), ...mineDemo].sort(byNewest);
    return [{
      ...policy,
      store,
      count,
      walkMinutes: walkMinutes(here, store.location),
      history,
      redeemedTimes: history.filter((t) => t.delta < 0).length,
      lastActivityAt: history[0]?.createdAt ?? null,
    }];
  });
}

/**
 * [시연용] 직원 확인이 끝났다고 가정하고 적립(+1) 또는 상품 교환(-필요 개수)을 기록한다.
 * 규칙은 DB 함수와 같다: 잔액이 0 미만이 되거나, 다 모은 적립판에 더 찍을 수 없다.
 */
export async function recordDemoStamp(view: StampView, kind: 'earn' | 'redeem'): Promise<StampTransaction> {
  if (kind === 'earn' && view.count >= view.requiredStamps) throw new Error('FULL');
  if (kind === 'redeem' && view.count < view.requiredStamps) throw new Error('NOT_ENOUGH');
  const delta = kind === 'earn' ? 1 : -view.requiredStamps;
  const tx: StampTransaction = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    storeId: view.storeId,
    delta,
    balanceAfter: view.count + delta,
    reason: kind === 'earn' ? view.unit : `상품 교환 · ${view.reward}`,
    createdAt: new Date().toISOString(),
    origin: 'demo',
  };
  saveDemo([...loadDemo(), tx]);
  return tx;
}

/** [시연용] 이 브라우저에서 추가한 적립·교환 기록을 지운다 */
export async function resetStampDemo(): Promise<void> {
  try { window.localStorage.removeItem(DEMO_KEY); } catch { /* 무시 */ }
}

export function hasStampDemo(): boolean {
  return loadDemo().length > 0;
}

/**
 * 직원에게 보여줄 적립 코드. 실제 서비스에서는 서버가 사용자·시간에 묶어 발급하고,
 * 직원이 사장님 화면에서 입력하면 적립된다. 지금은 화면 확인용 임의 숫자다.
 */
export const STAMP_CODE_TTL_SECONDS = 180;
export function issueStampCode(): { code: string; expiresAt: number } {
  const n = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
  return { code: n, expiresAt: Date.now() + STAMP_CODE_TTL_SECONDS * 1000 };
}
