import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { useShell } from '../../layout/AppShell/ShellContext';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import Icon from '../../shared/Icon';
import { useToast } from '../../shared/toast/ToastContext';
import { FEED_CHANGE_EVENT, findFeedStore } from './feedSource';
import { scheduleLabel } from './FeedPostDetail';
import { FEED_CATEGORIES, formatPrice, isAvailable, type FeedKind, type FeedPost } from './types';
import FeedDialog from './FeedDialog';
import PostForm from './PostForm';
import PostVisual from './PostVisual';
import './store-feed.css';

const COPY = {
  'space-rental': { label: '공간 대여', eyebrow: '우리 동네, 우리만의 공간', title: '좋은 공간을 나누면,\n일상이 조금 특별해져요.', description: '쉬는 날의 카페부터 조용한 작업실까지. 사장님이 직접 소개하는 동네 공간을 만나보세요.', icon: 'house' as const },
  'oneday-class': { label: '원데이클래스', eyebrow: '동네에서 발견하는 새로운 취향', title: '처음이라 더 즐거운,\n하루의 작은 배움.', description: '반죽을 만지고, 커피를 내리고, 나만의 작품을 만들어요. 동네 사장님이 오늘은 선생님이 됩니다.', icon: 'paletteColor' as const },
};

/**
 * 공간대여 / 원데이클래스 화면 (1차 탭).
 * 글을 누르면 그 가게의 2차 탭이 열리고, 2차 탭의 이 카테고리 글(누른 글)이 맨 위에 오도록 스크롤된다.
 * - ?post=ID : 그 글의 2차 탭을 연다 (홈 화면 등에서 연결)
 * - ?edit=ID : 그 글의 수정 창을 연다 (2차 탭의 "글 수정" 버튼)
 * - ?compose=1 : 글쓰기 창을 연다
 */
export default function StoreFeedPage({ kind, loadPosts }: { kind: FeedKind; loadPosts: () => Promise<FeedPost[]> }) {
  const copy = COPY[kind];
  const { status } = useAuth();
  const canWrite = status === 'owner';
  const active = usePageActive();
  const showToast = useToast();
  const { openStore } = useShell();
  const [params, setParams] = useSearchParams();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('전체');
  const [sort, setSort] = useState('latest');
  const [editing, setEditing] = useState<FeedPost | null | undefined>(undefined);
  const [now, setNow] = useState(Date.now);

  const reload = useCallback(async () => {
    setError('');
    try { setPosts(await loadPosts()); }
    catch (e) { setError(e instanceof Error ? e.message : '피드를 불러오지 못했어요.'); }
    finally { setLoading(false); }
  }, [loadPosts]);

  useEffect(() => {
    if (!active) return;
    void reload(); setNow(Date.now());
    const onChange = () => { void reload(); };
    window.addEventListener(FEED_CHANGE_EVENT, onChange);
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => { window.removeEventListener(FEED_CHANGE_EVENT, onChange); window.clearInterval(timer); };
  }, [active, reload]);

  const openPost = useCallback((post: FeedPost) => {
    openStore(post.storeId, { category: kind, target: `post-${post.id}` });
  }, [openStore, kind]);

  useEffect(() => {
    if (active && params.get('compose') === '1') {
      setEditing(null);
      const next = new URLSearchParams(params); next.delete('compose'); setParams(next, { replace: true });
    }
  }, [active, params, setParams]);

  // ?post=ID → 그 글의 2차 탭, ?edit=ID → 그 글의 수정 창
  useEffect(() => {
    const postId = params.get('post');
    const editId = params.get('edit');
    if (!active || (!postId && !editId) || loading || error) return;
    const find = (id: string | null) => (id ? posts.find((item) => item.id === id && item.kind === kind) : undefined);
    const post = find(postId);
    const edit = find(editId);
    if (post) openPost(post);
    if (edit) setEditing(edit);
    const next = new URLSearchParams(params); next.delete('post'); next.delete('edit'); setParams(next, { replace: true });
  }, [active, error, kind, loading, params, posts, setParams, openPost]);

  const visible = useMemo(() => {
    return posts.filter((post) => {
      return category === '전체' || post.category === category;
    }).sort((a, b) => sort === 'price' ? a.price - b.price : sort === 'date' && a.kind === 'oneday-class' && b.kind === 'oneday-class' ? Date.parse(a.startsAt) - Date.parse(b.startsAt) : Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [posts, category, sort]);

  function resetFilters() { setCategory('전체'); }

  return <div className={`sf-page sf-page--${kind}`}>
    <section className="sf-hero">
      <div><span className="sf-eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.description}</p>
        {canWrite && <button type="button" className="sf-primary" onClick={() => setEditing(null)}>＋ 사장님 글쓰기</button>}
      </div>
    </section>

    <section className="sf-feed-section" aria-label={copy.label + ' 게시글'}>
      <div className="sf-toolbar">
        <div className="sf-filters" aria-label="분류">{['전체', ...FEED_CATEGORIES[kind]].map((c) => <button key={c} type="button" aria-pressed={category === c} className={category === c ? 'is-active' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div>
      </div>
      <div className="sf-count-row"><p className="sf-count" aria-live="polite">{loading ? '소식을 불러오고 있어요…' : <>총 <b>{visible.length}</b>개의 이야기</>}</p><label className="sf-sort">정렬<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="latest">최신순</option><option value="price">가격 낮은순</option>{kind === 'oneday-class' && <option value="date">수업일순</option>}</select></label></div>
      {error ? <div className="sf-empty" role="alert"><p>{error}</p><button type="button" className="sf-secondary" onClick={() => void reload()}>다시 불러오기</button></div> : !loading && visible.length === 0 ? <div className="sf-empty"><Icon name={copy.icon} /><h3>아직 보여드릴 소식이 없어요</h3><p>분류 조건을 바꾸거나, 동네의 첫 이야기를 올려보세요.</p><button type="button" className="sf-secondary" onClick={resetFilters}>조건 초기화</button></div> : <ul className="sf-grid">
        {visible.map((post) => {
          const store = findFeedStore(post.storeId);
          const available = isAvailable(post, now);
          return <li key={post.id} className="sf-card">
            <button type="button" className="sf-card-open" aria-label={post.title + ' 상세보기'} onClick={() => openPost(post)}>
              <PostVisual post={post} />
              <div className="sf-card-content"><div className="sf-byline"><span className="sf-avatar">{store?.name.slice(0, 1) ?? '가'}</span><span>{store?.name ?? '가게'}</span></div>
                <h3>{post.title}</h3><p className="sf-excerpt">{post.summary || post.description}</p><p className="sf-schedule"><Icon name={kind === 'space-rental' ? 'pin' : 'calendar'} />{kind === 'space-rental' ? store?.address : scheduleLabel(post)}</p><div className="sf-price-row"><strong>{formatPrice(post)}</strong><span className="sf-capacity">{!available && <span className="sf-status is-closed">모집 마감</span>}{kind === 'space-rental' ? '최대' : '정원'} {post.capacity}명{store?.isMock ? ' · 예시 글' : ''}</span></div>
              </div>
            </button>
          </li>;
        })}
      </ul>}
    </section>

    {active && canWrite && editing !== undefined && <FeedDialog title={editing ? copy.label + ' 글 수정' : copy.label + ' 글쓰기'} onDismiss={() => setEditing(undefined)}>
      <PostForm kind={kind} existing={editing ?? undefined} onCancel={() => setEditing(undefined)} onSaved={(post) => { setEditing(undefined); resetFilters(); setSort('latest'); void reload().then(() => openPost(post)); showToast('게시글을 올렸어요.'); }} />
    </FeedDialog>}
  </div>;
}
