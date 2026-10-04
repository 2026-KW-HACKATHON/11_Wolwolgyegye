/** 할인률을 "30%" 같은 표시용 문자열로 바꾼다 */
export function formatDiscountRate(discountRate: number): string {
  return `${Math.round(discountRate * 100)}%`;
}