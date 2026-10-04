import { subCategoryById } from '../categories/subCategories';
import { getSupabaseClient } from '../supabase/client';
import { MAP_CENTER } from '../../shared/map/vworld/mapExtent';
import type { CategorySupport, GeoPoint, Store } from '../types/place';
import { formatBusinessHours, type HoursRow } from '../utils/hours';

/**
 * 가게 공통 정보를 가져오는 지점. 모든 카테고리의 source.ts 가 이 함수로 storeId 를 가게로 바꾼다.
 * DB stores 표(공개 가게만, RLS)에서 읽고, 한 번 읽은 가게는 앱이 켜져 있는 동안 기억한다.
 * DB 설정이 없거나 연결에 실패하면 가게가 없는 것으로 본다 (화면은 빈 목록을 보여준다).
 */
interface StoreRow {
  id: string;
  name: string;
  type_id: string | null;
  industry: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  is_mock: boolean;
  store_hours: HoursRow[];
}

const STORE_COLUMNS = 'id, name, type_id, industry, address, lat, lng, phone, is_mock, store_hours(weekday, opens_at, closes_at, is_closed)';
/** 한 번에 묻는 id 수 (주소 길이 제한) */
const ID_CHUNK = 150;
const cache = new Map<string, Store>();

function toStore(row: StoreRow): Store {
  return {
    id: row.id,
    name: row.name,
    cuisineType: subCategoryById(row.type_id)?.label ?? (row.industry || undefined),
    location: { lat: row.lat, lng: row.lng },
    address: row.address,
    thumbnailUrl: '',
    businessHours: formatBusinessHours(row.store_hours ?? []),
    phone: row.phone,
    supports: {},
    isMock: row.is_mock,
  };
}

export async function fetchStoresByIds(ids: string[]): Promise<Map<string, Store>> {
  const missing = [...new Set(ids)].filter((id) => !cache.has(id));
  try {
    for (let i = 0; i < missing.length; i += ID_CHUNK) {
      const { data, error } = await getSupabaseClient().from('stores').select(STORE_COLUMNS).in('id', missing.slice(i, i + ID_CHUNK));
      if (error) throw error;
      for (const row of (data ?? []) as StoreRow[]) cache.set(row.id, toStore(row));
    }
  } catch {
    // 연결 실패: 이미 기억한 가게만 돌려준다
  }
  return new Map(ids.flatMap((id) => (cache.has(id) ? [[id, cache.get(id)!] as const] : [])));
}

/** 카테고리별로 "이 가게가 그 카테고리에 글이 있는지" 를 보는 표 */
const SUPPORT_TABLES: [keyof CategorySupport, string][] = [
  ['closing-sale', 'closing_sales'],
  ['space-rental', 'space_rentals'],
  ['oneday-class', 'one_day_classes'],
  ['partner-stores', 'partner_benefits'],
  ['coupon', 'stamp_policies'],
  ['roulette', 'store_menus'],
];

/**
 * 지도에 카테고리 가게 핀으로 표시할 가게 목록: 마감세일·공간대여·클래스·제휴·스탬프·메뉴 중
 * 하나라도 있는 공개 가게. supports 에 어느 카테고리에 있는지 표시한다.
 */
export async function fetchStores(): Promise<Store[]> {
  const supports = new Map<string, CategorySupport>();
  try {
    const client = getSupabaseClient();
    const results = await Promise.all(SUPPORT_TABLES.map(([, table]) => client.from(table).select('store_id')));
    results.forEach(({ data }, i) => {
      const key = SUPPORT_TABLES[i][0];
      for (const { store_id } of (data ?? []) as { store_id: string }[]) {
        supports.set(store_id, { ...supports.get(store_id), [key]: true });
      }
    });
  } catch {
    return [];
  }
  const stores = await fetchStoresByIds([...supports.keys()]);
  return [...stores.values()].map((store) => ({ ...store, supports: supports.get(store.id) ?? {} }));
}

/** 거리 계산 기준점. 위치 권한 연동 전까지는 월계1동 직사각형 가운데를 쓴다 */
export async function getUserLocation(): Promise<GeoPoint> {
  return MAP_CENTER;
}
