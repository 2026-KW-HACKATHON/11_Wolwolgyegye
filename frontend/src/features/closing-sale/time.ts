import type { ClosingSaleView } from './types';

/** 이 시간보다 적게 남으면 "곧 마감" 으로 강조한다 */
export const URGENT_MINUTES = 60;
/** 남은 시간 표시를 30초마다 새로 계산한다 */
export const TICK_MS = 30_000;

export function minutesLeft(sale: ClosingSaleView, now: number) {
  return Math.floor((new Date(sale.closeAt).getTime() - now) / 60_000);
}

/** 42 -> "42분", 78 -> "1시간 18분" */
export function formatLeft(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${String(m).padStart(2, '0')}분`;
}

/** ISO 시각을 "18:30" 으로 */
export function hhmm(iso: string) {
  const at = new Date(iso);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}
