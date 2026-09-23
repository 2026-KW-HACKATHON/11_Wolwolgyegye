/**
 * '원데이클래스' 카테고리 전용 데이터.
 * 여기 있는 타입은 이 카테고리에서만 쓰며, 다른 팀원과 조율 없이 자유롭게 고치고 늘려도 된다.
 */

/** 개설된 원데이클래스 하나 */
export interface OnedayClassItem {
  id: string;
  storeId: string;
  name: string;
  /** 골격 단계라 자유 문자열/ISO 문자열로 둔다. 예: "2026-10-04T14:00:00" */
  datetime: string;
  /** 정원 (명) */
  capacity: number;
  /** 참가비 (원) */
  fee: number;
}