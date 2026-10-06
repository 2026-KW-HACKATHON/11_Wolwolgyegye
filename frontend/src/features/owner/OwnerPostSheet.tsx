import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sheet from '../../shared/sheet/Sheet';
import { useToast } from '../../shared/toast/ToastContext';
import { cancelOwnerPost, type OwnerNews } from './ownerApi';

const MAX_REASON = 500;
const dateTime = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * 사장님 센터 > 운영 중인 소식 > 공간대여·클래스 카드.
 * 글 정보와 지금까지 신청한 인원을 보여 주고, 글 수정 / 등록 취소(사유 필수)를 할 수 있다.
 */
export default function OwnerPostSheet({ item, onClose, onCancelled }: { item: OwnerNews | null; onClose: () => void; onCancelled: () => void }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const reasonId = useId();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 다른 카드를 열면 취소 입력을 처음 상태로
  useEffect(() => { setCancelling(false); setReason(''); setError(''); }, [item?.id]);

  const post = item?.post;
  if (!item || !post || (item.kind !== 'space-rental' && item.kind !== 'oneday-class')) {
    return <Sheet open={false} title="" onClose={onClose}>{null}</Sheet>;
  }
  const kind = item.kind;
  const isClass = kind === 'oneday-class';
  const cancelled = !!post.cancelledAt;
  const ended = item.status.tone === 'off' && !cancelled;

  async function confirmCancel() {
    if (busy) return;
    if (!reason.trim()) { setError('취소 사유를 적어 주세요.'); return; }
    setBusy(true); setError('');
    try {
      await cancelOwnerPost(kind, item!.id, reason);
      showToast('등록을 취소했어요');
      onCancelled();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '등록을 취소하지 못했어요.'); }
    finally { setBusy(false); }
  }

  return (
    <Sheet open title={item.title} onClose={onClose}>
      <div className="op-panel">
        <p className="opd-status">
          <span className="oc-tag">{isClass ? '원데이 클래스' : '공간 대여'}</span>
          <span className="oc-status" data-tone={item.status.tone}>{item.status.label}</span>
        </p>

        {/* 신청 인원 */}
        <section className="opd-applied" aria-label="신청 인원">
          {post.applied !== null ? <>
            <p className="opd-applied-num"><strong>{post.applied}명</strong> 신청 <span>/ 정원 {post.capacity}명</span></p>
            <div className="opd-bar" role="progressbar" aria-label="신청 인원" aria-valuemin={0} aria-valuemax={post.capacity} aria-valuenow={post.applied}>
              <span style={{ width: `${Math.min(100, (post.applied / post.capacity) * 100)}%` }} />
            </div>
            <p className="op-muted">{post.applied >= post.capacity ? '정원이 다 찼어요.' : `${post.capacity - post.applied}자리 남았어요.`}</p>
          </> : <>
            <p className="opd-applied-num"><strong>신청 인원 —</strong></p>
            <p className="op-muted">공간 대여는 아직 앱에서 예약을 받지 않아 신청 인원을 셀 수 없어요. 손님은 가게 전화로 문의해요.</p>
          </>}
        </section>

        <dl className="opd-info">
          <div><dt>분류</dt><dd>{post.category || '—'}</dd></div>
          <div><dt>{isClass ? '일정' : '대여 시간'}</dt><dd>{item.when}</dd></div>
          <div><dt>{isClass ? '참가비' : '가격'}</dt><dd>{post.price.toLocaleString('ko-KR')}원 {isClass ? '/ 1인' : '/ 시간'}</dd></div>
          <div><dt>{isClass ? '정원' : '최대 인원'}</dt><dd>{post.capacity}명</dd></div>
          {post.minHours !== null && <div><dt>최소 이용</dt><dd>{post.minHours}시간</dd></div>}
          {post.summary && <div><dt>한 줄 요약</dt><dd>{post.summary}</dd></div>}
          {item.createdAt && <div><dt>등록일</dt><dd>{dateTime.format(new Date(item.createdAt))}</dd></div>}
        </dl>

        {cancelled && (
          <section className="opd-cancelled" aria-label="등록 취소 내용">
            <strong>{post.cancelledAt ? `${dateTime.format(new Date(post.cancelledAt))}에 등록을 취소했어요` : '등록을 취소했어요'}</strong>
            <p>사유: {post.cancelReason}</p>
          </section>
        )}

        {!cancelled && !cancelling && (
          <div className="opd-actions">
            {!ended && <button type="button" className="op-secondary" onClick={() => navigate(`/${kind}?edit=${item.id}`)}>글 수정</button>}
            <button type="button" className="opd-danger" onClick={() => setCancelling(true)}>등록 취소</button>
          </div>
        )}

        {!cancelled && cancelling && (
          <section className="opd-cancel" aria-label="등록 취소">
            <label htmlFor={reasonId}>취소 사유<span className="opd-req" aria-label="필수">*</span></label>
            <textarea
              id={reasonId}
              rows={3}
              maxLength={MAX_REASON}
              autoFocus
              value={reason}
              aria-invalid={!!error || undefined}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isClass ? '예: 재료 수급 문제로 이번 수업을 열 수 없게 되었어요.' : '예: 내부 공사로 당분간 공간을 빌려드릴 수 없어요.'}
            />
            <p className="op-muted">{reason.length} / {MAX_REASON}자 · 취소하면 손님 목록에서 바로 사라지고, 되돌릴 수 없어요.</p>
            {isClass && !!post.applied && (
              <p className="opd-warn">이미 {post.applied}명이 신청했어요. 앱이 손님에게 알려 주지 않으니, 신청한 분들께 직접 연락해 주세요.</p>
            )}
            {error && <p className="op-error" role="alert">{error}</p>}
            <div className="opd-actions">
              <button type="button" className="op-secondary" disabled={busy} onClick={() => { setCancelling(false); setError(''); }}>돌아가기</button>
              <button type="button" className="opd-danger is-solid" disabled={busy} onClick={() => void confirmCancel()}>{busy ? '취소하는 중…' : '등록 취소하기'}</button>
            </div>
          </section>
        )}
      </div>
    </Sheet>
  );
}
