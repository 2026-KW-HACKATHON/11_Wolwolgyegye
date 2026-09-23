/**
 * '제휴 가게' 카테고리 전용 데이터.
 * 여기 있는 타입은 이 카테고리에서만 쓰며, 다른 팀원과 조율 없이 자유롭게 고치고 늘려도 된다.
 * storeId 로 core/mock/stores.ts (실제 연동 시 stores 테이블)의 가게와 연결한다.
 */

/** 이 가게가 어디와 제휴 중인지 */
export interface PartnerStoreInfo {
  storeId: string;
  /** 제휴를 맺은 대상(다른 가게/브랜드 등) 목록 */
  partnerWith: string[];
}

/** 제휴 가게가 파는 메뉴 하나 */
export interface PartnerStoreMenuItem {
  id: string;
  storeId: string;
  name: string;
  /** 원 단위 정수 */
  price: number;
}