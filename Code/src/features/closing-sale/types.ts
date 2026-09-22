/**
 * '마감세일' 카테고리 전용 데이터.
 * 여기 있는 타입은 이 카테고리에서만 쓰며, 다른 팀원과 조율 없이 자유롭게 고치고 늘려도 된다.
 */

/** 마감세일 중인 상품 하나. 할인가는 저장하지 않고 discount.ts 의 함수로 계산해서 쓴다 */
export interface ClosingSaleItem {
  id: string;
  storeId: string;
  name: string;
  /** 원 단위 정수 */
  originalPrice: number;
  /** 0 ~ 1 사이 소수. 예: 0.3 = 30% 할인 */
  discountRate: number;
}