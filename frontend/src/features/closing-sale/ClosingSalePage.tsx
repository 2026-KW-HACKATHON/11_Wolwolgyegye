import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { getSupabaseClient } from '../../core/supabase/client';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import { useShell } from '../../layout/AppShell/ShellContext';
import { SALE_SORTS, toneForStore, type SaleSortKey } from './constants';
import { discountSortValue, formatSaleDiscount } from './discount';
import { fetchClosingSales } from './source';
import { TICK_MS, URGENT_MINUTES, formatLeft, hhmm, minutesLeft } from './time';
import type { ClosingSaleView } from './types';
import './closing-sale.css';

function sortSales(sales: ClosingSaleView[], key: SaleSortKey) {
  const sorted = [...sales];
  if (key === 'discount') return sorted.sort((a, b) => discountSortValue(b) - discountSortValue(a));
  if (key === 'near') return sorted.sort((a, b) => a.walkMinutes - b.walkMinutes);
  return sorted.sort((a, b) => a.closeAt.localeCompare(b.closeAt));
}

/**
 * 마감세일 화면 (/closing-sale). 세일 카드를 누르면 그 가게의 2차 탭이 열리고, 2차 탭의 마감세일(누른 세일)이 맨 위에 오도록 스크롤된다.
 * /closing-sale?sale=ID 로 들어오면 그 세일을 바로 연다. (홈 화면의 세일 카드에서 연결)
 */
export default function ClosingSalePage() {
  const active = usePageActive();
  const [params, setParams] = useSearchParams();
  const { userId } = useAuth();
  const { openStore } = useShell();
  const openSale = useCallback((sale: ClosingSaleView) => openStore(sale.storeId, { category: 'closing-sale', target: `sale-${sale.id}` }), [openStore]);
  const [sales, setSales] = useState<ClosingSaleView[] | null>(null);
  /** 세일을 못 읽었으면 true ("세일 없음" 과 구분해서 다시 시도를 보여준다) */
  const [loadFailed, setLoadFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [sort, setSort] = useState<SaleSortKey>('closing');
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    Promise.all([
      fetchClosingSales(),
      userId ? getSupabaseClient().from('sale_likes').select('sale_id').eq('user_id', userId) : Promise.resolve({ data: [], error: null }),
    ]).then(([list, likes]) => {
      if (!cancelled) {
        setSales(list);
        if (!likes.error) setLikedIds((likes.data ?? []).map((row) => row.sale_id));
      }
    }).catch(() => {
      if (!cancelled) setLoadFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  // 남은 시간이 멈춰 보이지 않도록 주기적으로 현재 시각을 새로 읽는다
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  /** 아직 마감되지 않은 세일만, 고른 기준으로 정렬해서 보여준다 */
  const visible = useMemo(() => {
    if (!sales) return [];
    return sortSales(
      sales.filter((sale) => minutesLeft(sale, now) > 0),
      sort,
    );
  }, [sales, sort, now]);

  // ?sale=ID 로 들어오면 그 세일을 연다
  useEffect(() => {
    const saleId = params.get('sale');
    if (!active || !saleId || sales === null) return;
    const sale = sales.find((item) => item.id === saleId);
    if (sale) openSale(sale);
    const next = new URLSearchParams(params); next.delete('sale'); setParams(next, { replace: true });
  }, [active, params, sales, setParams, openSale]);

  async function toggleLike(id: string) {
    if (!userId) return;
    const exists = likedIds.includes(id);
    setLikedIds((current) => exists ? current.filter((value) => value !== id) : [...current, id]);
    const client = getSupabaseClient();
    const result = exists
      ? await client.from('sale_likes').delete().eq('user_id', userId).eq('sale_id', id)
      : await client.from('sale_likes').insert({ user_id: userId, sale_id: id });
    if (result.error) setLikedIds((current) => exists ? [...current, id] : current.filter((value) => value !== id));
    else setSales(await fetchClosingSales().catch(() => sales)); // 관심 수만 새로 읽는 것이라, 못 읽으면 보던 목록을 둔다
  }

  return (
    <div className="cs-page">
      <section className="cs-hero">
        <span className="cs-hero-badge">⚡ 오늘의 알뜰한 선택</span>
        <h1 className="cs-hero-heading">
          지금, 동네 가게의 <em>마감세일</em>을 만나보세요
        </h1>
        <p className="cs-hero-sub">남은 시간 안에만 받을 수 있는 신선한 할인 혜택이에요.</p>
        <span className="cs-hero-mark" aria-hidden="true">
          %
        </span>
      </section>

      <section className="cs-list">
        <div className="cs-list-head">
          <div>
            <h2 className="cs-list-title">오늘 마감 임박 매장</h2>
            <p className="cs-list-sub">
              {loadFailed ? (
                '세일 정보를 확인하지 못했어요'
              ) : sales === null ? (
                '세일을 불러오는 중이에요…'
              ) : (
                <>
                  내 주변에서 <b>{visible.length}</b>개의 세일이 진행 중이에요
                </>
              )}
            </p>
          </div>
          <label className="cs-sort">
            <span className="cs-sort-label">정렬</span>
            <select
              className="cs-sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SaleSortKey)}
            >
              {SALE_SORTS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loadFailed && (
          <div className="cs-empty cs-load-error" role="alert">
            <strong>마감세일을 불러오지 못했어요</strong>
            <p>인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p>
            <button type="button" onClick={() => setVersion((n) => n + 1)}>다시 시도</button>
          </div>
        )}

        {!loadFailed && sales !== null && visible.length === 0 && (
          <p className="cs-empty">
            지금은 진행 중인 마감세일이 없어요. 가게 사장님이 세일을 등록하면 이곳에 바로
            올라옵니다.
          </p>
        )}

        {!loadFailed && visible.length > 0 && (
          <ul className="cs-grid">
            {visible.map((sale) => {
              const left = minutesLeft(sale, now);
              const urgent = left <= URGENT_MINUTES;
              const liked = likedIds.includes(sale.id);

              return (
                <li key={sale.id} className={`cs-card cs-tone-${toneForStore(sale.storeId)}`}>
                  <div className="cs-card-top">
                    <span className={`cs-countdown${urgent ? ' is-urgent' : ''}`}>
                      <span className="cs-countdown-label">마감까지 </span>
                      {formatLeft(left)}
                    </span>
                    <strong className="cs-discount">
                      {formatSaleDiscount(sale)}
                      <span className="cs-discount-off">{sale.discountType === 'free' ? ' 제공' : ' OFF'}</span>
                    </strong>
                  </div>

                  <div className="cs-card-body">
                    <p className="cs-card-meta">
                      {sale.store.cuisineType ?? '동네 가게'} · 도보 {sale.walkMinutes}분
                    </p>
                    <h3 className="cs-card-name">
                      {/* 카드 전체가 눌리도록 버튼을 카드 위로 늘린다 (관심 버튼은 그 위에 있다) */}
                      <button type="button" className="cs-card-open" aria-label={`${sale.store.name} 세일 자세히`} onClick={() => openSale(sale)}>{sale.store.name}</button>
                    </h3>
                    <p className="cs-card-desc">{sale.desc}</p>

                    <div className="cs-card-foot">
                      <button
                        type="button"
                        className={`cs-like${liked ? ' is-on' : ''}`}
                        aria-pressed={liked}
                        aria-label={`${sale.store.name} 관심 ${liked ? '취소' : '등록'}`}
                        disabled={!userId}
                        onClick={() => void toggleLike(sale.id)}
                      >
                        {liked ? '♥' : '♡'} {sale.likeCount}명이 관심
                      </button>
                      <span className="cs-close-time">{hhmm(sale.closeAt)} 마감</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
