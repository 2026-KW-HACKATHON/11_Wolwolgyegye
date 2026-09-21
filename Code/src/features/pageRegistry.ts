import type { ComponentType } from 'react';
import RecommendPage from './recommend';
import SpaceRentalPage from './space-rental';
import OnedayClassPage from './oneday-class';
import RoulettePage from './roulette';
import ClosingSalePage from './closing-sale';
import CouponPage from './coupon';
import PartnerStoresPage from './partner-stores';
import LoginPage from './login';
import SettingsPage from './settings';

/**
 * 화면 id -> 페이지 컴포넌트 연결표.
 * id 는 core/categories/categories.ts 의 id 와 같아야 한다.
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
  login: LoginPage,
  settings: SettingsPage,
};