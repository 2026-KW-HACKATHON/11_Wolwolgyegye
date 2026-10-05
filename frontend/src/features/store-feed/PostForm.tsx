import { useEffect, useState, type FormEvent } from 'react';
import type { Store } from '../../core/types/place';
import { fetchFeedStores, saveFeedPost, validatePost } from './feedSource';
import { FEED_CATEGORIES, type FeedKind, type FeedPost, type PostInput } from './types';

function localDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function PostForm({ kind, existing, onSaved, onCancel }: {
  kind: FeedKind; existing?: FeedPost; onSaved: (post: FeedPost) => void; onCancel: () => void;
}) {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState(existing?.storeId ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState(existing?.category ?? FEED_CATEGORIES[kind][0]);
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [capacity, setCapacity] = useState(existing ? String(existing.capacity) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [status, setStatus] = useState(existing?.status ?? 'open');
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? '');
  const [schedule, setSchedule] = useState(existing?.kind === 'space-rental' ? existing.schedule : '');
  const [minimumHours, setMinimumHours] = useState(existing?.kind === 'space-rental' ? String(existing.minimumHours ?? '') : '1');
  const [startsAt, setStartsAt] = useState(existing?.kind === 'oneday-class' ? localDateTime(existing.startsAt) : '');
  const [durationMinutes, setDurationMinutes] = useState(existing?.kind === 'oneday-class' ? String(existing.durationMinutes) : '90');
  const [busy, setBusy] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchFeedStores()
      .then((list) => {
        if (cancelled) return;
        setStores(list);
        setStoreId((current) => current || list[0]?.id || '');
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : '가게를 불러오지 못했어요.'); });
    return () => { cancelled = true; };
  }, []);

  function uploadImage(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      setError('사진은 1MB 이하의 JPG, PNG, WebP 파일을 선택해 주세요.'); return;
    }
    setReadingImage(true); setError('');
    const reader = new FileReader();
    reader.onload = () => { setImageUrl(String(reader.result)); setReadingImage(false); };
    reader.onerror = () => { setError('사진을 읽지 못했어요. 다른 파일을 선택해 주세요.'); setReadingImage(false); };
    reader.readAsDataURL(file);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || readingImage) return;
    if (!price.trim() || !capacity.trim()) { setError('가격과 인원을 입력해 주세요.'); return; }
    const common = { storeId, title: title.trim(), description: description.trim(), category, price: Number(price), capacity: Number(capacity), imageUrl, notes: notes.trim(), status };
    const parsed = startsAt ? new Date(startsAt) : null;
    const input: PostInput = kind === 'space-rental'
      ? { ...common, kind, schedule: schedule.trim(), minimumHours: minimumHours.trim() ? Number(minimumHours) : null }
      : { ...common, kind, startsAt: parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : '', durationMinutes: Number(durationMinutes) };
    const validation = validatePost(input);
    if (validation) { setError(validation); return; }
    setError(''); setBusy(true);
    try { onSaved(await saveFeedPost(input, existing?.id)); }
    catch (e) { setError(e instanceof Error ? e.message : '저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  return (
    <form className="sf-form" onSubmit={submit}>
      <div className="sf-form-grid">
        <label>가게<select value={storeId} onChange={(e) => setStoreId(e.target.value)} required>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>분류<select value={category} onChange={(e) => setCategory(e.target.value)}>{FEED_CATEGORIES[kind].map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      <label>게시글 제목<input autoFocus required maxLength={70} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'space-rental' ? '우리끼리 보내는 특별한 시간' : '사장님과 함께하는 첫 도전'} /></label>
      <label>소개<textarea required rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="어떤 경험을 할 수 있는지 이웃에게 알려주세요." /></label>
      <label>대표 사진 (선택)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={readingImage} onChange={(e) => uploadImage(e.target.files?.[0])} /><small>JPG · PNG · WebP / 최대 1MB. 직접 사용 권한이 있는 사진을 올려주세요.</small></label>
      {imageUrl && <div className="sf-image-preview"><img src={imageUrl} alt="등록할 대표 사진 미리보기" /><button type="button" className="sf-text-btn" onClick={() => setImageUrl('')}>사진 제거</button></div>}
      <div className="sf-form-grid">
        <label>{kind === 'space-rental' ? '시간당 가격 (원)' : '1인 참가비 (원)'}<input type="number" required min={0} max={10000000} step={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" /></label>
        <label>{kind === 'space-rental' ? '최대 이용 인원' : '수업 정원'}<input type="number" required min={1} max={1000} step={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="4" /></label>
      </div>
      {kind === 'space-rental' ? <div className="sf-form-grid">
        <label>이용 가능 시간<input required maxLength={200} value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="월요일 10:00–18:00, 전화 협의" /></label>
        <label>최소 이용 시간 (선택)<input type="number" min={1} max={24} step={1} value={minimumHours} onChange={(e) => setMinimumHours(e.target.value)} /></label>
      </div> : <div className="sf-form-grid">
        <label>수업 시작 (현재 기기 시간 기준)<input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
        <label>수업 시간 (분)<input type="number" required min={15} max={1440} step={1} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} /></label>
      </div>}
      <label>이용 안내 / 포함 사항<textarea rows={3} maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="제공되는 시설, 재료비 포함 여부, 준비물 등을 알려주세요." /><small>{notes.length} / 200자</small></label>
      <div className="sf-form-grid">
        <label>문의 전화<input value={stores.find((s) => s.id === storeId)?.phone || '가게 전화번호 미등록'} readOnly disabled /><small>가게 전화번호로 안내돼요.</small></label>
        <label>모집 상태<select value={status} onChange={(e) => setStatus(e.target.value as 'open' | 'closed')}><option value="open">모집 중</option><option value="closed">모집 마감</option></select></label>
      </div>
      {error && <p role="alert" className="sf-error">{error}</p>}
      <div className="sf-actions"><button type="button" className="sf-secondary" onClick={onCancel} disabled={busy}>취소</button><button className="sf-primary" type="submit" disabled={busy || readingImage || stores.length === 0}>{readingImage ? '사진 읽는 중…' : busy ? '저장 중…' : existing ? '수정 저장' : '글 등록'}</button></div>
    </form>
  );
}
