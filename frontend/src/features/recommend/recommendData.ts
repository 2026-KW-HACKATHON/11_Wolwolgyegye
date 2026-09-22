import type { IconName } from '../../shared/icons';

/** 카테고리 id -> 그리드 카드에 쓸 아이콘/배경 (develop 브랜치 CATEGORIES 이식) */
export const CATEGORY_VISUALS: Record<string, { icon: IconName; bg: string }> = {
  'space-rental': { icon: 'house', bg: 'space' },
  'oneday-class': { icon: 'paletteColor', bg: 'class' },
  roulette: { icon: 'rouletteColor', bg: 'roulette' },
  'closing-sale': { icon: 'tagColor', bg: 'sale' },
  coupon: { icon: 'ticketColor', bg: 'coupon' },
  'partner-stores': { icon: 'storefrontColor', bg: 'partner' },
};

export interface NearbyFilter {
  key: string;
  label: string;
  icon?: IconName;
}

/** 내 주변 가게 화면의 탭 필터 (전체 + 카테고리 일부) */
export const NEARBY_FILTERS: NearbyFilter[] = [
  { key: 'all', label: '전체', icon: 'pin' },
  { key: 'class', label: '원데이 클래스', icon: 'paletteColor' },
  { key: 'roulette', label: '룰렛', icon: 'rouletteColor' },
  { key: 'sale', label: '마감세일', icon: 'tagColor' },
];

export interface StoreTag {
  type: 'coupon' | 'discount' | 'partner' | 'space';
  label: string;
}

export interface Store {
  id: string;
  name: string;
  icon: IconName;
  tags: StoreTag[];
  distance: string;
  address: string;
  categories: string[];
  position: { left: string; top: string };
}

/** 지도/리스트에 표시할 예시 가게 데이터 (사진 · 거리 · 주소 · 지도는 예시입니다) */
export const STORES: Store[] = [
  {
    id: 'coffee',
    name: '월계 커피',
    icon: 'coffee',
    tags: [
      { type: 'coupon', label: '쿠폰' },
      { type: 'discount', label: '할인' },
    ],
    distance: '150m',
    address: '월계1동 광운로 20',
    categories: ['all', 'sale'],
    position: { left: '28%', top: '30%' },
  },
  {
    id: 'bakery',
    name: '오늘빵 베이커리',
    icon: 'bread',
    tags: [
      { type: 'discount', label: '할인' },
      { type: 'partner', label: '제휴' },
    ],
    distance: '320m',
    address: '월계1동 월계로 105',
    categories: ['all', 'sale'],
    position: { left: '62%', top: '24%' },
  },
  {
    id: 'studio',
    name: '월계 스터디룸',
    icon: 'sofa',
    tags: [
      { type: 'space', label: '공간대여' },
      { type: 'partner', label: '제휴' },
    ],
    distance: '480m',
    address: '월계1동 광운로 62',
    categories: ['all', 'class'],
    position: { left: '45%', top: '58%' },
  },
];

export const STORE_THUMB_BG: Record<string, string> = {
  coffee: 'linear-gradient(145deg, var(--color-cat-space-bg), var(--color-cat-sale-bg))',
  bread: 'linear-gradient(145deg, var(--color-cat-sale-bg), var(--color-cat-coupon-bg))',
  sofa: 'linear-gradient(145deg, var(--color-cat-partner-bg), var(--color-cat-class-bg))',
};

export const NEIGHBORHOOD = '월계1동';
