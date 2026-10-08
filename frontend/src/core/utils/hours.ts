/**
 * DB store_hours 한 줄 (weekday 0=일 … 6=토).
 * 시각은 DB 에서는 time 형식이고, 받아 오면 "10:00:00" 같은 문자열이다. 화면에는 앞 5글자(10:00)만 쓴다.
 */
export interface HoursRow {
  weekday: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
}

/** 영업시간 한 줄: label = "매일" / "월~금" / "토~일" / "수", text = "10:00~21:00" 또는 "휴무" */
export interface HoursLine {
  label: string;
  text: string;
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
/** 월요일부터 보여준다 */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const hhmm = (t: string | null) => (t ?? '').slice(0, 5);
const textOf = (row: HoursRow) => (row.is_closed ? '휴무' : `${hhmm(row.opens_at)}~${hhmm(row.closes_at)}`);

/**
 * 요일별 영업시간 → 보여줄 줄들. (월요일부터)
 * 1. 7일이 모두 같으면 한 줄: "매일 10:00~21:00"
 * 2. 같은 시간인 요일들이 각각 이어진 구간이면 구간마다 한 줄: "월~금 10:00~21:00" / "토~일 11:00~20:00",
 *    "월~토 10:00~21:00" / "일 휴무"
 * 3. 같은 시간인 요일이 떨어져 있으면(예: 수요일만 휴무라 월~화·목~일이 같음) 묶지 않고 7일을 하루씩 보여준다.
 * 7일 중 빠진 요일이 있어도 하루씩 보여준다. 정보가 없으면 빈 배열.
 */
export function groupBusinessHours(rows: HoursRow[]): HoursLine[] {
  const days = WEEK_ORDER.flatMap((day) => {
    const row = rows.find((r) => r.weekday === day);
    return row ? [{ day, text: textOf(row) }] : [];
  });
  if (!days.length) return [];
  const daily = days.map((d) => ({ label: DAY_LABELS[d.day], text: d.text }));
  if (days.length < 7) return daily;
  if (days.every((d) => d.text === days[0].text)) return [{ label: '매일', text: days[0].text }];

  // 월요일부터 같은 시간끼리 이어진 구간으로 자른다
  const runs: { from: number; to: number; text: string }[] = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && last.text === d.text) last.to = d.day;
    else runs.push({ from: d.day, to: d.day, text: d.text });
  }
  // 같은 시간이 두 구간 이상으로 떨어져 있으면 묶지 않는다
  const texts = runs.map((r) => r.text);
  if (new Set(texts).size !== texts.length) return daily;
  return runs.map((r) => ({ label: r.from === r.to ? DAY_LABELS[r.from] : `${DAY_LABELS[r.from]}~${DAY_LABELS[r.to]}`, text: r.text }));
}
