import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import { useFavoriteStores } from '../../shared/favorites/useFavoriteStores';
import Sheet from '../../shared/sheet/Sheet';
import { fetchStamps } from './source';
import type { StampIndustry, StampView } from './types';
import '../../shared/store-list/store-list.css';
import './stamp.css';

/** 카테고리 id·URL(/coupon)은 팀원 코드·네비게이션 호환을 위해 유지하고, 화면 표시명만 '스탬프'로 쓴다 */

const INDUSTRIES: StampIndustry[] = ['전체', '카페·베이커리', '음식점', '생활·문화'];
const SORTS = [
  { key: 'near', label: '가까운순' },
  { key: 'progress', label: '많이 모은순' },
  { key: 'name', label: '이름순' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];
const TONES = ['amber', 'orange', 'brown', 'green', 'rose'] as const;

function industryOf(v: StampView): StampIndustry {
  const t = v.store.cuisineType;
  if (!t) return '생활·문화';
  return t === '카페' || t === '베이커리' ? '카페·베이커리' : '음식점';
}

/** 같은 가게는 정렬이 바뀌어도 항상 같은 색 */
function toneOf(storeId: string) {
  let hash = 0;
  for (const ch of storeId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

function statusText(v: StampView) {
  if (v.count >= v.requiredStamps) return '선물을 받을 수 있어요';
  if (v.count === 0) return '첫 스탬프를 모아보세요';
  return `선물까지 ${v.requiredStamps - v.count}개`;
}

function Dots({ v }: { v: StampView }) {
  return (
    <span className="st-dots" aria-hidden="true">
      {Array.from({ length: v.requiredStamps }, (_, i) => (
        <i key={i} className={i < v.count ? 'is-on' : ''} />
      ))}
    </span>
  );
}

export default function CouponPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = usePageActive();
  const { isFavorite, toggle } = useFavoriteStores();
  const [stamps, setStamps] = useState<StampView[] | null>(null);
  const [industry, setIndustry] = useState<StampIndustry>('전체');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('near');
  const [sheet, setSheet] = useState<'earn' | 'reward' | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStamps().then((list) => { if (!cancelled) setStamps(list); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (!active) setSheet(null); }, [active]);

  const selectedId = new URLSearchParams(location.search).get('store');
  const selected = stamps?.find((v) => v.storeId === selectedId) ?? null;
  useEffect(() => { if (active && selected) heading.current?.focus(); }, [active, selected]);

  const visible = useMemo(() => {
    if (!stamps) return [];
    const q = query.trim().toLocaleLowerCase();
    const list = stamps.filter(
      (v) => (industry === '전체' || industryOf(v) === industry) && `${v.store.name} ${v.store.cuisineType ?? ''}`.toLocaleLowerCase().includes(q),
    );
    if (sort === 'name') return list.sort((a, b) => a.store.name.localeCompare(b.store.name, 'ko'));
    if (sort === 'progress') return list.sort((a, b) => b.count / b.requiredStamps - a.count / a.requiredStamps);
    return list.sort((a, b) => a.walkMinutes - b.walkMinutes);
  }, [stamps, industry, query, sort]);

  /* ---------- 가게별 적립판 ---------- */
  if (selected) {
    const v = selected;
    const done = v.count >= v.requiredStamps;
    return (
      <div className="st-page">
        <button type="button" className="sl-back" onClick={() => navigate('/coupon')}>← 스탬프 가게 목록</button>

        <div className="st-detail">
          <section className={`st-board sl-tone-${toneOf(v.storeId)}`} aria-labelledby="st-board-name">
            <div className="st-board-top">
              <span className="sl-pill">◈ 나의 스탬프</span>
              <h1 id="st-board-name" className="st-board-name" ref={heading} tabIndex={-1}>{v.store.name}</h1>
              <p className="st-board-meta">{v.store.cuisineType ?? '동네 가게'} · 도보 {v.walkMinutes}분</p>
              <p className="st-board-count"><b>{v.count}</b> / {v.requiredStamps}</p>
            </div>
            <div className="st-board-body">
              <p className="st-board-status">{done ? '🎁 선물을 받을 준비가 됐어요!' : statusText(v) + ' 남았어요'}</p>
              <ol className="st-slots" aria-label={`${v.requiredStamps}개 중 ${v.count}개 적립`}>
                {Array.from({ length: v.requiredStamps }, (_, i) => {
                  const on = i < v.count;
                  const last = i === v.requiredStamps - 1;
                  return (
                    <li key={i} className={`${on ? 'is-on' : ''}${last ? ' is-gift' : ''}`} aria-label={`${i + 1}번째 ${on ? '적립 완료' : '미적립'}`}>
                      <span aria-hidden="true">{on ? '◈' : last ? '🎁' : i + 1}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="st-board-foot">{v.unit} 1회당 1개 · 가게 직원 확인 후 적립</p>
            </div>
          </section>

          <div className="st-side">
            <div className="st-reward">
              <span className="st-reward-label">{v.requiredStamps}개를 모으면 받는 상품</span>
              <strong className="st-reward-name">{v.reward}</strong>
              <span className="st-reward-sub">이 가게에서만 교환할 수 있어요.</span>
            </div>
            <button type="button" className="sl-primary" onClick={() => setSheet(done ? 'reward' : 'earn')}>
              {done ? '🎁 상품 교환 안내' : '◈ 적립 방법 보기'}
            </button>
            <button
              type="button"
              className={`sl-like sl-like--block${isFavorite(v.storeId) ? ' is-on' : ''}`}
              aria-pressed={isFavorite(v.storeId)}
              onClick={() => toggle(v.storeId)}
            >
              {isFavorite(v.storeId) ? '♥ 찜한 가게' : '♡ 가게 찜하기'}
            </button>
            <details className="st-terms" open>
              <summary>적립·교환 안내</summary>
              <ul>
                <li>{v.condition}</li>
                <li>{v.requiredStamps}개 적립 시 {v.reward} 제공</li>
                <li>상품 교환은 직원 확인 후 완료돼요.</li>
                <li>다른 가게의 스탬프와 합칠 수 없어요.</li>
              </ul>
            </details>
            <p className="st-info">
              <span>📍 {v.store.address}</span>
              <span>🕒 {v.store.businessHours}</span>
            </p>
          </div>
        </div>

        <p className="sl-demo">가게·적립 현황은 예시입니다. 실제 적립·교환은 아직 연결되지 않았어요.</p>

        <Sheet open={sheet !== null && active} title={sheet === 'reward' ? '상품 교환 안내' : '스탬프 적립 방법'} onClose={() => setSheet(null)}>
          <p className="sl-sheet-mark" aria-hidden="true">{sheet === 'reward' ? '🎁' : '◈'}</p>
          <h3 className="sl-sheet-lead">{sheet === 'reward' ? v.reward : '결제 후 직원에게 말해 주세요'}</h3>
          <p className="sl-sheet-copy">
            {sheet === 'reward'
              ? `모은 스탬프 ${v.requiredStamps}개를 확인한 뒤 직원이 상품 교환을 처리해요.`
              : `${v.condition}. 직원이 이용 내역을 확인하면 스탬프가 찍혀요.`}
          </p>
          <p className="sl-sheet-note">지금은 화면 시안이라 실제 적립·교환은 되지 않아요.</p>
          <button type="button" className="sl-primary" onClick={() => setSheet(null)}>확인</button>
        </Sheet>
      </div>
    );
  }

  /* ---------- 스탬프 가게 목록 ---------- */
  return (
    <div className="st-page">
      <section className="sl-hero">
        <span className="sl-hero-badge">◈ 모을수록 가까워지는 선물</span>
        <h1 className="sl-hero-heading">자주 가는 가게에서 <em>스탬프</em>를 모아보세요</h1>
        <p className="sl-hero-sub">가게마다 정해진 횟수를 채우면 준비된 상품을 드려요.</p>
        <span className="sl-hero-mark" aria-hidden="true">◈</span>
      </section>

      <label className="sl-search">
        <span aria-hidden="true">🔍</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="가게 이름으로 찾아보세요" aria-label="스탬프 가게 검색" />
      </label>

      <div className="sl-chips" role="group" aria-label="업종">
        {INDUSTRIES.map((i) => (
          <button key={i} type="button" className={`sl-chip${industry === i ? ' is-on' : ''}`} aria-pressed={industry === i} onClick={() => setIndustry(i)}>
            {i}
          </button>
        ))}
      </div>

      <section>
        <div className="sl-list-head">
          <div>
            <h2 className="sl-list-title">스탬프 가게</h2>
            <p className="sl-list-sub" aria-live="polite">
              {stamps === null ? '적립 현황을 불러오는 중이에요…' : <><b>{visible.length}</b>곳에서 스탬프를 모을 수 있어요</>}
            </p>
          </div>
          <label className="sl-sort">
            <span className="sl-sort-label">정렬</span>
            <select className="sl-sort-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
        </div>

        {stamps !== null && visible.length === 0 && (
          <div className="sl-empty">
            <p>조건에 맞는 가게가 없어요. 다른 업종이나 가게 이름으로 찾아보세요.</p>
            <button type="button" className="sl-link" onClick={() => { setIndustry('전체'); setQuery(''); }}>전체 가게 보기</button>
          </div>
        )}

        {visible.length > 0 && (
          <ul className="sl-grid">
            {visible.map((v) => {
              const done = v.count >= v.requiredStamps;
              const fav = isFavorite(v.storeId);
              return (
                <li key={v.storeId} className={`sl-card sl-tone-${toneOf(v.storeId)}`}>
                  <button type="button" className="sl-card-main" onClick={() => navigate(`/coupon?store=${encodeURIComponent(v.storeId)}`)} aria-label={`${v.store.name} 적립판 보기, ${v.count}개 적립`}>
                    <span className="sl-card-top">
                      <span className={`sl-pill${done ? ' is-ready' : ''}`}>{statusText(v)}</span>
                      <span className="st-card-count"><b>{v.count}</b> / {v.requiredStamps}</span>
                      <Dots v={v} />
                    </span>
                    <span className="sl-card-body">
                      <span className="sl-card-meta">{v.store.cuisineType ?? '생활·문화'} · 도보 {v.walkMinutes}분</span>
                      <span className="sl-card-name">{v.store.name}</span>
                      <span className="sl-card-desc">🎁 {v.requiredStamps}개 모으면 <b>{v.reward}</b></span>
                    </span>
                  </button>
                  <div className="sl-card-foot">
                    <button type="button" className={`sl-like${fav ? ' is-on' : ''}`} aria-pressed={fav} aria-label={`${v.store.name} 찜 ${fav ? '해제' : '하기'}`} onClick={() => toggle(v.storeId)}>
                      {fav ? '♥ 찜함' : '♡ 찜하기'}
                    </button>
                    <span className="sl-card-go" aria-hidden="true">적립판 보기</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectedId && stamps !== null && !selected && <p className="sl-demo" role="status">선택한 가게를 찾을 수 없어 목록을 보여드려요.</p>}

      <p className="sl-tip"><b>💡 적립은 이렇게</b> 결제할 때 직원에게 스탬프를 요청하면, 확인 후 적립판에 바로 찍혀요.</p>
      <p className="sl-demo">가게·적립 현황은 예시입니다.</p>
    </div>
  );
}
