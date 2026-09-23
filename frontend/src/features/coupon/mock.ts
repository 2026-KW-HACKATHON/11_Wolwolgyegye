import type { MyStampProgress, StampPolicy } from './types';

/** storeId 는 core/mock/stores.ts 의 가게 id 와 맞춰서 쓴다 (supports.coupon 이 켜진 가게) */
export const MOCK_STAMP_POLICIES: StampPolicy[] = [
  { storeId: 'store-005', requiredStamps: 10, reward: '아메리카노 1잔', unit: '음료 구매', condition: '유료 음료 1잔당 1개 적립 · 무료 제공 음료는 적립 제외' },
  { storeId: 'store-006', requiredStamps: 10, reward: '소금빵 1개', unit: '5,000원 이상 구매', condition: '5,000원 이상 결제 시 1개 적립 · 결제 1건당 1개' },
  { storeId: 'store-013', requiredStamps: 10, reward: '덮밥 1그릇', unit: '식사 이용', condition: '유료 식사 1회당 1개 적립 · 음료만 주문 시 제외' },
  { storeId: 'store-025', requiredStamps: 10, reward: '순대국 1그릇', unit: '식사 이용', condition: '유료 식사 1회당 1개 적립 · 포장 주문 포함' },
  { storeId: 'store-031', requiredStamps: 10, reward: '떡볶이 1인분', unit: '8,000원 이상 주문', condition: '8,000원 이상 주문 시 1개 적립 · 배달 주문 제외' },
  { storeId: 'store-003', requiredStamps: 10, reward: '1시간 이용권', unit: '2시간 이상 이용', condition: '2시간 이상 유료 이용 시 1개 적립 · 이용 종료 후 적립' },
];

/** UI 확인용 가상 적립 현황. 실제 사용자 데이터가 아니다 */
export const MOCK_MY_STAMPS: MyStampProgress[] = [
  { storeId: 'store-005', count: 7 },
  { storeId: 'store-006', count: 3 },
  { storeId: 'store-013', count: 10 },
  { storeId: 'store-025', count: 5 },
  { storeId: 'store-031', count: 1 },
];
