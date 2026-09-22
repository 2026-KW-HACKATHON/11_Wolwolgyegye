import type { ClosingSaleItem } from './types';

/** storeId 는 core/mock/stores.ts 의 가게 id 와 맞춰서 쓴다 */
export const MOCK_CLOSING_SALE_ITEMS: ClosingSaleItem[] = [
  { id: 'sale-002-1', storeId: 'store-002', name: '잡채', originalPrice: 8000, discountRate: 0.3 },
  { id: 'sale-002-2', storeId: 'store-002', name: '오늘의 국', originalPrice: 6000, discountRate: 0.5 },
];