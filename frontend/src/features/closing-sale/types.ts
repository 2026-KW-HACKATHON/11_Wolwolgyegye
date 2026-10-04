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
  /** 할인 유형: amount = 금액 할인 / rate = 퍼센트 할인 / free = 무료 제공 */
  discountType: 'amount' | 'rate' | 'free';
  /** amount 일 때 깎아 주는 금액 (원). 다른 유형은 null */
  discountAmount: number | null;
  /** rate 일 때 0 ~ 1 사이 소수 (0.3 = 30%). 다른 유형은 0 */
  discountRate: number;
  /** 제공 내용 (free 일 때 필수. 예: 빵 2개 사면 1개 무료) */
  offer: string;
  /** 조건 (예: 오후 8시 이후 포장) */
  condition: string;
  /** 화면용 한 줄 설명 (제공 내용 · 조건) */
  desc: string;
  /** 세일 시작·끝 시각 (ISO 문자열) */
  startsAt: string;
  closeAt: string;
  /** 관심 등록한 사람 수. 로그인 연동 후에는 사용자별 관심 테이블에서 세어 온다 */
  likeCount: number;
}

/** 화면이 받는 모양: 세일 + 가게 공통 정보 + 사용자 위치 기준 도보 시간 (source.ts 가 조합) */
export interface ClosingSaleView extends ClosingSale {
  store: Store;
  walkMinutes: number;
}
