import type { SpaceRentalSpace } from './types';
import type { SpacePost } from '../store-feed/types';

/** storeId 는 core/mock/stores.ts 의 가게 id 와 맞춰서 쓴다 */
export const MOCK_SPACES: SpaceRentalSpace[] = [
  {
    id: 'space-003-1',
    storeId: 'store-003',
    name: '2인실',
    pricePerHour: 5000,
    timeSlots: ['10:00-12:00', '14:00-16:00'],
  },
  {
    id: 'space-003-2',
    storeId: 'store-003',
    name: '4인실',
    pricePerHour: 9000,
    timeSlots: ['13:00-15:00', '18:00-20:00'],
  },
];

function afterDays(days: number): string {
  const at = new Date();
  at.setDate(at.getDate() + days);
  at.setHours(14, 0, 0, 0);
  return at.toISOString();
}

const common = {
  origin: 'sample' as const,
  status: 'open' as const,
  imageUrl: '',
  contactPhone: '',
};

/** 가상 공간대여 피드. 이용 가능 여부는 사장님에게 확인해야 한다. */
export const MOCK_SPACE_POSTS: SpacePost[] = [
  {
    ...common, id: 'space-meeting', kind: 'space-rental', storeId: 'store-003',
    title: '생각이 모이는 조용한 스터디룸',
    description: '발표 연습부터 팀 프로젝트까지, 우리끼리 집중할 수 있는 공간을 빌려드려요.\n넓은 책상과 화이트보드가 준비되어 있습니다.',
    category: '스터디·회의', price: 9000, capacity: 4, minimumHours: 2,
    schedule: '매일 10:00–22:00 · 이용 날짜는 전화로 협의',
    notes: '와이파이 · 화이트보드 · 콘센트 제공\n음식물 반입은 문의해 주세요.',
    createdAt: afterDays(-1),
  },
  {
    ...common, id: 'space-party', kind: 'space-rental', storeId: 'store-005',
    title: '카페 문 닫는 날, 우리만의 작은 모임',
    description: '쉬는 날의 카페를 이웃에게 열어드려요. 친구들과의 생일 파티나 소규모 독서 모임을 편안하게 즐겨보세요.',
    category: '모임·파티', price: 25000, capacity: 10, minimumHours: 3,
    schedule: '월요일 12:00–20:00 · 사전 문의 필수',
    notes: '테이블 · 의자 · 블루투스 스피커\n이용 후 간단한 정리를 부탁드려요.',
    createdAt: afterDays(-2),
  },
  {
    ...common, id: 'space-photo', kind: 'space-rental', storeId: 'store-004',
    title: '오후의 빛이 머무는 촬영 공간',
    description: '공방 수업이 없는 시간, 창가의 따뜻한 빛을 담아보세요. 작은 제품 촬영이나 창작 모임에 잘 어울리는 공간이에요.',
    category: '촬영·작업', price: 18000, capacity: 3, minimumHours: 1,
    schedule: '화–금 10:00–12:00 · 공방 일정에 따라 협의',
    notes: '촬영 소품 일부 제공\n전문 촬영 장비는 직접 준비해 주세요.',
    createdAt: afterDays(-3),
  },
];
