import type { StampFilter, StampSort, StampTransaction, StampView } from './types';
import { isStampPolicy, validBalance } from './policy';

/** 화면 전용 상수·표시 규칙 (DB 와 무관) */

export const STAMP_FILTERS: { key: StampFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'ready', label: '선물 받기' },
  { key: 'collecting', label: '모으는 중' },
  { key: 'saved', label: '찜한 가게' },
];

export const STAMP_SORTS: { key: StampSort; label: string }[] = [
  { key: 'closest-reward', label: '선물 가까운순' },
  { key: 'near', label: '가까운 가게순' },
  { key: 'recent', label: '최근 적립순' },
  { key: 'name', label: '이름순' },
];

/** 이력 목록에서 처음 보여줄 개수 */
export const HISTORY_PREVIEW = 5;

/** 도장마다 살짝 다른 기울기 (같은 칸은 항상 같은 각도) */
const TILTS = [-9, 6, -4, 11, -13, 3, -7, 9, -2, 7];
export function tiltOf(storeId: string, index: number): number {
  let hash = 0;
  for (const ch of storeId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TILTS[(hash + index * 3) % TILTS.length];
}

/** 도장 가운데 들어갈 글자: 가게 이름 첫 글자 */
export function initialOf(name: string): string {
  return Array.from(name.trim())[0] ?? '◈';
}

/** 받침 있으면 '으로', 없거나 ㄹ 받침이면 '로' (예: 1잔으로, 1개로) */
export function withRo(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}(으)로`;
  const jong = code % 28;
  return `${word}${jong === 0 || jong === 8 ? '로' : '으로'}`;
}

/** 큰 목표도 수백 개의 SVG를 만들지 않고 진행 막대로 표시한다. */
export const MAX_STAMP_SLOTS = 30;
export const rewardsOf = (v: StampView) => isStampPolicy(v) ? Math.floor(validBalance(v.count) / v.requiredStamps) : 0;
export const isReady = (v: StampView) => rewardsOf(v) > 0;
export const remainingOf = (v: StampView) => isStampPolicy(v) ? Math.max(0, v.requiredStamps - validBalance(v.count)) : 0;
export const progressOf = (v: StampView) => isStampPolicy(v) ? Math.min(100, (validBalance(v.count) / v.requiredStamps) * 100) : 0;

export function statusText(v: StampView): string {
  if (isReady(v)) return `선물 ${rewardsOf(v)}개 받을 수 있어요`;
  if (v.count === 0) return '첫 스탬프를 모아보세요';
  return `선물까지 ${remainingOf(v)}개`;
}

/** 이번 적립판(마지막 교환 이후)에 찍힌 도장들의 날짜. 오래된 순, 최대 count 개 */
export function currentCycleDates(v: StampView): string[] {
  const dates: string[] = [];
  if (v.count <= 0) return dates;
  for (const t of v.history) { // 최신순
    if (t.delta < 0) break;
    dates.push(t.createdAt);
    if (dates.length >= v.count) break;
  }
  return dates.reverse();
}

const KST = 'Asia/Seoul';
function parts(iso: string, opts: Intl.DateTimeFormatOptions) {
  const map: Record<string, string> = {};
  new Intl.DateTimeFormat('ko-KR', { timeZone: KST, ...opts }).formatToParts(new Date(iso)).forEach((p) => { map[p.type] = p.value; });
  return map;
}

/** 9.29 */
export function shortDate(iso: string): string {
  const p = parts(iso, { month: 'numeric', day: 'numeric' });
  return `${p.month}.${p.day}`;
}

/** 9월 29일 (화) 08:44 */
export function longDate(iso: string): string {
  const p = parts(iso, { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${p.month}월 ${p.day}일 (${p.weekday}) ${p.hour}:${p.minute}`;
}

/** 오늘 / 어제 / 3일 전 / 9월 2일 */
export function relativeDay(iso: string, now = Date.now()): string {
  const day = (t: number) => Math.floor((t + 9 * 3600_000) / 86_400_000);
  const diff = day(now) - day(Date.parse(iso));
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 7) return `${diff}일 전`;
  const p = parts(iso, { month: 'numeric', day: 'numeric' });
  return `${p.month}월 ${p.day}일`;
}

export function kindOf(t: StampTransaction): 'earn' | 'redeem' {
  return t.delta < 0 ? 'redeem' : 'earn';
}
