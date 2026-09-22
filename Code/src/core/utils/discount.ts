import type { ClosingSaleItem } from "../types/place";

/** 마감세일 상품의 할인가를 계산한다. 할인가는 저장하지 않고 항상 이 함수로 계산해서 쓴다. */
export function getDiscountedPrice(item: ClosingSaleItem): number {
  return Math.round(item.originalPrice * (1 - item.discountRate));
}

/** 할인률을 "30%" 같은 표시용 문자열로 바꾼다 */
export function formatDiscountRate(discountRate: number): string {
  return `${Math.round(discountRate * 100)}%`;
}
