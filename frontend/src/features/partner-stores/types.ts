import type { Store } from '../../core/types/place';

/**
 * '제휴 가게' 카테고리 전용 데이터: 광운대학교 단과대학별 학생 제휴 혜택.
 * 여기 있는 타입은 이 카테고리에서만 쓰며, storeId 로 stores 테이블의 가게와 연결한다.
 */

/** 광운대학교 단과대학 */
export type CollegeKey = 'eie' | 'ai' | 'eng' | 'sci' | 'hss' | 'law' | 'biz' | 'chambit';
export type PartnerAudience = CollegeKey | 'all' | 'resident';
export type PartnerIndustry = '전체' | '음식점' | '카페·베이커리' | '생활·문화';

export interface PartnerBenefitDetails {
  status: 'demo' | 'verified' | 'needs-check';
  sourceUrl?: string;
  verifiedAt?: string;
  validUntil?: string;
  condition?: string;
  minimumSpend?: number;
  stampStacking?: 'allowed' | 'not-allowed' | 'unknown';
}

export interface College {
  key: CollegeKey;
  /** 버튼용 짧은 이름 */
  label: string;
  /** 정식 명칭 */
  name: string;
}

/** 가게 한 곳의 제휴 정보. 단과대별 DB 행을 가게별로 묶어서 사용한다. */
export interface PartnerBenefit {
  storeId: string;
  /** 단과대학별 혜택 문구. 키가 있는 단과대 학생만 혜택 대상 */
  benefits: Partial<Record<CollegeKey, string>>;
  /** 이용 조건 (예: 학생증 제시) */
  condition: string;
  details?: Partial<Record<CollegeKey, PartnerBenefitDetails>>;
}

/** 제휴 정보 + 가게 정보 + 기준점 직선거리. walkMinutes는 기존 호환 필드. */
export interface PartnerStoreView extends PartnerBenefit {
  store: Store;
  walkMinutes: number;
  referenceDistanceMeters: number;
  menus: PartnerStoreMenuItem[];
  dataMode: 'demo' | 'live';
}

/** 메뉴별로 검증된 할인만 지정하며 무료 증정 혜택은 금액으로 환산하지 않는다. */
export interface PartnerStoreMenuItem {
  id: string;
  storeId: string;
  name: string;
  /** 원 단위 정수 */
  price: number;
  discounts?: Partial<Record<CollegeKey, { type: 'amount' | 'percent'; value: number }>>;
}
