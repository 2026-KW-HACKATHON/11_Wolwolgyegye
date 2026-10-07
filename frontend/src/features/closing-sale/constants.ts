/** 화면 전용 상수. 데이터(DB)와 무관한 표시 규칙만 둔다 */

export type SaleSortKey = 'closing' | 'discount' | 'near';

interface SaleSort {
  key: SaleSortKey;
  label: string;
}

/** 목록 정렬 방식 */
export const SALE_SORTS: SaleSort[] = [
  { key: 'closing', label: '마감 임박순' },
  { key: 'discount', label: '할인율순' },
  { key: 'near', label: '가까운순' },
];

/** 카드 상단 그라데이션 색 (closing-sale.css 의 .cs-tone-*) */
const SALE_TONES = ['orange', 'blue', 'purple', 'green', 'pink'] as const;
type SaleTone = (typeof SALE_TONES)[number];

/** 같은 가게는 정렬이 바뀌어도 항상 같은 색이 나오도록 storeId 로 색을 고른다 */
export function toneForStore(storeId: string): SaleTone {
  let hash = 0;
  for (const ch of storeId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SALE_TONES[hash % SALE_TONES.length];
}
