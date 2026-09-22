import type { IconName } from '../../shared/icons';

export interface OwnerMenuItem {
  key: string;
  label: string;
  desc: string;
  icon: IconName;
  wide?: boolean;
}

/** develop 브랜치 frontend/js/data.js 의 OWNER_MENU 이식 */
export const OWNER_MENU: OwnerMenuItem[] = [
  { key: 'reservation', label: '예약 관리', desc: '신청 현황을\n확인하고 관리해요', icon: 'calendar' },
  { key: 'roulette', label: '룰렛 혜택', desc: '우리 가게만의\n혜택을 설정해요', icon: 'gift' },
  { key: 'sale', label: '마감세일', desc: '남은 상품을\n알리고 판매해요', icon: 'tag' },
  { key: 'coupon', label: '쿠폰 관리', desc: '쿠폰을 발행하고\n관리해요', icon: 'ticket' },
  { key: 'info', label: '가게 정보', desc: '가게 소개와 운영 정보를 관리해요', icon: 'store', wide: true },
];