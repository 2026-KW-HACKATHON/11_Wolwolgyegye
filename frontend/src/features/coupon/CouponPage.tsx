import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import { fetchStamps } from './source';
import StampDetail from './StampDetail';
import StampList from './StampList';
import { isReady } from './constants';
import type { StampFilter, StampSort, StampView } from './types';
import './stamp.css';

/**
 * 스탬프 화면. 카테고리 id·URL(/coupon)은 팀원 코드·네비게이션 호환을 위해 유지하고, 화면 표시명만 '스탬프'로 쓴다.
 * - /coupon            : 나의 스탬프 지갑 (목록)
 * - /coupon?store=ID   : 가게별 적립판 (다른 화면에서 이 주소로 바로 연결할 수 있다)
 */
export default function CouponPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = usePageActive();
  const [stamps, setStamps] = useState<StampView[] | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  // 목록 조건은 적립판에 다녀와도 유지한다
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StampFilter>('all');
  const [sort, setSort] = useState<StampSort>('closest-reward');
  const listScroll = useRef(0);
  // '전체' 목록에서 고른 가게: 아직 적립 전이어도 '모으는 중'에 카드로 보여주고, 그 카드로 스크롤한다
  const [picked, setPicked] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setError(false);
    fetchStamps()
      .then((list) => { if (!cancelled) setStamps(list); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [version, active]);

  // 다른 화면/탭에서 돌아오면 사장님 설정과 잔액을 다시 조회한다.
  useEffect(() => {
    const refresh = () => { if (active && document.visibilityState === 'visible') setVersion((n) => n + 1); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [active]);

  const selectedId = new URLSearchParams(location.search).get('store');
  const selected = stamps?.find((v) => v.storeId === selectedId) ?? null;
  const showDetail = !!selected;

  // 목록 ↔ 적립판이 바뀔 때만 스크롤을 맞춘다 (적립판은 맨 위, 목록은 보던 위치로)
  const scroller = () => document.querySelector<HTMLElement>('.swipe-panel[data-panel="coupon"] .swipe-panel__body');
  const view = showDetail ? `store:${selectedId}` : 'list';
  const prevView = useRef(view);
  useLayoutEffect(() => {
    if (prevView.current === view) return;
    prevView.current = view;
    const main = scroller();
    if (main) main.scrollTop = view === 'list' ? listScroll.current : 0;
  }, [view]);

  const open = useCallback((storeId: string) => {
    listScroll.current = scroller()?.scrollTop ?? 0;
    navigate(`/coupon?store=${encodeURIComponent(storeId)}`);
  }, [navigate]);

  const changeFilter = useCallback((value: StampFilter) => { setFocusId(null); setFilter(value); }, []);
  const pick = useCallback((view: StampView) => {
    if (!isReady(view) && view.count === 0) setPicked((prev) => (prev.includes(view.storeId) ? prev : [...prev, view.storeId]));
    setFilter(isReady(view) ? 'ready' : 'collecting');
    setFocusId(view.storeId);
  }, []);

  if (selected) {
    return (
      <div className="st-page">
        <StampDetail
          key={selected.storeId}
          view={selected}
          onBack={() => navigate('/coupon')}
        />
      </div>
    );
  }

  return (
    <div className="st-page">
      <StampList
        stamps={stamps}
        error={error}
        onRetry={() => setVersion((n) => n + 1)}
        missingId={selectedId && stamps ? selectedId : null}
        query={query}
        onQuery={setQuery}
        filter={filter}
        onFilter={changeFilter}
        sort={sort}
        onSort={setSort}
        onOpen={open}
        picked={picked}
        focusId={focusId}
        onPick={pick}
      />
    </div>
  );
}
