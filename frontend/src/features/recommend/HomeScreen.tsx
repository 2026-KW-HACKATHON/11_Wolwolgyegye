import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import Icon from '../../shared/Icon';
import { useFavoriteStores } from '../../shared/favorites/useFavoriteStores';
import { useUserSession } from '../../shared/session/UserSessionContext';
import { formatSaleDiscount } from '../closing-sale/discount';
import { fetchClosingSales } from '../closing-sale/source';
import type { ClosingSaleView } from '../closing-sale/types';
import { FEED_CHANGE_EVENT, fetchFeedPosts, findFeedStore } from '../store-feed/feedSource';
import type { FeedKind, FeedPost } from '../store-feed/types';
import FeedPostCard from './FeedPostCard';

type FeedFilter = 'all' | 'saved' | FeedKind;
const FILTERS = [['all', '전체 소식'], ['space-rental', '공간 대여'], ['oneday-class', '원데이클래스'], ['saved', '찜한 가게']] as const;

export default function HomeScreen({ onShowNearby, onShowStore }: { onShowNearby: () => void; onShowStore: (id: string) => void }) {
  const { userName } = useUserSession();
  const { ownedStores } = useAuth();
  const { isFavorite } = useFavoriteStores();
  const active = usePageActive();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [sales, setSales] = useState<ClosingSaleView[]>([]);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      // 혜택 칸은 덤이라, 세일을 못 읽어도 소식은 보여준다 (그때는 전에 읽은 혜택을 그대로 둔다)
      const [spaces, classes, promotions] = await Promise.all([fetchFeedPosts('space-rental'), fetchFeedPosts('oneday-class'), fetchClosingSales().catch(() => null)]);
      setPosts([...spaces, ...classes].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      if (promotions) setSales(promotions);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '동네 소식을 불러오지 못했어요.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!active) return;
    void reload();
    const onChange = () => void reload();
    window.addEventListener(FEED_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener(FEED_CHANGE_EVENT, onChange);
    };
  }, [active, reload]);

  const searchedPosts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return posts.filter((post) => !term || [post.title, post.summary, post.description, post.category, findFeedStore(post.storeId)?.name ?? ''].join(' ').toLocaleLowerCase().includes(term));
  }, [posts, query]);
  const visiblePosts = searchedPosts.filter((post) => filter === 'all' || (filter === 'saved' ? isFavorite(post.storeId) : post.kind === filter));

  return <div className="rp-home">
    <section className="rp-welcome">
      <div><p>{userName ? userName + '님, 반가워요' : '월계1동의 작은 발견'}</p><h1>오늘도, 동네 한 바퀴</h1><span>익숙한 골목에서 새로운 즐거움을 만나세요.</span></div>
    </section>
    <section className="rp-feed" aria-labelledby="rp-feed-title">
      <div className="rp-section-heading"><h2 id="rp-feed-title">사장님이 전하는 소식</h2>{ownedStores.length > 0 && <Link className="rp-owner-link" to="/owner">글쓰기 <Icon name="chevronRight" /></Link>}</div>
      <div className="rp-search"><Icon name="search" /><input type="search" aria-label="동네 소식 검색" placeholder="가게 이름이나 궁금한 수업을 검색해요" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}>×</button>}</div>
      <div className="rp-feed-filters" aria-label="게시글 종류">{FILTERS.map(([key, label]) => <button key={key} type="button" className={filter === key ? 'is-active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <p className="rp-feed-count" role="status">{loading ? '소식을 불러오고 있어요' : visiblePosts.length + '개의 소식'}</p>
      {error ? <div className="rp-feed-message" role="alert"><Icon name="storefront" /><strong>소식을 불러오지 못했어요</strong><p>{error}</p><button type="button" onClick={() => void reload()}>다시 시도</button></div> :
        loading ? <div className="rp-skeleton" aria-hidden="true" /> :
        visiblePosts.length === 0 ? <div className="rp-feed-message"><Icon name={filter === 'saved' ? 'heart' : 'search'} /><strong>{filter === 'saved' ? '마음에 드는 가게를 찜해 보세요' : '찾으시는 소식이 아직 없어요'}</strong><p>{filter === 'saved' ? '가게의 하트를 누르면 여기에 모아볼 수 있어요.' : '다른 검색어나 분류로 다시 찾아보세요.'}</p><button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>전체 소식 보기</button></div> :
        <div className="rp-feed-grid">{visiblePosts.map((post) => <FeedPostCard key={post.id} post={post} onShowStore={onShowStore} />)}</div>}
    </section>
    {sales.length > 0 && <section className="rp-promotions" aria-labelledby="rp-deals-title">
      <div className="rp-section-heading"><div><p className="rp-eyebrow">가까운 가게에서 알뜰하게</p><h2 id="rp-deals-title">놓치기 아쉬운 혜택</h2></div><Link to="/closing-sale">더 보기 <Icon name="chevronRight" /></Link></div>
      <div className="rp-promotion-row">{sales.slice(0, 3).map((sale) => <Link key={sale.id} to={`/closing-sale?sale=${encodeURIComponent(sale.id)}`} className="rp-promotion"><span className="rp-promotion-icon"><Icon name="tag" /></span><strong>{formatSaleDiscount(sale)}<small>{sale.discountType === 'free' ? ' 제공' : ' 할인'}</small></strong><b>{sale.store.name}</b><p>{sale.desc}</p><span className="rp-promotion-footer">할인 내용 보기 <Icon name="chevronRight" /></span></Link>)}</div>
    </section>}
    <button className="rp-map-teaser" type="button" onClick={onShowNearby}><span className="rp-map-teaser-icon"><Icon name="compass" /></span><span><strong>이번엔 지도로 둘러볼까요?</strong><small>가까운 가게를 한눈에 찾아보세요.</small></span><Icon name="chevronRight" /></button>
  </div>;
}
