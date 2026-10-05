import { COLLEGES } from './colleges';
import type { CollegeKey, PartnerAudience, PartnerIndustry, PartnerStoreMenuItem, PartnerStoreView } from './types';

export const AUDIENCE_STORAGE_KEY = 'wolwol.partner.audience.v1';
export function isAudience(value: unknown): value is PartnerAudience {
  return value === 'all' || COLLEGES.some((c) => c.key === value);
}
export function collegeOf(value: PartnerAudience): CollegeKey | null {
  return value === 'all' ? null : value;
}
export function money(value: number) { return `${value.toLocaleString('ko-KR')}원`; }
export function industryOf(view: PartnerStoreView): PartnerIndustry {
  const text = `${view.store.name} ${view.store.cuisineType ?? ''}`;
  if (/카페|커피|베이커리|빵|디저트/.test(text)) return '카페·베이커리';
  return view.store.cuisineType ? '음식점' : '생활·문화';
}
export function distanceLabel(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '거리 미등록';
  return meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(meters / 1000).toFixed(1)}km`;
}
export function estimatePrice(menu: PartnerStoreMenuItem, college: CollegeKey | null): number | null {
  if (!college || !Number.isSafeInteger(menu.price) || menu.price <= 0) return null;
  const discount = menu.discounts?.[college];
  if (!discount || !Number.isFinite(discount.value) || discount.value <= 0) return null;
  if (discount.type === 'percent' && discount.value <= 100) return menu.price - Math.floor(menu.price * discount.value / 100);
  if (discount.type === 'amount' && Number.isInteger(discount.value) && discount.value <= menu.price) return menu.price - discount.value;
  return null;
}
