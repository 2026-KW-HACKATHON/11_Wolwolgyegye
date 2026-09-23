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
  { key: 'space', label: '공간 대여 글쓰기', desc: '비어 있는 공간을\n이웃에게 소개해요', icon: 'house', wide: true },
  { key: 'reservation', label: '예약 관리', desc: '신청 현황을\n확인하고 관리해요', icon: 'calendar' },
  { key: 'roulette', label: '룰렛 혜택', desc: '우리 가게만의\n혜택을 설정해요', icon: 'gift' },
  { key: 'sale', label: '마감세일', desc: '남은 상품을\n알리고 판매해요', icon: 'tag' },
  { key: 'coupon', label: '스탬프 관리', desc: '스탬프 적립과\n상품 교환을 관리해요', icon: 'ticket' },
  { key: 'info', label: '가게 정보', desc: '가게 소개와 운영 정보를 관리해요', icon: 'store', wide: true },
];
