/**
 * '쿠폰제' 카테고리 상세: 가게의 쿠폰 정책만 담는다.
 * "이 손님이 몇 번 찍었는지"(사용자별 스탬프 개수)는 로그인한 사용자 한 명 한 명에게 딸린
 * 완전히 다른 데이터라서 여기 포함하지 않는다. 로그인 연동 단계에서 별도로 설계한다.
 */
export interface CouponPolicy {
  storeId: string;
  /** 혜택을 받기까지 채워야 하는 방문(도장) 횟수 */
  requiredStamps: number;
  /** 혜택 내용 (예: "음료 1잔 무료") */
  reward: string;
}