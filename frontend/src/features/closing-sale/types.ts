import type { Store } from '../../core/types/place';

/**
 * '마감세일' 카테고리 전용 데이터.
 * 여기 있는 타입은 이 카테고리에서만 쓰며, 다른 팀원과 조율 없이 자유롭게 고치고 늘려도 된다.
 * 가게 이름·업종·위치는 여기 두지 않고 storeId 로 core 의 Store 를 참조한다.
 */

/** 가게가 등록한 마감세일 한 건 (DB 의 closing_sales 테이블 한 행). 사장님 화면(/owner)에서 등록한다 */
export interface ClosingSale {
  id: string;
  storeId: string;
  /** 어떤 상품을 얼마나 깎아 주는지 한 줄 설명 */
  desc: string;
  /** 0 ~ 1 사이 소수. 예: 0.3 = 30% 할인 */
  discountRate: number;
  /** 세일이 끝나는 시각 (ISO 문자열) */
  closeAt: string;
  /** 관심 등록한 사람 수. 로그인 연동 후에는 사용자별 관심 테이블에서 세어 온다 */
  likeCount: number;
}

/** 화면이 받는 모양: 세일 + 가게 공통 정보 + 사용자 위치 기준 도보 시간 (source.ts 가 조합) */
export interface ClosingSaleView extends ClosingSale {
  store: Store;
  walkMinutes: number;
}
