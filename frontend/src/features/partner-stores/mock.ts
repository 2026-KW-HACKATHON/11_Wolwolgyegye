import type { College, PartnerBenefit, PartnerStoreMenuItem } from './types';

export const COLLEGES: College[] = [
  { key: 'eie', label: '전자정보', name: '전자정보공과대학' },
  { key: 'ai', label: 'AI융합', name: '인공지능융합대학' },
  { key: 'eng', label: '공과', name: '공과대학' },
  { key: 'sci', label: '자연과학', name: '자연과학대학' },
  { key: 'hss', label: '인문사회', name: '인문사회과학대학' },
  { key: 'law', label: '정책법학', name: '정책법학대학' },
  { key: 'biz', label: '경영', name: '경영대학' },
  { key: 'chambit', label: '참빛인재', name: '참빛인재대학' },
];

/**
 * UI 확인용 가상 제휴 정보. 실제 제휴 내용이 아니다.
 * 실제 데이터는 각 단과대 학생회 제휴 공지를 확인해 교체한다.
 * storeId 는 core/mock/stores.ts 의 가게 id 와 맞춰서 쓴다 (supports['partner-stores'] 가 켜진 가게).
 */
export const MOCK_PARTNER_BENEFITS: PartnerBenefit[] = [
  { storeId: 'store-001', condition: '학생증 제시 · 매장 식사 한정', benefits: { hss: '10% 할인', law: '에이드 1잔 무료', chambit: '10% 할인' } },
  { storeId: 'store-003', condition: '학생증 제시 · 시간권 구매 시', benefits: { eie: '4시간권 1시간 추가', ai: '4시간권 1시간 추가', chambit: '4시간권 1시간 추가' } },
  { storeId: 'store-005', condition: '학생증 제시', benefits: { ai: '음료 500원 할인', sci: '음료 500원 할인', hss: '사이즈 업 무료', chambit: '음료 500원 할인' } },
  { storeId: 'store-006', condition: '학생증 제시 · 5,000원 이상 구매 시', benefits: { biz: '10% 할인', law: '10% 할인' } },
  { storeId: 'store-010', condition: '학생증 제시 · 매장 식사 및 포장', benefits: { eng: '감자튀김 서비스', eie: '감자튀김 서비스', ai: '2,000원 할인' } },
  { storeId: 'store-013', condition: '학생증 제시', benefits: { biz: '1,000원 할인', chambit: '음료 1잔 무료', eie: '1,000원 할인' } },
  { storeId: 'store-016', condition: '학생증 제시 · 매장 식사 한정', benefits: { eng: '면 추가 무료', sci: '면 추가 무료', ai: '음료 1캔 무료' } },
  { storeId: 'store-019', condition: '학생증 제시 · 1만 원 이상 주문 시', benefits: { sci: '꿔바로우 소 2,000원 할인', eng: '음료 1캔 무료' } },
  { storeId: 'store-022', condition: '학생증 제시 · 세트 주문 시', benefits: { law: '15% 할인', biz: '15% 할인', hss: '음료 사이즈 업' } },
  { storeId: 'store-025', condition: '학생증 또는 모바일 학생증 제시', benefits: { eie: '전 메뉴 1,000원 할인', eng: '공깃밥 무료 추가' } },
  { storeId: 'store-028', condition: '학생증 제시', benefits: { sci: '토핑 1개 무료', biz: '10% 할인' } },
  { storeId: 'store-032', condition: '학생증 제시', benefits: { hss: '튀김 1인분 서비스', law: '튀김 1인분 서비스', chambit: '500원 할인' } },
];

/** 기존 예시 메뉴 데이터 (아직 화면에서 쓰지 않음) */
export const MOCK_PARTNER_STORE_MENU: PartnerStoreMenuItem[] = [
  { id: 'menu-001-1', storeId: 'store-001', name: '알리오올리오', price: 12000 },
  { id: 'menu-001-2', storeId: 'store-001', name: '리조또', price: 13000 },
  { id: 'menu-005-1', storeId: 'store-005', name: '아메리카노', price: 4500 },
  { id: 'menu-005-2', storeId: 'store-005', name: '카페라떼', price: 5000 },
];
