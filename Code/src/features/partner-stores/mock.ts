import type { PartnerStoreInfo, PartnerStoreMenuItem } from './types';

/** storeId 는 core/mock/stores.ts 의 가게 id 와 맞춰서 쓴다 */
export const MOCK_PARTNER_STORE_INFOS: PartnerStoreInfo[] = [
  { storeId: 'store-001', partnerWith: ['이태원 와인바'] },
  { storeId: 'store-005', partnerWith: ['옆 골목 서점'] },
];

export const MOCK_PARTNER_STORE_MENU: PartnerStoreMenuItem[] = [
  { id: 'menu-001-1', storeId: 'store-001', name: '알리오올리오', price: 12000 },
  { id: 'menu-001-2', storeId: 'store-001', name: '리조또', price: 13000 },
  { id: 'menu-005-1', storeId: 'store-005', name: '아메리카노', price: 4500 },
  { id: 'menu-005-2', storeId: 'store-005', name: '카페라떼', price: 5000 },
];