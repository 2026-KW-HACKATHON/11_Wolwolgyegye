import { useEffect, useState } from 'react';
import { useAuth } from '../../core/auth/AuthContext';
import { getSupabaseClient } from '../../core/supabase/client';
import { toneForStore } from './constants';
import { formatSaleDiscount } from './discount';
import { fetchClosingSales } from './source';
import type { ClosingSaleView } from './types';
import './closing-sale.css';

/** 이 시간보다 적게 남으면 "곧 마감" 으로 강조한다 */
const URGENT_MINUTES = 60;
const TICK_MS = 30_000;

const minutesLeft = (sale: ClosingSaleView, now: number) => Math.floor((new Date(sale.closeAt).getTime() - now) / 60_000);
/** 42 -> "42분", 78 -> "1시간 18분" */
function formatLeft(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${String(m).padStart(2, '0')}분`;
}
const hhmm = (iso: string) => { const at = new Date(iso); return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`; };

/**
 * 2차 탭 안의 "마감세일" 묶음: 그 가게의 진행 중인 세일을 전부 상세로 이어서 보여준다.
 * 세일이 없으면 아무것도 그리지 않는다. 세일마다 data-sd-target="sale-<id>" 를 달아 1차 탭에서 고른 세일로 스크롤할 수 있다.
 */
export default function ClosingSaleSection({ storeId }: { storeId: string }) {
  const { userId } = useAuth();
  const [sales, setSales] = useState<ClosingSaleView[] | null>(null);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchClosingSales(),
      userId ? getSupabaseClient().from('sale_likes').select('sale_id').eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
    ]).then(([list, likes]) => {
      if (cancelled) return;
      setSales(list.filter((sale) => sale.storeId === storeId));
      if (!likes.error) setLikedIds((likes.data ?? []).map((row) => row.sale_id));
    }).catch(() => { if (!cancelled) setSales([]); });
    return () => { cancelled = true; };
  }, [storeId, userId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  async function toggleLike(id: string) {
    if (!userId) return;
    const exists = likedIds.includes(id);
    setLikedIds((current) => (exists ? current.filter((value) => value !== id) : [...current, id]));
    const client = getSupabaseClient();
    const result = exists
      ? await client.from('sale_likes').delete().eq('user_id', userId).eq('sale_id', id)
      : await client.from('sale_likes').insert({ user_id: userId, sale_id: id });
    if (result.error) setLikedIds((current) => (exists ? [...current, id] : current.filter((value) => value !== id)));
  }

  const open = (sales ?? []).filter((sale) => minutesLeft(sale, now) > 0);
  if (!open.length) return null;
  return (
    <div className="cs-page cs-page--detail">
      {open.map((sale) => {
        const left = minutesLeft(sale, now);
        const liked = likedIds.includes(sale.id);
        return (
          <article key={sale.id} className={`cs-section-sale cs-tone-${toneForStore(sale.storeId)}`} data-sd-target={`sale-${sale.id}`}>
            <div className="cs-card-top">
              <span className={`cs-countdown${left <= URGENT_MINUTES ? ' is-urgent' : ''}`}>
                <span className="cs-countdown-label">마감까지 </span>
                {formatLeft(left)}
              </span>
              <strong className="cs-discount">
                {formatSaleDiscount(sale)}
                <span className="cs-discount-off">{sale.discountType === 'free' ? ' 제공' : ' OFF'}</span>
              </strong>
            </div>
            <div className="cs-detail-body">
              <dl className="cs-detail-facts">
                <div><dt>할인</dt><dd>{sale.discountType === 'free' ? '무료 제공' : `${formatSaleDiscount(sale)} 할인`}</dd></div>
                {sale.offer && <div><dt>제공</dt><dd>{sale.offer}</dd></div>}
                {sale.condition && <div><dt>조건</dt><dd>{sale.condition}</dd></div>}
                <div><dt>세일 시간</dt><dd>{hhmm(sale.startsAt)} ~ {hhmm(sale.closeAt)}</dd></div>
              </dl>
              {userId && (
                <button type="button" className={`cs-like${liked ? ' is-on' : ''}`} aria-pressed={liked} onClick={() => void toggleLike(sale.id)}>
                  {liked ? '♥ 관심 등록됨' : '♡ 관심 등록'}
                </button>
              )}
            </div>
          </article>
        );
      })}
      <p className="cs-detail-tip">마감 시간이 가까우면 재고가 빨리 떨어질 수 있어요. 출발 전에 가게에 확인해 보세요.</p>
    </div>
  );
}
