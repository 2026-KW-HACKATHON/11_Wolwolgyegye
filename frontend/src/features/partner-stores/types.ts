import type { Store } from '../../core/types/place';

/**
 * '제휴 가게' 카테고리 전용 데이터: 광운대학교 단과대학별 학생 제휴 혜택.
 * 여기 있는 타입은 이 카테고리에서만 쓰며, storeId 로 core/mock/stores.ts (실제 연동 시 stores 테이블)의 가게와 연결한다.
 */

/** 광운대학교 단과대학 */
export type CollegeKey = 'eie' | 'ai' | 'eng' | 'sci' | 'hss' | 'law' | 'biz' | 'chambit';

export interface College {
  key: CollegeKey;
  /** 버튼용 짧은 이름 */
  label: string;
  /** 정식 명칭 */
  name: string;
}

/** 가게 한 곳의 제휴 정보 (DB 의 partner_benefits 테이블 한 행) */
export interface PartnerBenefit {
  storeId: string;
  /** 단과대학별 혜택 문구. 키가 있는 단과대 학생만 혜택 대상 */
  benefits: Partial<Record<CollegeKey, string>>;
  /** 이용 조건 (예: 학생증 제시) */
  condition: string;
}

/** 화면이 받는 모양: 제휴 정보 + 가게 공통 정보 + 도보 시간 (source.ts 가 조합) */
export interface PartnerStoreView extends PartnerBenefit {
  store: Store;
  walkMinutes: number;
}

/** 제휴 가게가 파는 메뉴 하나 (기존 규격 유지, 아직 화면에서 쓰지 않음) */
export interface PartnerStoreMenuItem {
  id: string;
  storeId: string;
  name: string;
  /** 원 단위 정수 */
  price: number;
}
