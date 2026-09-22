import type { CouponPolicy } from './types';

/** storeId 는 core/mock/stores.ts 의 가게 id 와 맞춰서 쓴다 */
export const MOCK_COUPON_POLICIES: CouponPolicy[] = [
  { storeId: 'store-005', requiredStamps: 10, reward: '음료 1잔 무료' },
];