import type { MenuKind } from '../../core/source/storeDetail';
import type { Store } from '../../core/types/place';

export type CollegeKey = 'eie' | 'ai' | 'eng' | 'sci' | 'hss' | 'law' | 'biz';
export type PartnerAudience = CollegeKey | 'all';
export type PartnerIndustry = '전체' | '음식점' | '카페·베이커리' | '생활·문화';

export interface College {
  key: CollegeKey;
  label: string;
  name: string;
}

export interface PartnerStoreMenuItem {
  id: string;
  storeId: string;
  name: string;
  price: number;
  section: string | null;
  kind: MenuKind | null;
  description: string | null;
}

export interface PartnerBenefit {
  id: string;
  storeId: string;
  colleges: CollegeKey[];
  /** 엑셀에 적힌 실제 할인·증정·이용 조건 원문 */
  offer: string;
  condition: string;
}

/** 실제 엑셀의 단과대-가게 관계와 해당 가게의 전체 메뉴를 합친 화면 모델. */
export interface PartnerStoreView {
  storeId: string;
  colleges: CollegeKey[];
  store: Store;
  referenceDistanceMeters: number;
  menus: PartnerStoreMenuItem[];
  benefits: PartnerBenefit[];
}
