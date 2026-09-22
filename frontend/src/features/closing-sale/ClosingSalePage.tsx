import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchClosingSales } from './saleSource';
import { SALE_SORTS, type ClosingSale, type SaleSortKey } from './closingSaleData';
import './closing-sale.css';

/** 남은 시간 표시를 1분마다 새로 계산한다 */
const TICK_MS = 30_000;
const LIKE_STORAGE_KEY = 'wol-closing-sale-likes';
/** 이 시간보다 적게 남으면 "곧 마감" 으로 강조한다 */
const URGENT_MINUTES = 60;

function loadLikes(): string[] {
  try {
    const raw = window.localStorage.getItem(LIKE_STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveLikes(ids: string[]) {
  try {
    window.localStorage.setItem(LIKE_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* 저장 실패해도 이번 세션 동작에는 지장 없음 */
  }
}

function minutesLeft(sale: ClosingSale, now: number) {
  return Math.floor((new Date(sale.closeAt).getTime() - now) / 60_000);
}

/** 42 -> "42분", 78 -> "1시간 18분" */
function formatLeft(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${String(m).padStart(2, '0')}분`;
}

/** 마감 시각을 "18:30" 으로 */
function formatCloseTime(sale: ClosingSale) {
  const at = new Date(sale.closeAt);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

function sortSales(sales: ClosingSale[], key: SaleSortKey) {
  const sorted = [...sales];
  if (key === 'discount') return sorted.sort((a, b) => b.discount - a.discount);
  if (key === 'near') return sorted.sort((a, b) => a.walkMinutes - b.walkMinutes);
  return sorted.sort((a, b) => a.closeAt.localeCompare(b.closeAt));
}

export default function ClosingSalePage() {
  const navigate = useNavigate();
  const [sales, setSales] = useState<ClosingSale[] | null>(null);
  const [sort, setSort] = useState<SaleSortKey>('closing');
  const [likedIds, setLikedIds] = useState<string[]>(loadLikes);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    fetchClosingSales().then((list) => {
      if (!cancelled) setSales(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  function toggleLike(id: string) {
    const next = likedIds.includes(id) ? likedIds.filter((v) => v !== id) : [...likedIds, id];
    setLikedIds(next);
    saveLikes(next);
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
              {sales === null ? (
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

        {sales !== null && visible.length === 0 && (
          <p className="cs-empty">
            지금은 진행 중인 마감세일이 없어요. 가게 사장님이 세일을 등록하면 이곳에 바로
            올라옵니다.
          </p>
        )}

        {visible.length > 0 && (
          <ul className="cs-grid">
            {visible.map((sale) => {
              const left = minutesLeft(sale, now);
              const urgent = left <= URGENT_MINUTES;
              const liked = likedIds.includes(sale.id);

              return (
                <li key={sale.id} className={`cs-card cs-tone-${sale.tone}`}>
                  <div className="cs-card-top">
                    <span className={`cs-countdown${urgent ? ' is-urgent' : ''}`}>
                      마감까지 {formatLeft(left)}
                    </span>
                    <strong className="cs-discount">{sale.discount}% OFF</strong>
                  </div>

                  <div className="cs-card-body">
                    <p className="cs-card-meta">
                      {sale.category} · 도보 {sale.walkMinutes}분
                    </p>
                    <h3 className="cs-card-name">{sale.storeName}</h3>
                    <p className="cs-card-desc">{sale.desc}</p>

                    <div className="cs-card-foot">
                      <button
                        type="button"
                        className={`cs-like${liked ? ' is-on' : ''}`}
                        aria-pressed={liked}
                        aria-label={`${sale.storeName} 관심 ${liked ? '취소' : '등록'}`}
                        onClick={() => toggleLike(sale.id)}
                      >
                        {liked ? '♥' : '♡'} {sale.likes + (liked ? 1 : 0)}명이 관심
                      </button>
                      <span className="cs-close-time">{formatCloseTime(sale)} 마감</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="cs-tip">
        <b>💡 헛걸음 방지</b> 마감 시간이 가까우면 재고가 빨리 떨어질 수 있어요. 출발 전에 가게에
        한 번 확인해 보세요.
      </p>

      <button type="button" className="cs-map-link" onClick={() => navigate('/recommend')}>
        지도에서 세일 매장 보기 →
      </button>
    </div>
  );
}
