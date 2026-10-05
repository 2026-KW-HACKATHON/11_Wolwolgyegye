import type { IconName } from '../../shared/icons';

export type OwnerMenuKey = 'space' | 'sale' | 'coupon' | 'info';

interface OwnerMenuItem {
  key: OwnerMenuKey;
  label: string;
  desc: string;
  icon: IconName;
  wide?: boolean;
  /** 아직 연결 전인 메뉴 (누르면 안내만) */
  pending?: boolean;
}

/** 사장님 화면 메뉴. DB 에 저장할 곳이 있는 기능만 둔다 */
export const OWNER_MENU: OwnerMenuItem[] = [
  { key: 'space', label: '공간 대여 글쓰기', desc: '비어 있는 공간을\n이웃에게 소개해요', icon: 'house', wide: true },
  { key: 'sale', label: '마감세일', desc: '남은 상품을\n알리고 판매해요', icon: 'tag' },
  // 스탬프 적립·교환은 로그인 연동 뒤에 붙인다
  { key: 'coupon', label: '스탬프 관리', desc: '스탬프 적립과\n상품 교환을 관리해요', icon: 'ticket', pending: true },
  { key: 'info', label: '가게 정보', desc: '기본 정보 · 영업시간 · 메뉴를 관리해요', icon: 'store', wide: true },
];
