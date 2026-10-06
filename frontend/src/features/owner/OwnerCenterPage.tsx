import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import Icon from '../../shared/Icon';
import type { IconName } from '../../shared/icons';
import Sheet from '../../shared/sheet/Sheet';
import { FEED_CHANGE_EVENT } from '../store-feed/feedSource';
import OwnerInfoPanel from './OwnerInfoPanel';
import OwnerPostSheet from './OwnerPostSheet';
import OwnerSalePanel from './OwnerSalePanel';
import ClassCompose from './compose/ClassCompose';
import SaleCompose from './compose/SaleCompose';
import SpaceCompose from './compose/SpaceCompose';
import StampCompose from './compose/StampCompose';
import { fetchOwnerDashboard, type OwnerDashboard, type OwnerNews, type OwnerNewsKind } from './ownerApi';
import './owner.css';

const KIND_META: Record<OwnerNewsKind, { label: string; icon: IconName }> = {
  'space-rental': { label: '공간 대여', icon: 'house' },
  'oneday-class': { label: '원데이 클래스', icon: 'palette' },
  'closing-sale': { label: '마감세일', icon: 'bolt' },
  coupon: { label: '스탬프', icon: 'gift' },
};
const KINDS = Object.keys(KIND_META) as OwnerNewsKind[];

/** 새 소식 등록 카드 */
const COMPOSE: { kind: OwnerNewsKind; title: string; desc: string }[] = [
  { kind: 'space-rental', title: '공간 대여 등록', desc: '가게의 공간을 모임, 파티, 촬영 등으로 대여해보세요.' },
  { kind: 'oneday-class', title: '원데이 클래스 등록', desc: '가게에서 특별한 클래스를 열어보세요.' },
  { kind: 'closing-sale', title: '마감세일 등록', desc: '남는 상품을 특별한 가격에 판매해보세요.' },
  { kind: 'coupon', title: '스탬프 혜택 등록', desc: '방문할수록 특별한 혜택을 제공해보세요.' },
];

type Sort = 'latest' | 'schedule';
type SheetKey = 'sale' | 'info';

/** ?new=<종류> 로 여는 등록 화면 */
const COMPOSERS = {
  'space-rental': SpaceCompose,
  'oneday-class': ClassCompose,
  'closing-sale': SaleCompose,
  coupon: StampCompose,
} as const;

/**
 * 가게 관리 (1차 탭, 사장님 계정에만 보인다).
 * 위에서부터 새 소식 등록 → 운영 중인 소식.
 * 새 소식 등록은 전체 화면 등록 페이지(compose/)로 연다. 주소에 ?new=<종류> 를 붙여서, 뒤로 가기로 닫히게 한다.
 * 등록한 글을 고칠 때는 공간대여·클래스는 그 카테고리 화면의 수정 창, 마감세일·가게 정보는 이 화면의 창(Sheet)을 쓴다.
 */
export default function OwnerCenterPage() {
  const active = usePageActive();
  const { ownedStores, refresh } = useAuth();
  const store = ownedStores[0];
  const [data, setData] = useState<OwnerDashboard | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<OwnerNewsKind | 'all'>('all');
  const [sort, setSort] = useState<Sort>('latest');
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  /** 눌러서 연 공간대여·클래스 글 */
  const [detailId, setDetailId] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const composing = params.get('new');
  const Composer = active && composing && composing in COMPOSERS ? COMPOSERS[composing as OwnerNewsKind] : null;

  const reload = useCallback(async () => {
    if (!store) return;
    try { setData(await fetchOwnerDashboard(store.id)); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '가게 소식을 불러오지 못했어요.'); }
  }, [store]);

  // 탭을 열 때마다, 그리고 글을 쓰거나 고친 뒤에 다시 읽는다
  useEffect(() => {
    if (!active) return;
    void reload();
    const onChange = () => { void reload(); };
    window.addEventListener(FEED_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(FEED_CHANGE_EVENT, onChange);
  }, [active, reload]);

  const news = useMemo(() => {
    const list = data?.news.filter((n) => filter === 'all' || n.kind === filter) ?? [];
    // 끝난 소식은 아래로, 그 안에서 고른 순서대로
    const key = (n: OwnerNews) => (sort === 'latest' ? -Date.parse(n.createdAt || '0') : Date.parse(n.sortAt || '0'));
    return [...list].sort((a, b) => Number(a.status.tone === 'off') - Number(b.status.tone === 'off') || key(a) - key(b));
  }, [data, filter, sort]);

  function compose(kind: OwnerNewsKind) {
    const next = new URLSearchParams(params);
    next.set('new', kind);
    if (store) next.set('store', store.id);
    setParams(next);
  }

  function closeCompose() {
    const next = new URLSearchParams(params);
    next.delete('new'); next.delete('store');
    setParams(next);
    void reload();
  }

  function openNews(item: OwnerNews) {
    if (item.kind === 'space-rental' || item.kind === 'oneday-class') setDetailId(item.id);
    else if (item.kind === 'coupon') compose('coupon');
    else setSheet('sale');
  }

  function closeSheet() {
    setSheet(null);
    void reload();
  }

  if (!store) {
    return <div className="oc-page"><p className="op-muted">승인된 가게가 없어요. 내 정보에서 사장님 신청 상태를 확인해 주세요.</p></div>;
  }

  return (
    <div className="oc-page">
      <header className="oc-head">
        <span className="oc-head-icon" aria-hidden="true"><Icon name="storefront" /></span>
        <div className="oc-head-text">
          <h1>가게 관리</h1>
          <p>가게의 새로운 이야기를 등록해보세요.</p>
        </div>
      </header>

      <div className="oc-store-row">
        <strong className="oc-store-name">{store.name}</strong>
        <button type="button" className="oc-store-edit" onClick={() => setSheet('info')}>가게 정보 관리 <Icon name="chevronRight" /></button>
      </div>

      <section className="oc-section" aria-labelledby="oc-compose-title">
        <h2 id="oc-compose-title" className="oc-title">새 소식 등록</h2>
        <p className="oc-sub">우리 가게의 공간과 시간을 이웃에게 공유해보세요.</p>
        <div className="oc-compose">
          {COMPOSE.map((item) => (
            <button key={item.kind} type="button" className="oc-compose-card" onClick={() => compose(item.kind)}>
              <span className="oc-compose-icon" aria-hidden="true"><Icon name={KIND_META[item.kind].icon} /></span>
              <span className="oc-compose-text">
                <strong>{item.title}</strong>
                <span>{item.desc}</span>
              </span>
              <Icon name="chevronRight" className="oc-chevron" />
            </button>
          ))}
        </div>
      </section>

      <section className="oc-section" aria-labelledby="oc-news-title">
        <div className="oc-news-head">
          <h2 id="oc-news-title" className="oc-title">운영 중인 소식</h2>
          <label className="oc-sort">
            <span>정렬</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="latest">최신순</option>
              <option value="schedule">일정순</option>
            </select>
          </label>
        </div>
        <div className="oc-chips" role="group" aria-label="소식 종류">
          {(['all', ...KINDS] as const).map((kind) => (
            <button key={kind} type="button" aria-pressed={filter === kind} onClick={() => setFilter(kind)}>
              {kind === 'all' ? '전체' : KIND_META[kind].label}
            </button>
          ))}
        </div>

        {error && <p className="op-error" role="alert">{error} <button type="button" className="op-text-btn" onClick={() => void reload()}>다시 시도</button></p>}
        {!error && !data && <p className="op-muted">불러오는 중…</p>}
        {data && news.length === 0 && <p className="oc-empty">{filter === 'all' ? '아직 등록한 소식이 없어요. 위에서 첫 소식을 등록해보세요.' : `등록한 ${KIND_META[filter].label} 소식이 없어요.`}</p>}
        {news.length > 0 && (
          <ul className="oc-news">
            {news.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <button type="button" className="oc-news-item" data-off={item.status.tone === 'off' || undefined} onClick={() => openNews(item)}>
                  <span className="oc-news-icon" aria-hidden="true"><Icon name={item.kind === 'closing-sale' || item.kind === 'coupon' ? KIND_META[item.kind].icon : 'calendar'} /></span>
                  <span className="oc-news-text">
                    <span className="oc-tag">{KIND_META[item.kind].label}</span>
                    <strong>{item.title}</strong>
                    {item.when && <span className="oc-news-when">{item.when}</span>}
                  </span>
                  <span className="oc-status" data-tone={item.status.tone}>{item.status.label}</span>
                  <Icon name="chevronRight" className="oc-chevron" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={sheet === 'sale'} title={`마감세일 · ${store.name}`} onClose={closeSheet}>
        {sheet === 'sale' && <OwnerSalePanel storeId={store.id} />}
      </Sheet>
      <Sheet open={sheet === 'info'} title={`가게 정보 · ${store.name}`} onClose={closeSheet}>
        {sheet === 'info' && <OwnerInfoPanel storeId={store.id} onRenamed={() => void refresh()} />}
      </Sheet>

      <OwnerPostSheet
        item={detailId ? data?.news.find((n) => n.id === detailId && n.post) ?? null : null}
        onClose={() => setDetailId(null)}
        onCancelled={() => void reload()}
      />

      {Composer && <Composer storeId={ownedStores.find((s) => s.id === params.get('store'))?.id ?? store.id} onClose={closeCompose} />}
    </div>
  );
}
