import type { OnedayClassItem } from './types';
import type { ClassPost } from '../store-feed/types';

/** storeId 는 core/mock/stores.ts 의 가게 id 와 맞춰서 쓴다 */
export const MOCK_CLASSES: OnedayClassItem[] = [
  {
    id: 'class-001-1',
    storeId: 'store-001',
    name: '파스타 만들기 클래스',
    datetime: '2026-10-04T14:00:00',
    capacity: 8,
    fee: 35000,
  },
  {
    id: 'class-004-1',
    storeId: 'store-004',
    name: '도자기 원데이 클래스',
    datetime: '2026-10-05T13:00:00',
    capacity: 6,
    fee: 45000,
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

/** 가상 원데이클래스 피드. 날짜는 실행 시점 기준 시연용이다. */
export const MOCK_CLASS_POSTS: ClassPost[] = [
  {
    ...common, id: 'class-pasta', kind: 'oneday-class', storeId: 'store-001',
    title: '우리의 첫 생면 파스타 만들기',
    description: '밀가루 반죽부터 소스까지, 사장님과 함께 한 접시를 완성해요.\n요리가 처음인 분도, 색다른 데이트를 찾는 분도 환영합니다.',
    category: '요리·베이킹', price: 35000, capacity: 8, startsAt: afterDays(7), durationMinutes: 120,
    notes: '재료비 · 앞치마 포함\n알레르기가 있다면 문의할 때 알려주세요.',
    createdAt: afterDays(-1),
  },
  {
    ...common, id: 'class-pottery', kind: 'oneday-class', storeId: 'store-004',
    title: '손끝으로 빚는 나만의 도자기 컵',
    description: '흙을 만지며 잠시 쉬어가는 시간. 매일 쓰고 싶은 나만의 컵을 만들어보세요. 기초부터 천천히 알려드릴게요.',
    category: '공예·미술', price: 45000, capacity: 6, startsAt: afterDays(10), durationMinutes: 90,
    notes: '흙 · 도구 · 소성비 포함\n완성품 수령 시점은 수업 때 안내합니다.',
    createdAt: afterDays(-2),
  },
  {
    ...common, id: 'class-coffee', kind: 'oneday-class', storeId: 'store-005',
    title: '내 취향을 찾는 핸드드립 한 잔',
    description: '원두 향을 비교하고, 직접 커피를 내려보는 작은 클래스예요. 집에서도 맛있는 커피를 즐길 수 있는 팁을 나눕니다.',
    category: '커피·음료', price: 25000, capacity: 4, startsAt: afterDays(5), durationMinutes: 60,
    notes: '원두 · 드리퍼 · 시음 포함\n별도 준비물은 없어요.',
    createdAt: afterDays(-3),
  },
];
