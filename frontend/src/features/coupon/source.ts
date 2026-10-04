import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { getSupabaseClient } from '../../core/supabase/client';
import { walkMinutes } from '../../core/utils/geo';
import type { StampPolicy, StampTransaction, StampView } from './types';
import { isStampPolicy, validBalance } from './policy';

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
let unsavedDemo: StampTransaction[] | null = null;
const recordingStores = new Set<string>();

/**
 * 사장님이 정한 스탬프 규칙: DB stamp_policies (공개 가게만, RLS). 손님 화면에는 규칙 편집 UI를 두지 않는다.
 * 잘못된 규칙은 목록에서 제외하며 임의로 10개를 넣지 않는다. 연결에 실패하면 빈 목록.
 */
async function fetchStampPolicies(): Promise<StampPolicy[]> {
  try {
    const { data, error } = await getSupabaseClient().from('stamp_policies')
      .select('store_id, required_stamps, reward, unit, condition');
    if (error) throw error;
    const rows = ((data ?? []) as { store_id: string; required_stamps: number; reward: string; unit: string; condition: string }[])
      .map((r): StampPolicy => ({ storeId: r.store_id, requiredStamps: r.required_stamps, reward: r.reward, unit: r.unit, condition: r.condition }));
    return rows.filter(isStampPolicy).map((policy) => ({ ...policy }));
  } catch {
    return [];
  }
}

function isTransaction(value: unknown): value is StampTransaction {
  const v = value as StampTransaction;
  return !!v && typeof v.id === 'string' && typeof v.storeId === 'string' && Number.isInteger(v.delta)
    && Number.isSafeInteger(v.delta) && v.delta !== 0 && Number.isSafeInteger(v.balanceAfter)
    && v.balanceAfter >= 0 && typeof v.reason === 'string' && Number.isFinite(Date.parse(v.createdAt));
}

function loadDemo(): StampTransaction[] {
  if (unsavedDemo) return unsavedDemo;
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(DEMO_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter(isTransaction).map((t) => ({ ...t, origin: 'demo' as const })) : [];
  } catch {
    return [];
  }
}

function saveDemo(list: StampTransaction[]) {
  try { window.localStorage.setItem(DEMO_KEY, JSON.stringify(list)); unsavedDemo = null; }
  catch { unsavedDemo = list; /* 저장 차단 시 이번 세션에서만 유지 */ }
}

const byNewest = (a: StampTransaction, b: StampTransaction) => Date.parse(b.createdAt) - Date.parse(a.createdAt);

export async function fetchStamps(): Promise<StampView[]> {
  const policies = await fetchStampPolicies();
  // TODO(DB·로그인): 내 스탬프 잔액. 로그인 연결 전까지는 없다.
  const mine = new Map<string, number>();
  const demo = loadDemo();
  const [stores, here] = await Promise.all([fetchStoresByIds(policies.map((p) => p.storeId)), getUserLocation()]);
  return policies.flatMap((policy) => {
    const store = stores.get(policy.storeId);
    if (!store) return [];
    const mineDemo = demo.filter((t) => t.storeId === policy.storeId);
    // 목표가 낮아져도 기존 잔액을 잘라내지 않는다. 과거 거래의 차감량도 그대로 보존한다.
    let count = validBalance(mine.get(policy.storeId));
    [...mineDemo].sort((a, b) => -byNewest(a, b)).forEach((t) => {
      const next = count + t.delta;
      if (Number.isSafeInteger(next) && next >= 0) count = next;
    });
    const history = [...mineDemo].sort(byNewest);
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
  if (recordingStores.has(view.storeId)) throw new Error('BUSY');
  recordingStores.add(view.storeId);
  try {
    const current = (await fetchStamps()).find((v) => v.storeId === view.storeId);
    if (!current) throw new Error('POLICY_UNAVAILABLE');
    if (current.requiredStamps !== view.requiredStamps || current.reward !== view.reward
      || current.unit !== view.unit || current.condition !== view.condition) throw new Error('POLICY_CHANGED');
    if (kind === 'earn' && current.count >= current.requiredStamps) throw new Error('FULL');
    if (kind === 'redeem' && current.count < current.requiredStamps) throw new Error('NOT_ENOUGH');
    const delta = kind === 'earn' ? 1 : -current.requiredStamps;
    const tx: StampTransaction = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      storeId: view.storeId,
      delta,
      balanceAfter: current.count + delta,
      reason: kind === 'earn' ? current.unit : `상품 교환 · ${current.reward}`,
      createdAt: new Date().toISOString(),
      origin: 'demo',
    };
    saveDemo([...loadDemo(), tx]);
    return tx;
  } finally { recordingStores.delete(view.storeId); }
}

/** [시연용] 이 브라우저에서 추가한 적립·교환 기록을 지운다 */
export async function resetStampDemo(): Promise<void> {
  try { window.localStorage.removeItem(DEMO_KEY); unsavedDemo = null; }
  catch { unsavedDemo = []; }
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
