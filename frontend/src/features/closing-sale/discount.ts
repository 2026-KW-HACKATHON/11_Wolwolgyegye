import type { ClosingSale } from './types';

/** 할인 표시: 퍼센트 "30%", 금액 "2,000원", 무료 제공 "무료" */
export function formatSaleDiscount(sale: Pick<ClosingSale, 'discountType' | 'discountAmount' | 'discountRate'>): string {
  if (sale.discountType === 'rate') return `${Math.round(sale.discountRate * 100)}%`;
  if (sale.discountType === 'amount') return `${(sale.discountAmount ?? 0).toLocaleString('ko-KR')}원`;
  return '무료';
}

/** 할인율순 정렬용: 퍼센트 할인 → 금액 할인(큰 금액 먼저) → 무료 제공 */
export function discountSortValue(sale: Pick<ClosingSale, 'discountType' | 'discountAmount' | 'discountRate'>): number {
  if (sale.discountType === 'rate') return 2 + sale.discountRate;
  if (sale.discountType === 'amount') return 1 + Math.min(sale.discountAmount ?? 0, 999_999) / 1_000_000;
  return 0;
}