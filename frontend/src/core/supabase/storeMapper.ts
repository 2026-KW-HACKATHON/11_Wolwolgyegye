import type { CategorySupport, Store } from '../types/place';

const FEATURE_KEYS = [
  'space-rental', 'oneday-class', 'roulette', 'closing-sale', 'coupon', 'partner-stores',
] as const;

export interface PublicStoreRow {
  id: string;
  name: string;
  cuisine_type: string | null;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  business_hours: string;
  thumbnail_path: string | null;
  supported_features: string[];
}

export function toStore(row: PublicStoreRow): Store {
  const supports: CategorySupport = {};
  for (const feature of FEATURE_KEYS) {
    if (row.supported_features.includes(feature)) supports[feature] = true;
  }
  return {
    id: row.id,
    name: row.name,
    cuisineType: row.cuisine_type || undefined,
    address: row.address,
    location: { lat: row.lat, lng: row.lng },
    phone: row.phone,
    businessHours: row.business_hours,
    // 저장소 경로는 공개 URL이 아니다. 사진 화면을 연결할 때 URL 변환을 추가한다.
    thumbnailUrl: '',
    supports,
  };
}
