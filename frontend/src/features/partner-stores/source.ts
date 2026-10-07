import type { MenuKind } from '../../core/source/storeDetail';
import { fetchStoresByIds, getUserLocation } from '../../core/source/storeSource';
import { getSupabaseClient } from '../../core/supabase/client';
import { distanceMeters } from '../../core/utils/geo';
import { COLLEGES } from './colleges';
import type { CollegeKey, PartnerStoreMenuItem, PartnerStoreView } from './types';

interface PartnershipRow {
  store_id: string;
  partners: { name: string } | { name: string }[] | null;
}

const collegeByName = new Map(COLLEGES.map((college) => [college.name, college.key]));

function partnerName(value: PartnershipRow['partners']): string {
  if (Array.isArray(value)) return value[0]?.name ?? '';
  return value?.name ?? '';
}

async function fetchPartnerships(): Promise<Map<string, CollegeKey[]>> {
  const { data, error } = await getSupabaseClient()
    .from('store_partners')
    .select('store_id, partners(name)');
  if (error) throw error;
  const result = new Map<string, CollegeKey[]>();
  for (const row of (data ?? []) as unknown as PartnershipRow[]) {
    const college = collegeByName.get(partnerName(row.partners));
    if (!college) continue;
    const colleges = result.get(row.store_id) ?? [];
    if (!colleges.includes(college)) colleges.push(college);
    result.set(row.store_id, colleges);
  }
  return result;
}

async function fetchMenuRows(storeIds: string[]): Promise<PartnerStoreMenuItem[]> {
  if (!storeIds.length) return [];
  const rows: PartnerStoreMenuItem[] = [];
  for (let index = 0; index < storeIds.length; index += 100) {
    const { data, error } = await getSupabaseClient()
      .from('store_menus')
      .select('id, store_id, name, price, section, kind, description, sort_order')
      .in('store_id', storeIds.slice(index, index + 100))
      .order('sort_order');
    if (error) throw error;
    rows.push(...((data ?? []) as {
      id: string; store_id: string; name: string; price: number; section: string | null;
      kind: MenuKind | null; description: string | null;
    }[]).map((menu) => ({
      id: menu.id,
      storeId: menu.store_id,
      name: menu.name,
      price: menu.price,
      section: menu.section || null,
      kind: menu.kind,
      description: menu.description || null,
    })));
  }
  return rows;
}

export async function fetchPartnerStores(): Promise<PartnerStoreView[]> {
  const partnerships = await fetchPartnerships();
  const ids = [...partnerships.keys()];
  const [menus, stores, here] = await Promise.all([
    fetchMenuRows(ids),
    fetchStoresByIds(ids),
    getUserLocation(),
  ]);
  const menusByStore = new Map<string, PartnerStoreMenuItem[]>();
  for (const menu of menus) menusByStore.set(menu.storeId, [...(menusByStore.get(menu.storeId) ?? []), menu]);

  return ids.flatMap((storeId) => {
    const store = stores.get(storeId);
    if (!store) return [];
    return [{
      storeId,
      colleges: partnerships.get(storeId) ?? [],
      store,
      referenceDistanceMeters: distanceMeters(here, store.location),
      menus: menusByStore.get(storeId) ?? [],
    }];
  });
}
