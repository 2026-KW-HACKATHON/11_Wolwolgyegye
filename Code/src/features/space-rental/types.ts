/**
 * '공간 대여' 카테고리 전용 데이터.
 * 여기 있는 타입은 이 카테고리에서만 쓰며, 다른 팀원과 조율 없이 자유롭게 고치고 늘려도 된다.
 */

/** 대여 가능한 공간 하나 */
export interface SpaceRentalSpace {
  id: string;
  storeId: string;
  name: string;
  /** 시간당 대여료 (원) */
  pricePerHour: number;
  /** 대여 가능 시간대. 골격 단계라 단순 문자열 목록으로 둔다 (예: "10:00-12:00") */
  timeSlots: string[];
}