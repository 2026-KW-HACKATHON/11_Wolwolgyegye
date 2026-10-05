import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import type { Store } from '../../core/types/place';
import { useToast } from '../../shared/toast/ToastContext';
import { deleteFeedPost } from './feedSource';
import { formatPrice, isAvailable, type FeedPost } from './types';
import PostVisual from './PostVisual';

const FEED_LABELS = { 'space-rental': '공간 대여', 'oneday-class': '원데이클래스' } as const;

export function scheduleLabel(post: FeedPost) {
  return post.kind === 'space-rental' ? post.schedule : new Date(post.startsAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * 공간대여·원데이클래스 글 하나의 상세 (2차 탭 안에서 쓴다).
 * 가게 이름·주소·전화는 2차 탭 위쪽 가게 정보에 있어서 여기서는 다시 보여주지 않는다.
 * 내 가게 글이면 수정(1차 탭의 글쓰기 창으로 이동)·삭제를 할 수 있다.
 */
export default function FeedPostDetail({ post, store, now }: { post: FeedPost; store: Store | undefined; now: number }) {
  const { ownedStores } = useAuth();
  const navigate = useNavigate();
  const showToast = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const kind = post.kind;

  async function remove() {
    if (deleting) return;
    setDeleting(true); setError('');
    try { await deleteFeedPost(post.id, kind); showToast('게시글을 삭제했어요.'); }
    catch (e) { setError(e instanceof Error ? e.message : '삭제하지 못했어요.'); }
    finally { setDeleting(false); }
  }

  return <>
    <PostVisual post={post} />
    <div className="sf-detail"><p className="sf-eyebrow">{FEED_LABELS[kind]} · 사장님이 올린 글</p><h2>{post.title}</h2><strong className="sf-detail-price">{formatPrice(post)}</strong>
      <p className="sf-description">{post.description}</p>
      <dl className="sf-facts"><div><dt>{kind === 'space-rental' ? '이용 가능 시간' : '수업 일시'}</dt><dd>{scheduleLabel(post)}{post.kind === 'oneday-class' && <small>현재 기기 시간대 기준</small>}</dd></div><div><dt>인원</dt><dd>{post.capacity}명 {kind === 'oneday-class' ? '(전체 정원 · 잔여석은 전화 문의)' : '까지'}</dd></div><div><dt>이용 시간</dt><dd>{post.kind === 'space-rental' ? '최소 ' + post.minimumHours + '시간' : post.durationMinutes + '분'}</dd></div></dl>
      {post.notes && <section className="sf-detail-notes"><h3>오시기 전에 알아두세요</h3><p>{post.notes}</p></section>}
      <p className="sf-notice">일정·이용 가능 여부·취소 조건은 사장님과 전화로 확인해 주세요. 이 화면에서는 예약이나 결제가 이루어지지 않습니다.</p>
      {store?.isMock ? <button type="button" className="sf-primary sf-contact" onClick={() => showToast('예시 게시글이라 실제 전화는 연결되지 않아요.')}>전화 문의 · 예시</button> : isAvailable(post, now) ? <a className="sf-primary sf-contact" href={`tel:${post.contactPhone.replace(/[^+\d]/g, '')}`}>전화 문의 · {post.contactPhone}</a> : <p className="sf-notice">모집이 마감된 글입니다.</p>}
      {ownedStores.some((s) => s.id === post.storeId) && <div className="sf-manage"><p>내 가게 게시글</p><div className="sf-actions"><button className="sf-secondary" type="button" onClick={() => navigate(`/${kind}?edit=${encodeURIComponent(post.id)}`)}>글 수정</button><button type="button" className="sf-text-btn sf-danger" onClick={() => setDeleteConfirm(true)}>글 삭제</button></div>
        {deleteConfirm && <div className="sf-delete-confirm" role="alert"><p>이 글을 삭제할까요? 저장된 글과 사진을 되돌릴 수 없습니다.</p><button type="button" className="sf-secondary" onClick={() => setDeleteConfirm(false)} disabled={deleting}>취소</button> <button type="button" className="sf-primary" onClick={() => void remove()} disabled={deleting}>{deleting ? '삭제 중…' : '삭제 확인'}</button></div>}
      </div>}
      {error && <p className="sf-error" role="alert">{error}</p>}
    </div>
  </>;
}
