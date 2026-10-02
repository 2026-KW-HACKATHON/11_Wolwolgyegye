import type { MyStampProgress, StampPolicy, StampTransaction } from './types';

/** 사장님이 등록한 규칙의 API 응답 예시. 목표·선물은 가게별로 다르다. */
export const MOCK_STAMP_POLICIES: StampPolicy[] = [
  { storeId: 'store-005', requiredStamps: 8, reward: '아메리카노 1잔', unit: '음료 구매', condition: '유료 음료 1잔당 1개 적립 · 무료 제공 음료는 적립 제외' },
  { storeId: 'store-006', requiredStamps: 5, reward: '소금빵 1개', unit: '5,000원 이상 구매', condition: '5,000원 이상 결제 시 1개 적립 · 결제 1건당 1개' },
  { storeId: 'store-013', requiredStamps: 10, reward: '덮밥 1그릇', unit: '식사 이용', condition: '유료 식사 1회당 1개 적립 · 음료만 주문 시 제외' },
  { storeId: 'store-025', requiredStamps: 12, reward: '순대국 1그릇', unit: '식사 이용', condition: '유료 식사 1회당 1개 적립 · 포장 주문 포함' },
  { storeId: 'store-031', requiredStamps: 15, reward: '떡볶이 1인분', unit: '8,000원 이상 주문', condition: '8,000원 이상 주문 시 1개 적립 · 배달 주문 제외' },
  { storeId: 'store-003', requiredStamps: 6, reward: '1시간 이용권', unit: '2시간 이상 이용', condition: '2시간 이상 유료 이용 시 1개 적립 · 이용 종료 후 적립' },
];

/** UI 확인용 가상 적립 현황. 실제 사용자 데이터가 아니다 */
export const MOCK_MY_STAMPS: MyStampProgress[] = [
  { storeId: 'store-005', count: 7 },
  { storeId: 'store-006', count: 3 },
  { storeId: 'store-013', count: 10 },
  { storeId: 'store-025', count: 5 },
  { storeId: 'store-031', count: 1 },
];

/**
 * 예시 적립·교환 이력 (stamp_transactions 모양). 오래된 순으로 적고, 처리 후 잔액은 차례로 더해서 만든다.
 * 마지막 잔액이 위 MOCK_MY_STAMPS 의 count 와 같아야 한다.
 */
function sample(storeId: string, reason: string, rows: Array<[at: string, delta?: number, why?: string]>): StampTransaction[] {
  let balance = 0;
  return rows.map(([at, delta = 1, why = reason], i) => {
    balance += delta;
    return { id: `sample-${storeId}-${i + 1}`, storeId, delta, balanceAfter: balance, reason: why, createdAt: at, origin: 'sample' };
  });
}

export const MOCK_STAMP_HISTORY: StampTransaction[] = [
  // 과거에는 10개 기준으로 교환한 이력. 현재 8개 정책으로 과거 거래를 다시 계산하지 않는다.
  ...sample('store-005', '음료 구매', [
    ['2026-07-14T08:42:00+09:00'], ['2026-07-18T13:05:00+09:00'], ['2026-07-22T08:51:00+09:00'], ['2026-07-29T15:20:00+09:00'],
    ['2026-08-03T09:10:00+09:00'], ['2026-08-07T12:48:00+09:00'], ['2026-08-11T08:37:00+09:00'], ['2026-08-14T16:02:00+09:00'],
    ['2026-08-19T08:55:00+09:00'], ['2026-08-21T13:30:00+09:00'],
    ['2026-08-21T13:31:00+09:00', -10, '상품 교환 · 아메리카노 1잔'],
    ['2026-09-01T08:40:00+09:00'], ['2026-09-04T12:15:00+09:00'], ['2026-09-09T08:47:00+09:00'], ['2026-09-15T14:22:00+09:00'],
    ['2026-09-19T08:58:00+09:00'], ['2026-09-24T13:11:00+09:00'], ['2026-09-29T08:44:00+09:00'],
  ]),
  ...sample('store-006', '5,000원 이상 구매', [
    ['2026-09-06T10:12:00+09:00'], ['2026-09-17T19:40:00+09:00'], ['2026-09-27T11:03:00+09:00'],
  ]),
  ...sample('store-013', '식사 이용', [
    ['2026-08-05T12:20:00+09:00'], ['2026-08-12T12:34:00+09:00'], ['2026-08-19T18:10:00+09:00'], ['2026-08-26T12:25:00+09:00'],
    ['2026-09-02T12:41:00+09:00'], ['2026-09-08T18:27:00+09:00'], ['2026-09-14T12:16:00+09:00'], ['2026-09-18T12:30:00+09:00'],
    ['2026-09-23T18:45:00+09:00'], ['2026-09-28T12:22:00+09:00'],
  ]),
  ...sample('store-025', '식사 이용', [
    ['2026-08-30T19:05:00+09:00'], ['2026-09-06T12:50:00+09:00'], ['2026-09-13T19:32:00+09:00'], ['2026-09-20T12:44:00+09:00', 1, '식사 이용 · 포장'],
    ['2026-09-26T19:18:00+09:00'],
  ]),
  ...sample('store-031', '8,000원 이상 주문', [
    ['2026-09-25T16:40:00+09:00'],
  ]),
];
