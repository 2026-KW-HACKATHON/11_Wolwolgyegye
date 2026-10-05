import type { ReactNode } from 'react';
import type { StoreDetail } from '../core/source/storeDetail';
import ClosingSaleSection from './closing-sale/ClosingSaleSection';
import PartnerSection from './partner-stores/PartnerSection';
import StoreFeedSection from './store-feed/StoreFeedSection';

/**
 * 2차 탭(가게 화면) 안에 이어 붙이는 카테고리 묶음. 배열 순서 = 2차 탭에 나오는 순서 (카테고리 바 순서).
 * 각 묶음은 1차 탭에서 항목을 눌렀을 때 보던 상세 화면을, 가게 id 만 받아 스스로 불러와 그린다.
 * has: 그 가게에 이 카테고리 내용이 있는지 (2차 탭이 이미 읽어 온 가게 정보로 판단). 없으면 묶음을 그리지 않는다.
 * 스탬프는 로그인 연동 뒤에 붙이고, 룰렛은 가게 화면에 넣지 않는다.
 */
export interface StoreSection {
  id: string;
  label: string;
  has: (detail: StoreDetail) => boolean;
  render: (storeId: string) => ReactNode;
}

export const STORE_SECTIONS: StoreSection[] = [
  { id: 'space-rental', label: '공간대여', has: (d) => d.spaceRentals.length > 0, render: (id) => <StoreFeedSection kind="space-rental" storeId={id} /> },
  { id: 'oneday-class', label: '원데이클래스', has: (d) => d.classes.length > 0, render: (id) => <StoreFeedSection kind="oneday-class" storeId={id} /> },
  { id: 'closing-sale', label: '마감세일', has: (d) => d.sales.length > 0, render: (id) => <ClosingSaleSection storeId={id} /> },
  { id: 'partner-stores', label: '제휴 혜택', has: (d) => d.benefits.length > 0, render: (id) => <PartnerSection storeId={id} /> },
];
