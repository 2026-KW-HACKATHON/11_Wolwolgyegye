import type { ComponentType } from 'react';
import RecommendPage from './recommend';
import SpaceRentalPage from './space-rental';
import OnedayClassPage from './oneday-class';
import RoulettePage from './roulette';
import ClosingSalePage from './closing-sale';
import CouponPage from './coupon';
import PartnerStoresPage from './partner-stores';
import UserPage from './user';
import OwnerCenterPage from './owner/OwnerCenterPage';

/**
 * 1차 탭 id -> 탭 안에 들어갈 화면 컴포넌트 연결표.
 * id 는 core/categories/categories.ts 의 id (CATEGORIES, USER_PANEL) 와 같아야 한다.
 * 새 카테고리를 추가할 때: features/<이름>/ 폴더 생성 -> 여기에 한 줄 추가 -> categories.ts 에 한 항목 추가.
 */
export const PAGE_REGISTRY: Record<string, ComponentType> = {
  recommend: RecommendPage,
  'space-rental': SpaceRentalPage,
  'oneday-class': OnedayClassPage,
  roulette: RoulettePage,
  'closing-sale': ClosingSalePage,
  coupon: CouponPage,
  'partner-stores': PartnerStoresPage,
  owner: OwnerCenterPage,
  user: UserPage,
};