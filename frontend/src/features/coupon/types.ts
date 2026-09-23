import type { Store } from '../../core/types/place';

/**
 * '스탬프' 카테고리 전용 데이터. (예전 이름 '쿠폰제'. 폴더명·카테고리 id·URL 은 호환을 위해 coupon 유지)
 * 가게의 적립 규칙(StampPolicy)과, 로그인한 사용자 한 명의 적립 현황(MyStampProgress)을 따로 둔다.
 */

/** 가게가 정한 스탬프 규칙 (DB 의 stamp_policies 테이블 한 행) */
export interface StampPolicy {
  storeId: string;
  /** 상품을 받기까지 채워야 하는 스탬프 개수 */
  requiredStamps: number;
  /** 받는 상품 (예: "아메리카노 1잔") */
  reward: string;
  /** 스탬프 1개가 찍히는 단위 (예: "음료 구매") */
  unit: string;
  /** 적립 조건·제외 조건 한 줄 */
  condition: string;
}

/** 사용자별 적립 현황. 로그인 연동 후에는 사용자 id 로 조회한다 */
export interface MyStampProgress {
  storeId: string;
  count: number;
}

/** 화면이 받는 모양: 규칙 + 내 적립 수 + 가게 공통 정보 + 도보 시간 (source.ts 가 조합) */
export interface StampView extends StampPolicy {
  store: Store;
  count: number;
  walkMinutes: number;
}

/** 목록 업종 필터. cuisineType 으로 나눈다 */
export type StampIndustry = '전체' | '카페·베이커리' | '음식점' | '생활·문화';
