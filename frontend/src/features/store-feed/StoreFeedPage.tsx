import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { getSupabaseClient } from '../../core/supabase/client';
import { usePageActive } from '../../layout/KeepAlivePages/PageActiveContext';
import Icon from '../../shared/Icon';
import { useToast } from '../../shared/toast/ToastContext';
import { deleteFeedPost, FEED_CHANGE_EVENT, findFeedStore } from './feedSource';
import { FEED_CATEGORIES, formatPrice, isAvailable, type FeedKind, type FeedPost } from './types';
import FeedDialog from './FeedDialog';
import PostForm from './PostForm';
import PostVisual from './PostVisual';
import './store-feed.css';

const COPY = {
  'space-rental': { label: '공간 대여', eyebrow: '우리 동네, 우리만의 공간', title: '좋은 공간을 나누면,\n일상이 조금 특별해져요.', description: '쉬는 날의 카페부터 조용한 작업실까지. 사장님이 직접 소개하는 동네 공간을 만나보세요.', icon: 'house' as const },
  'oneday-class': { label: '원데이클래스', eyebrow: '동네에서 발견하는 새로운 취향', title: '처음이라 더 즐거운,\n하루의 작은 배움.', description: '반죽을 만지고, 커피를 내리고, 나만의 작품을 만들어요. 동네 사장님이 오늘은 선생님이 됩니다.', icon: 'paletteColor' as const },
};
function scheduleLabel(post: FeedPost) {
  return post.kind === 'space-rental' ? post.schedule : new Date(post.startsAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function StoreFeedPage({ kind, loadPosts }: { kind: FeedKind; loadPosts: () => Promise<FeedPost[]> }) {
  const copy = COPY[kind];
  const { status, userId, ownedStores } = useAuth();
  const canWrite = status === 'owner';
  const active = usePageActive();
  const showToast = useToast();
  const [params, setParams] = useSearchParams();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('전체');
  const [sort, setSort] = useState('latest');
  const [onlyLiked, setOnlyLiked] = useState(false);
  const [likes, setLikes] = useState<string[]>([]);
  const [selected, setSelected] = useState<FeedPost | null>(null);
  const [editing, setEditing] = useState<FeedPost | null | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [now, setNow] = useState(Date.now);

  const reload = useCallback(async () => {
    setError('');
    try { setPosts(await loadPosts()); }
    catch (e) { setError(e instanceof Error ? e.message : '피드를 불러오지 못했어요.'); }
    finally { setLoading(false); }
  }, [loadPosts]);

  const reloadLikes = useCallback(async () => {
    if (!userId) { setLikes([]); return; }
    const { data, error: likesError } = await getSupabaseClient().from('post_favorites').select('post_id').eq('user_id', userId);
    if (!likesError) setLikes((data ?? []).map((row) => row.post_id));
  }, [userId]);

  useEffect(() => {
    if (!active) return;
    void reload(); void reloadLikes(); setNow(Date.now());
    const onChange = () => { void reload(); };
    window.addEventListener(FEED_CHANGE_EVENT, onChange);
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => { window.removeEventListener(FEED_CHANGE_EVENT, onChange); window.clearInterval(timer); };
  }, [active, reload, reloadLikes]);

  useEffect(() => {
    if (active && params.get('compose') === '1') {
      setEditing(null);
      const next = new URLSearchParams(params); next.delete('compose'); setParams(next, { replace: true });
    }
  }, [active, params, setParams]);

  useEffect(() => {
    const postId = params.get('post');
    if (!active || !postId || loading || error) return;
    const post = posts.find((item) => item.id === postId && item.kind === kind);
    if (post) { setSelected(post); setDeleteConfirm(false); setDetailError(''); }
    const next = new URLSearchParams(params); next.delete('post'); setParams(next, { replace: true });
  }, [active, error, kind, loading, params, posts, setParams]);

  const visible = useMemo(() => {
    return posts.filter((post) => {
      return (category === '전체' || post.category === category)
        && (!onlyLiked || likes.includes(post.id));
    }).sort((a, b) => sort === 'price' ? a.price - b.price : sort === 'date' && a.kind === 'oneday-class' && b.kind === 'oneday-class' ? Date.parse(a.startsAt) - Date.parse(b.startsAt) : Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [posts, category, onlyLiked, likes, sort]);

  async function toggleLike(id: string) {
    if (!userId) { showToast('로그인하면 게시글을 찜할 수 있어요.'); return; }
    const exists = likes.includes(id);
    setLikes((current) => exists ? current.filter((value) => value !== id) : [...current, id]);
    const query = exists
      ? getSupabaseClient().from('post_favorites').delete().eq('user_id', userId).eq('post_id', id)
      : getSupabaseClient().from('post_favorites').insert({ user_id: userId, post_id: id });
    const { error: likeError } = await query;
    if (likeError) { await reloadLikes(); showToast('찜을 저장하지 못했어요.'); }
  }
  function openPost(post: FeedPost) { setSelected(post); setDeleteConfirm(false); setDetailError(''); }
  async function remove() {
    if (!selected || deleting) return;
    setDeleting(true); setDetailError('');
    try { await deleteFeedPost(selected.id, selected.kind); setSelected(null); await reload(); showToast('게시글을 삭제했어요.'); }
    catch (e) { setDetailError(e instanceof Error ? e.message : '삭제하지 못했어요.'); }
    finally { setDeleting(false); }
  }
  function resetFilters() { setCategory('전체'); setOnlyLiked(false); }
  const selectedStore = selected ? findFeedStore(selected.storeId) : undefined;

  return <div className={`sf-page sf-page--${kind}`}>
    <section className="sf-hero">
      <div><span className="sf-eyebrow">{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.description}</p>
        {canWrite && <button type="button" className="sf-primary" onClick={() => setEditing(null)}>＋ 사장님 글쓰기</button>}
      </div>
      <div className="sf-hero-art" aria-hidden="true"><span className="sf-art-ring" /><Icon name={copy.icon} /><span className="sf-art-note">{kind === 'space-rental' ? '함께 쓰는 즐거움' : '새로운 나를 만나는 날'}</span></div>
    </section>

    <section className="sf-feed-section" aria-label={copy.label + ' 게시글'}>
      <div className="sf-feed-heading"><div><span className="sf-eyebrow">FROM OUR NEIGHBORS</span><h2>사장님이 전하는 소식</h2></div></div>
      <div className="sf-toolbar">
        <div className="sf-filters" aria-label="분류">{['전체', ...FEED_CATEGORIES[kind]].map((c) => <button key={c} type="button" aria-pressed={category === c} className={category === c ? 'is-active' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <div className="sf-options"><button type="button" className={`sf-saved-toggle ${onlyLiked ? 'is-active' : ''}`} aria-pressed={onlyLiked} onClick={() => setOnlyLiked(!onlyLiked)}>♡ 찜한 글</button></div>
      </div>
      <div className="sf-count-row"><p className="sf-count" aria-live="polite">{loading ? '소식을 불러오고 있어요…' : <>총 <b>{visible.length}</b>개의 이야기</>}</p><label className="sf-sort">정렬<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="latest">최신순</option><option value="price">가격 낮은순</option>{kind === 'oneday-class' && <option value="date">수업일순</option>}</select></label></div>
      {error ? <div className="sf-empty" role="alert"><p>{error}</p><button type="button" className="sf-secondary" onClick={() => void reload()}>다시 불러오기</button></div> : !loading && visible.length === 0 ? <div className="sf-empty"><Icon name={copy.icon} /><h3>아직 보여드릴 소식이 없어요</h3><p>분류나 찜한 글 조건을 바꾸거나, 동네의 첫 이야기를 올려보세요.</p><button type="button" className="sf-secondary" onClick={resetFilters}>조건 초기화</button></div> : <ul className="sf-grid">
        {visible.map((post) => {
          const store = findFeedStore(post.storeId);
          const available = isAvailable(post, now);
          return <li key={post.id} className="sf-card">
            <button type="button" className="sf-card-open" aria-label={post.title + ' 상세보기'} onClick={() => openPost(post)}>
              <PostVisual post={post} />
              <div className="sf-card-content"><div className="sf-byline"><span className="sf-avatar">{store?.name.slice(0, 1) ?? '가'}</span><span>{store?.name ?? '가게'}</span><span className="sf-owner-tag">사장님</span></div>
                <h3>{post.title}</h3><p className="sf-excerpt">{post.description}</p><p className="sf-schedule"><Icon name={kind === 'space-rental' ? 'pin' : 'calendar'} />{kind === 'space-rental' ? store?.address : scheduleLabel(post)}</p><div className="sf-price-row"><strong>{formatPrice(post)}</strong><span className={`sf-status ${available ? '' : 'is-closed'}`}>{available ? '모집 중' : '모집 마감'}</span></div>
              </div>
            </button>
            <div className="sf-card-footer"><span>{kind === 'space-rental' ? '최대' : '정원'} {post.capacity}명 · {store?.isMock ? '예시 글' : '사장님 글'}</span><button type="button" className={`sf-like ${likes.includes(post.id) ? 'is-liked' : ''}`} aria-label={post.title + ' 찜'} aria-pressed={likes.includes(post.id)} onClick={() => void toggleLike(post.id)}>{likes.includes(post.id) ? '♥' : '♡'}</button></div>
          </li>;
        })}
      </ul>}
    </section>
    <aside className="sf-bottom-note"><Icon name="storefront" /><div><strong>가게의 또 다른 매력을 나눠주세요.</strong><p>비어 있는 공간도, 사장님의 노하우도 이웃에게는 특별한 경험이 됩니다.</p></div>{canWrite && <button type="button" className="sf-text-btn" onClick={() => setEditing(null)}>글쓰기 →</button>}</aside>

    {active && selected && editing === undefined && <FeedDialog title={copy.label + ' 이야기'} onDismiss={() => setSelected(null)}>
      <PostVisual post={selected} />
      <div className="sf-detail"><p className="sf-eyebrow">{selectedStore?.name} · 사장님이 올린 글</p><h2>{selected.title}</h2><strong className="sf-detail-price">{formatPrice(selected)}</strong>
        <p className="sf-description">{selected.description}</p>
        <dl className="sf-facts"><div><dt>위치</dt><dd>{selectedStore?.address}</dd></div><div><dt>{kind === 'space-rental' ? '이용 가능 시간' : '수업 일시'}</dt><dd>{scheduleLabel(selected)}{selected.kind === 'oneday-class' && <small>현재 기기 시간대 기준</small>}</dd></div><div><dt>인원</dt><dd>{selected.capacity}명 {kind === 'oneday-class' ? '(전체 정원 · 잔여석은 전화 문의)' : '까지'}</dd></div><div><dt>이용 시간</dt><dd>{selected.kind === 'space-rental' ? '최소 ' + selected.minimumHours + '시간' : selected.durationMinutes + '분'}</dd></div></dl>
        {selected.notes && <section className="sf-detail-notes"><h3>오시기 전에 알아두세요</h3><p>{selected.notes}</p></section>}
        <p className="sf-notice">일정·이용 가능 여부·취소 조건은 사장님과 전화로 확인해 주세요. 이 화면에서는 예약이나 결제가 이루어지지 않습니다.</p>
        {selectedStore?.isMock ? <button type="button" className="sf-primary sf-contact" onClick={() => showToast('예시 게시글이라 실제 전화는 연결되지 않아요.')}>전화 문의 · 예시</button> : isAvailable(selected, now) ? <a className="sf-primary sf-contact" href={`tel:${selected.contactPhone.replace(/[^+\d]/g, '')}`}>전화 문의 · {selected.contactPhone}</a> : <p className="sf-notice">모집이 마감된 글입니다.</p>}
        {ownedStores.some((store) => store.id === selected.storeId) && <div className="sf-manage"><p>내 가게 게시글</p><div className="sf-actions"><button className="sf-secondary" type="button" onClick={() => setEditing(selected)}>글 수정</button><button type="button" className="sf-text-btn sf-danger" onClick={() => setDeleteConfirm(true)}>글 삭제</button></div>
          {deleteConfirm && <div className="sf-delete-confirm" role="alert"><p>이 글을 삭제할까요? 저장된 글과 사진을 되돌릴 수 없습니다.</p><button type="button" className="sf-secondary" onClick={() => setDeleteConfirm(false)} disabled={deleting}>취소</button> <button type="button" className="sf-primary" onClick={() => void remove()} disabled={deleting}>{deleting ? '삭제 중…' : '삭제 확인'}</button></div>}
        </div>}
        {detailError && <p className="sf-error" role="alert">{detailError}</p>}
      </div>
    </FeedDialog>}
    {active && canWrite && editing !== undefined && <FeedDialog title={editing ? copy.label + ' 글 수정' : copy.label + ' 글쓰기'} onDismiss={() => setEditing(undefined)}>
      <PostForm kind={kind} existing={editing ?? undefined} onCancel={() => setEditing(undefined)} onSaved={(post) => { setEditing(undefined); resetFilters(); setSort('latest'); openPost(post); void reload(); showToast('게시글을 DB에 저장했어요.'); }} />
    </FeedDialog>}
  </div>;
}
