import { getSupabaseClient } from '../supabase/client';
import type { HoursRow } from '../utils/hours';
import { resolveStoreMediaUrl } from './mediaUrl';

/**
 * 2차 탭(가게 화면)에 보여줄 가게 한 곳의 모든 정보.
 * stores 한 행과 거기 딸린 표(메뉴·영업시간·마감세일·제휴·공간대여·원데이클래스·스탬프)를 한 번에 읽는다.
 * 공개 가게만 읽힌다 (RLS). 없거나 연결에 실패하면 null.
 */
/** 메뉴 종류 (store_menus.kind) */
export type MenuKind = 'main' | 'set' | 'side' | 'extra' | 'drink' | 'alcohol' | 'dessert';
export const MENU_KIND_LABELS: Record<MenuKind, string> = {
  main: '메인', set: '세트', side: '사이드', extra: '추가', drink: '음료', alcohol: '주류', dessert: '디저트',
};

export interface StoreMenu {
  id: string;
  name: string;
  price: number;
  typeId: string | null;
  /** 메뉴판의 묶음 이름 (예: 식사류). 없으면 kind 로 묶는다 */
  section: string | null;
  kind: MenuKind | null;
  description: string | null;
}

export interface StoreDetail {
  id: string;
  name: string;
  address: string;
  isMock: boolean;
  /** 좌표 (카카오 장소 검색에서 같은 가게를 찾을 때 쓴다) */
  lat: number | null;
  lng: number | null;
  /** 사진 탭: 가게 사진 + 공개 중인 공간대여·원데이클래스 글 사진 (가게 사진이 앞) */
  photos: { url: string; caption: string }[];
  hours: HoursRow[];
  menus: StoreMenu[];
  /** 진행 중인 마감세일 수 */
  saleCount: number;
  /** 이 가게와 직접 연결된 제휴 단과대학 이름 */
  partnerColleges: string[];
  /** 공개 중인 공간대여 · 원데이클래스 글 수 */
  spaceRentalCount: number;
  classCount: number;
  stamp: { requiredStamps: number; reward: string } | null;
}

const COLUMNS = [
  'id, name, address, is_mock, lat, lng',
  'store_hours(weekday, opens_at, closes_at, is_closed)',
  'store_images(image_path, sort_order)',
  'store_menus(id, name, price, type_id, sort_order, section, kind, description)',
  'closing_sales(ends_at)',
  'store_partners(partners(name))',
  'space_rentals(title, is_published, space_rental_images(image_path, sort_order))',
  'one_day_classes(title, is_published, one_day_class_images(image_path, sort_order))',
  'stamp_policies(required_stamps, reward)',
].join(', ');

/** DB 응답 한 행. 모양은 아래 fetchStoreDetail 에서 바로 바꾼다 */
type Row = Record<string, any>;
const list = (v: unknown): Row[] => (Array.isArray(v) ? v : v ? [v as Row] : []);
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const sorted = (images: Row[]) => [...images].sort((a, b) => a.sort_order - b.sort_order);

/** 사진 탭에 넣을 사진: 가게 사진 → 공간대여 글 사진 → 원데이클래스 글 사진 (공개 글만) */
function photosOf(row: Row): { url: string; caption: string }[] {
  const posts = (rows: Row[], images: string) => rows.filter((p) => p.is_published)
    .flatMap((p) => sorted(list(p[images])).map((img) => ({ url: resolveStoreMediaUrl(img.image_path), caption: p.title as string })));
  return [
    ...sorted(list(row.store_images)).map((img) => ({ url: resolveStoreMediaUrl(img.image_path), caption: '' })),
    ...posts(list(row.space_rentals), 'space_rental_images'),
    ...posts(list(row.one_day_classes), 'one_day_class_images'),
  ];
}

/** 메뉴를 메뉴판 묶음(section, 없으면 kind) 순서대로 나눈다. 묶음 정보가 하나도 없으면 이름 없는 한 묶음 */
export function groupMenus(menus: StoreMenu[]): { label: string; items: StoreMenu[] }[] {
  const groups = new Map<string, StoreMenu[]>();
  for (const menu of menus) {
    const label = menu.section ?? (menu.kind ? MENU_KIND_LABELS[menu.kind] : '');
    groups.set(label, [...(groups.get(label) ?? []), menu]);
  }
  return [...groups].map(([label, items]) => ({ label, items }));
}

export async function fetchStoreDetail(id: string): Promise<StoreDetail | null> {
  try {
    const { data, error } = await getSupabaseClient().from('stores').select(COLUMNS).eq('id', id).maybeSingle();
    if (error || !data) return null;
    const row = data as Row;
    const now = Date.now();
    const stamp = list(row.stamp_policies)[0];
    return {
      id: row.id,
      name: row.name ?? '',
      address: row.address ?? '',
      isMock: Boolean(row.is_mock),
      lat: num(row.lat),
      lng: num(row.lng),
      photos: photosOf(row),
      hours: list(row.store_hours) as HoursRow[],
      menus: list(row.store_menus)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => ({
          id: m.id, name: m.name, price: m.price, typeId: m.type_id,
          section: m.section || null, kind: m.kind ?? null, description: m.description || null,
        })),
      saleCount: list(row.closing_sales).filter((s) => Date.parse(s.ends_at) > now).length,
      partnerColleges: list(row.store_partners).map((link) => link.partners?.name).filter(Boolean),
      // 사장님은 RLS 로 자기 가게의 비공개(등록 취소한) 글도 읽으므로, 손님 화면에는 공개 글만 센다
      spaceRentalCount: list(row.space_rentals).filter((r) => r.is_published).length,
      classCount: list(row.one_day_classes).filter((c) => c.is_published).length,
      stamp: stamp ? { requiredStamps: stamp.required_stamps, reward: stamp.reward } : null,
    };
  } catch {
    return null;
  }
}
