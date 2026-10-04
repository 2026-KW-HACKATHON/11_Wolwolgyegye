import type { Store } from '../../core/types/place';

/**
 * '스탬프' 카테고리 전용 데이터. (예전 이름 '쿠폰제'. 폴더명·카테고리 id·URL 은 호환을 위해 coupon 유지)
 * 가게의 적립 규칙(StampPolicy), 로그인한 사용자 한 명의 적립 현황(MyStampProgress),
 * 적립·교환 이력(StampTransaction)을 따로 둔다. (DB: stamp_policies / user_stamps / stamp_transactions)
 */

/** 가게가 정한 스탬프 규칙 (DB 의 stamp_policies 테이블 한 행) */
export interface StampPolicy {
  storeId: string;
  /** 사장님이 정한 선물 1개당 필요 개수. 양의 정수이며 모든 화면·교환 계산의 기준. */
  requiredStamps: number;
  /** 받는 상품 (예: "아메리카노 1잔") */
  reward: string;
  /** 스탬프 1개가 찍히는 단위 (예: "음료 구매") */
  unit: string;
  /** 적립 조건·제외 조건 한 줄 */
  condition: string;
}

/**
 * 적립(+)·교환(-) 이력 한 건 (DB 의 stamp_transactions 테이블 한 행).
 * id 는 DB 의 request_id, createdAt 은 ISO 문자열(한국 시간 표기 포함).
 */
export interface StampTransaction {
  id: string;
  storeId: string;
  /** +1 = 적립, -requiredStamps = 상품 교환 */
  delta: number;
  /** 처리 후 잔액 */
  balanceAfter: number;
  reason: string;
  createdAt: string;
}

/** 로그인 사용자의 가게별 현재 잔액 (DB user_stamps). */
export interface MyStampProgress {
  storeId: string;
  count: number;
}

/** 화면이 받는 모양: 규칙 + 내 적립 수 + 가게 공통 정보 + 도보 시간 + 이력 (source.ts 가 조합) */
export interface StampView extends StampPolicy {
  store: Store;
  count: number;
  walkMinutes: number;
  /** 최신순 */
  history: StampTransaction[];
  /** 지금까지 상품으로 교환한 횟수 (이력에서 계산) */
  redeemedTimes: number;
  /** 마지막으로 적립·교환한 시각 (없으면 null) */
  lastActivityAt: string | null;
}

/** 목록 상태 필터 */
export type StampFilter = 'all' | 'ready' | 'collecting' | 'saved';

/** 목록 정렬 */
export type StampSort = 'closest-reward' | 'near' | 'recent' | 'name';
