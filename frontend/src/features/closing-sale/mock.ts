import type { ClosingSale, ClosingSaleItem } from './types';

/**
 * 예시 세일. 시연할 때 항상 "지금부터 N분 뒤 마감"으로 보이도록
 * 마감 시각은 고정값이 아니라 화면을 연 시각 기준 오프셋(분)으로 갖고 있고, source.ts 가 closeAt 으로 바꾼다.
 * storeId 는 core/mock/stores.ts 의 가게 id 와 맞춰서 쓴다.
 */
export interface ClosingSaleSeed extends Omit<ClosingSale, 'closeAt'> {
  /** 지금부터 몇 분 뒤에 마감하는지 */
  closesInMinutes: number;
}

export const MOCK_CLOSING_SALES: ClosingSaleSeed[] = [
  { id: 'sale-006', storeId: 'store-006', desc: '당일 생산 빵 전 품목 마감 할인', discountRate: 0.3, likeCount: 28, closesInMinutes: 42 },
  { id: 'sale-005', storeId: 'store-005', desc: '디저트 세트 및 베이커리 전 품목', discountRate: 0.2, likeCount: 16, closesInMinutes: 78 },
  { id: 'sale-002', storeId: 'store-002', desc: '오늘 만든 반찬 5종 이상 구매 시', discountRate: 0.4, likeCount: 42, closesInMinutes: 125 },
  { id: 'sale-007', storeId: 'store-007', desc: '남은 제철 과일 한 상자 떨이', discountRate: 0.35, likeCount: 21, closesInMinutes: 96 },
  { id: 'sale-008', storeId: 'store-008', desc: '모둠 초밥 · 회덮밥 포장 한정', discountRate: 0.25, likeCount: 34, closesInMinutes: 55 },
  { id: 'sale-009', storeId: 'store-009', desc: '당일 제조 샐러드·랩 전 품목', discountRate: 0.5, likeCount: 19, closesInMinutes: 30 },
];

export const MOCK_CLOSING_SALE_ITEMS: ClosingSaleItem[] = [
  { id: 'sale-002-1', storeId: 'store-002', name: '잡채', originalPrice: 8000, discountRate: 0.3 },
  { id: 'sale-002-2', storeId: 'store-002', name: '오늘의 국', originalPrice: 6000, discountRate: 0.5 },
];
