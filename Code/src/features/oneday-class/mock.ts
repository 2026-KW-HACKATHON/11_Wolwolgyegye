import type { OnedayClassItem } from './types';

/** storeId 는 core/mock/stores.ts 의 가게 id 와 맞춰서 쓴다 */
export const MOCK_CLASSES: OnedayClassItem[] = [
  {
    id: 'class-001-1',
    storeId: 'store-001',
    name: '파스타 만들기 클래스',
    datetime: '2026-10-04T14:00:00',
    capacity: 8,
    fee: 35000,
  },
  {
    id: 'class-004-1',
    storeId: 'store-004',
    name: '도자기 원데이 클래스',
    datetime: '2026-10-05T13:00:00',
    capacity: 6,
    fee: 45000,
  },
];