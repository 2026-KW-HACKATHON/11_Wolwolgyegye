import { getSupabaseClient } from './client';

/** 지도·2차 탭에 쓰는 가게 한 곳 (DB stores 표의 공개 가게) */
export interface MapStore {
  id: string;
  name: string;
  /** 대표 유형 = 그 외 카테고리 id (store_types.id). 모르면 null */
  typeId: string | null;
  /** 원본 업종명 (예: 백반/한정식) */
  industry: string;
  address: string;
  /** 층 (지하는 음수, 모르면 null) */
  floor: number | null;
  /** 건물관리번호 (같은 건물 가게 묶기에 쓴다). 없으면 '' */
  buildingId: string;
  buildingName: string;
  phone: string;
  lat: number;
  lng: number;
}

export interface MapStoreData {
  stores: MapStore[];
  /** 상가정보 기준월 (예: 202606). 상가정보 가게가 없으면 '' */
  sbizMonth: string;
}

interface StoreRow {
  id: string;
  name: string;
  type_id: string | null;
  industry: string;
  address: string;
  floor: number | null;
  building_id: string;
  building_name: string;
  phone: string;
  lat: number;
  lng: number;
  sbiz_month: string | null;
}

const PAGE_SIZE = 1000;
const COLUMNS = 'id, name, type_id, industry, address, floor, building_id, building_name, phone, lat, lng, sbiz_month';

/** 층 표시 (예: 1층, 지하 1층). 모르면 '' */
export const floorLabel = (floor: number | null): string =>
  floor === null ? '' : floor < 0 ? `지하 ${-floor}층` : `${floor}층`;

/**
 * 공개 가게 전부 (비공개 가게는 RLS 가 빼고 준다). 한 번에 PAGE_SIZE 개씩 나눠 받는다.
 * DB 설정이 없거나 연결에 실패하면 null — 지도는 가게 없이 그대로 보인다.
 */
export async function fetchMapStores(): Promise<MapStoreData | null> {
  try {
    const client = getSupabaseClient();
    const stores: MapStore[] = [];
    let sbizMonth = '';
    for (let start = 0; ; start += PAGE_SIZE) {
      const { data, error } = await client.from('stores').select(COLUMNS)
        .order('id').range(start, start + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = (data ?? []) as StoreRow[];
      for (const row of rows) {
        if (row.sbiz_month && row.sbiz_month > sbizMonth) sbizMonth = row.sbiz_month;
        stores.push({
          id: row.id,
          name: row.name,
          typeId: row.type_id,
          industry: row.industry,
          address: row.address,
          floor: row.floor,
          buildingId: row.building_id,
          buildingName: row.building_name,
          phone: row.phone,
          lat: row.lat,
          lng: row.lng,
        });
      }
      if (rows.length < PAGE_SIZE) return { stores, sbizMonth };
    }
  } catch {
    return null;
  }
}
