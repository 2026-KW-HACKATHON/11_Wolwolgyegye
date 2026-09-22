import type { Store } from '../types/place';

/**
 * 개발용 임시 가게 데이터 (5개, 공통 필드만).
 * 카테고리별 상세 데이터는 각 features/<카테고리>/mock.ts 에 따로 있고, storeId 로 여기 있는
 * 가게와 연결된다. (id 값은 아래 카테고리 mock 파일들과 반드시 맞춰서 써야 한다)
 */
export const MOCK_STORES: Store[] = [
  {
    id: 'store-001',
    name: '동네 파스타',
    cuisineType: '양식',
    location: { lat: 37.5665, lng: 126.978 },
    address: '서울시 마포구 ○○로 12',
    thumbnailUrl: 'https://picsum.photos/seed/store-001/400/300',
    businessHours: '매일 11:00 - 21:00',
    phone: '02-1234-5678',
    supports: { 'partner-stores': true, 'oneday-class': true },
  },
  {
    id: 'store-002',
    name: '이모네 반찬가게',
    cuisineType: '한식',
    location: { lat: 37.5651, lng: 126.9895 },
    address: '서울시 마포구 ○○길 3',
    thumbnailUrl: 'https://picsum.photos/seed/store-002/400/300',
    businessHours: '매일 09:00 - 20:00',
    phone: '02-2222-3333',
    supports: { 'closing-sale': true },
  },
  {
    id: 'store-003',
    name: '스터디 라운지',
    location: { lat: 37.5601, lng: 126.9822 },
    address: '서울시 마포구 ○○대로 45 3층',
    thumbnailUrl: 'https://picsum.photos/seed/store-003/400/300',
    businessHours: '매일 09:00 - 23:00',
    phone: '02-4444-5555',
    supports: { 'space-rental': true },
  },
  {
    id: 'store-004',
    name: '클레이 공방',
    location: { lat: 37.5586, lng: 126.9754 },
    address: '서울시 용산구 ○○길 9',
    thumbnailUrl: 'https://picsum.photos/seed/store-004/400/300',
    businessHours: '화-일 10:00 - 19:00 (월요일 휴무)',
    phone: '02-6666-7777',
    supports: { 'oneday-class': true },
  },
  {
    id: 'store-005',
    name: '골목 카페',
    cuisineType: '카페 · 디저트',
    location: { lat: 37.5633, lng: 126.9819 },
    address: '서울시 마포구 ○○로 21',
    thumbnailUrl: 'https://picsum.photos/seed/store-005/400/300',
    businessHours: '매일 08:00 - 22:00',
    phone: '02-8888-9999',
    supports: { 'partner-stores': true, coupon: true },
  },
];