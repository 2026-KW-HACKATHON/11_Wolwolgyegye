import { COLLEGES } from './mock';
import type { CollegeKey, PartnerAudience, PartnerBenefitDetails, PartnerIndustry, PartnerStoreMenuItem, PartnerStoreView } from './types';

export const AUDIENCE_STORAGE_KEY = 'wolwol.partner.audience.v1';
export const STATUS_LABELS = { demo: '예시 혜택', verified: '출처 확인', 'needs-check': '확인 필요', ended: '기간 종료' };
export function isAudience(value: unknown): value is PartnerAudience {
  return value === 'all' || value === 'resident' || COLLEGES.some((c) => c.key === value);
}
export function collegeOf(value: PartnerAudience): CollegeKey | null {
  return value === 'all' || value === 'resident' ? null : value;
}
export function money(value: number) { return `${value.toLocaleString('ko-KR')}원`; }
export function safeSourceUrl(value?: string): string | null {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function validDate(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function benefitStatus(info?: PartnerBenefitDetails, now = Date.now()): keyof typeof STATUS_LABELS {
  if (info?.status === 'demo') return 'demo';
  const today = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  if (validDate(info?.validUntil) && info.validUntil < today) return 'ended';
  return info?.status === 'verified' && safeSourceUrl(info.sourceUrl) && validDate(info.verifiedAt)
    && info.verifiedAt <= today && validDate(info.validUntil) ? 'verified' : 'needs-check';
}
export function industryOf(view: PartnerStoreView): PartnerIndustry {
  const text = `${view.store.name} ${view.store.cuisineType ?? ''}`;
  if (/카페|커피|베이커리|빵|디저트/.test(text)) return '카페·베이커리';
  return view.store.cuisineType ? '음식점' : '생활·문화';
}
export function distanceLabel(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '거리 미등록';
  return meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(meters / 1000).toFixed(1)}km`;
}
export function estimatePrice(menu: PartnerStoreMenuItem, college: CollegeKey | null, info?: PartnerBenefitDetails): number | null {
  if (!college || !['demo', 'verified'].includes(benefitStatus(info)) || !Number.isSafeInteger(menu.price) || menu.price <= 0) return null;
  if (info?.minimumSpend !== undefined && (!Number.isFinite(info.minimumSpend) || info.minimumSpend < 0 || menu.price < info.minimumSpend)) return null;
  const discount = menu.discounts?.[college];
  if (!discount || !Number.isFinite(discount.value) || discount.value <= 0) return null;
  if (discount.type === 'percent' && discount.value <= 100) return menu.price - Math.floor(menu.price * discount.value / 100);
  if (discount.type === 'amount' && Number.isInteger(discount.value) && discount.value <= menu.price) return menu.price - discount.value;
  return null;
}
export function mapUrl(view: PartnerStoreView): string | null {
  const { lat, lng } = view.store.location;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return `https://map.kakao.com/link/${view.dataMode === 'demo' ? 'map' : 'to'}/${encodeURIComponent(view.store.name)},${lat},${lng}`;
}
export function phoneUrl(view: PartnerStoreView): string | null {
  if (view.dataMode === 'demo') return null;
  const phone = view.store.phone.replace(/[\s()-]/g, '');
  return /^\+?\d{7,15}$/.test(phone) ? `tel:${phone}` : null;
}
