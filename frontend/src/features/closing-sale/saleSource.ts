import { SALE_SEEDS, type ClosingSale } from './closingSaleData';

/**
 * 손님 화면에 보여줄 마감세일을 가져오는 지점.
 *
 * 지금은 예시 데이터를 "지금 기준 마감 시각"으로 바꿔서 돌려주지만,
 * 사장님 전용 페이지(/owner)에서 세일을 등록하고 백엔드가 준비되면
 * 이 함수 안만 아래처럼 바꾸면 화면 코드는 그대로 둬도 된다.
 *
 *   const res = await fetch('/api/closing-sales');
 *   return res.json();
 */
export async function fetchClosingSales(): Promise<ClosingSale[]> {
  const now = Date.now();
  return SALE_SEEDS.map(({ closesInMinutes, ...sale }) => ({
    ...sale,
    closeAt: new Date(now + closesInMinutes * 60_000).toISOString(),
  }));
}
