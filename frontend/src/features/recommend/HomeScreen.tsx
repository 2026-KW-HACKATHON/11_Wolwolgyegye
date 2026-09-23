import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useVisibleCategories } from '../../core/categories/useVisibleCategories';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import Icon from '../../shared/Icon';
import { fetchClosingSales } from '../closing-sale/source';
import type { ClosingSaleView } from '../closing-sale/types';
import { FEED_CHANGE_EVENT, fetchFeedPosts, findFeedStore, POST_STORAGE_KEY } from '../store-feed/feedSource';
import { formatPrice, isAvailable, type FeedKind, type FeedPost } from '../store-feed/types';
import { CATEGORY_VISUALS, NEIGHBORHOOD } from './recommendData';

type FeedFilter = 'all' | FeedKind;

export default function HomeScreen({ onShowNearby }: { onShowNearby: () => void }) {
  const { scrollable } = useVisibleCategories();
  const navigate = useNavigate();
  const active = usePageActive();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [sales, setSales] = useState<ClosingSaleView[]>([]);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [spaces, classes, promotions] = await Promise.all([fetchFeedPosts('space-rental'), fetchFeedPosts('oneday-class'), fetchClosingSales()]);
      setPosts([...spaces, ...classes].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      setSales(promotions);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '동네 소식을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void reload();
    const onChange = () => void reload();
    const onStorage = (event: StorageEvent) => { if (event.key === POST_STORAGE_KEY || event.key === null) void reload(); };
    window.addEventListener(FEED_CHANGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(FEED_CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [active, reload]);

  const visiblePosts = useMemo(() => posts.filter((post) => filter === 'all' || post.kind === filter), [posts, filter]);

  return <div className="rp-home">
    <div className="rp-home-topline"><span><Icon name="pin" /> {NEIGHBORHOOD}</span><span>우리 동네에서 발견하기</span></div>
    <div className="rp-home-heading"><div><p className="rp-eyebrow">WOLWOL NEIGHBORHOOD</p><h1>오늘, 동네에<br />새로운 이야기가 있어요.</h1><p>사장님이 직접 전하는 공간과 하루의 경험</p></div><span className="rp-heading-spark" aria-hidden="true">✳</span></div>

    <div className="rp-category-strip" aria-label="카테고리 바로가기">
      {scrollable.map((category) => {
        const visual = CATEGORY_VISUALS[category.id];
        return <button key={category.id} type="button" onClick={() => navigate(category.path)}><span className={`rp-category-icon rp-cat-bg--${visual?.bg ?? 'space'}`}>{visual && <Icon name={visual.icon} />}</span><span>{category.name}</span></button>;
      })}
    </div>

    <div className="rp-feed-heading"><div><p className="rp-eyebrow">FROM OUR NEIGHBORS</p><h2>동네 사장님 소식</h2><p>쉬는 공간을 나누고, 좋아하는 일을 함께해요.</p></div><Link to="/owner">사장님 글쓰기 <Icon name="chevronRight" /></Link></div>
    <div className="rp-feed-filters" aria-label="게시글 종류">
      {([['all', '전체'], ['space-rental', '공간 대여'], ['oneday-class', '원데이클래스']] as const).map(([key, label]) => <button key={key} type="button" className={filter === key ? 'is-active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
    </div>

    {error ? <div className="rp-feed-message" role="alert">{error}<button type="button" onClick={() => void reload()}>다시 시도</button></div> : loading ? <p className="rp-feed-message">동네 소식을 불러오는 중이에요…</p> : visiblePosts.length === 0 ? <p className="rp-feed-message">아직 등록된 소식이 없어요.</p> : <div className="rp-feed-grid">
      {visiblePosts.slice(0, 6).map((post) => {
        const store = findFeedStore(post.storeId);
        const image = post.imageUrl || store?.thumbnailUrl;
        return <Link key={post.id} className="rp-post" to={`${post.kind === 'space-rental' ? '/space-rental' : '/oneday-class'}?post=${encodeURIComponent(post.id)}`}>
          <div className={`rp-post-cover rp-post-cover--${post.kind}`}>{image ? <img src={image} alt="" loading="lazy" /> : <Icon name={post.kind === 'space-rental' ? 'house' : 'paletteColor'} />}<span className="rp-post-type">{post.kind === 'space-rental' ? '공간 대여' : '원데이클래스'}</span></div>
          <div className="rp-post-body"><div className="rp-post-byline"><span className="rp-post-avatar">{store?.name.slice(0, 1) ?? '가'}</span><span>{store?.name ?? '동네 가게'}</span><span>사장님 소식</span></div><h3>{post.title}</h3><p className="rp-post-description">{post.description}</p><div className="rp-post-bottom"><strong>{formatPrice(post)}</strong><span>{isAvailable(post) ? '모집 중' : '마감'}</span></div></div>
        </Link>;
      })}
    </div>}

    {sales.length > 0 && <section className="rp-promotions" aria-label="동네 가게 혜택"><div className="rp-promotions-heading"><div><p className="rp-eyebrow">TODAY'S LITTLE DEALS</p><h2>오늘의 동네 혜택</h2></div><Link to="/closing-sale">모두 보기 <Icon name="chevronRight" /></Link></div><div className="rp-promotion-row">{sales.slice(0, 3).map((sale) => <Link key={sale.id} to="/closing-sale" className="rp-promotion"><img src={sale.store.thumbnailUrl} alt="" loading="lazy" /><span><strong>{sale.store.name}</strong><small>{sale.desc}</small><em>{Math.round(sale.discountRate * 100)}% 할인</em></span></Link>)}</div></section>}

    <p className="rp-demo-note">예시 가게·게시글은 시연용입니다. 직접 작성한 글은 현재 브라우저에만 저장돼요.</p>
    <button className="rp-map-teaser" type="button" onClick={onShowNearby}><span><Icon name="pin" /> 지도에서 동네 가게 보기</span><span>아래로 내려서 탐색해 보세요 <Icon name="chevronDown" /></span></button>
  </div>;
}
