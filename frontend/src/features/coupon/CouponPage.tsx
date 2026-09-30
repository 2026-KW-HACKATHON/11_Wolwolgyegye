import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../../shared/toast/ToastContext';
import { fetchStamps, recordDemoStamp, resetStampDemo } from './source';
import StampDetail from './StampDetail';
import StampList from './StampList';
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
  const toast = useToast();
  const [stamps, setStamps] = useState<StampView[] | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const [fresh, setFresh] = useState<{ storeId: string; index: number } | null>(null);
  // 목록 조건은 적립판에 다녀와도 유지한다
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StampFilter>('all');
  const [sort, setSort] = useState<StampSort>('closest-reward');
  const listScroll = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetchStamps()
      .then((list) => { if (!cancelled) setStamps(list); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [version]);

  const selectedId = new URLSearchParams(location.search).get('store');
  const selected = stamps?.find((v) => v.storeId === selectedId) ?? null;
  const showDetail = !!selected;

  // 목록 ↔ 적립판이 바뀔 때만 스크롤을 맞춘다 (적립판은 맨 위, 목록은 보던 위치로)
  const scroller = () => document.querySelector<HTMLElement>('.app-shell__main');
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

  const record = useCallback(async (view: StampView, kind: 'earn' | 'redeem') => {
    try {
      const tx = await recordDemoStamp(view, kind);
      setFresh(kind === 'earn' ? { storeId: view.storeId, index: tx.balanceAfter - 1 } : null);
      window.setTimeout(() => setFresh(null), 1800); // 탭을 다시 열 때 애니메이션이 반복되지 않게
      setVersion((n) => n + 1);
      if (kind === 'redeem') toast(`${view.reward} 교환 완료! 새 적립판이 시작됐어요`);
      else if (tx.balanceAfter >= view.requiredStamps) toast('다 모았어요! 이제 선물을 받을 수 있어요');
      else toast(`도장 쾅! ${tx.balanceAfter}/${view.requiredStamps}`);
      return true;
    } catch {
      toast(kind === 'earn' ? '다 모은 적립판이에요. 먼저 선물을 받아 주세요' : '스탬프가 아직 부족해요');
      return false;
    }
  }, [toast]);

  const resetDemo = useCallback(async () => {
    await resetStampDemo();
    setFresh(null);
    setVersion((n) => n + 1);
    toast('시연 기록을 지웠어요');
  }, [toast]);

  if (selected) {
    return (
      <div className="st-page">
        <StampDetail
          key={selected.storeId}
          view={selected}
          freshIndex={fresh?.storeId === selected.storeId ? fresh.index : null}
          onBack={() => navigate('/coupon')}
          onRecord={record}
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
        onFilter={setFilter}
        sort={sort}
        onSort={setSort}
        onOpen={open}
        onResetDemo={resetDemo}
      />
    </div>
  );
}
