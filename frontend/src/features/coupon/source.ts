import { fetchStoresByIds } from '../../core/source/storeSource';
import type { Store } from '../../core/types/place';
import { MOCK_COUPON_POLICIES } from './mock';
import type { CouponPolicy } from './types';

/** 화면이 받는 모양: 가게별 쿠폰 정책 + 가게 공통 정보 */
export type CouponPolicyView = CouponPolicy & { store: Store };

/**
 * 가게별 쿠폰 정책 목록을 가져오는 지점. 화면은 이 함수만 바라본다.
 * Supabase 연동 시 rows 를 가져오는 줄만 아래처럼 바꾸면 된다.
 *
 *   const { data: rows } = await supabase.from('coupon_policies').select('*');
 */
export async function fetchCouponPolicies(): Promise<CouponPolicyView[]> {
  const rows = MOCK_COUPON_POLICIES;
  const stores = await fetchStoresByIds(rows.map((r) => r.storeId));
  return rows.flatMap((row) => {
    const store = stores.get(row.storeId);
    return store ? [{ ...row, store }] : [];
  });
}
