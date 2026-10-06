import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../shared/Icon';
import { addPostImages, saveFeedPost, validatePost } from '../../store-feed/feedSource';
import { FEED_CATEGORIES, type PostInput } from '../../store-feed/types';
import ComposeShell from './ComposeShell';
import { Card, ChoiceChips, DoneStep, Field, FormError, IMAGE_RULE, PhotoAdd, PhotoThumb, readImage, Stepper, WonInput } from './parts';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const MAX_PHOTOS = 5;

interface Slot { id: number; day: number; start: string; end: string }

/** 요일별 시간 → DB available_hours 한 줄 (예: 화 14:00–17:00, 목 10:00–12:00) */
function scheduleText(slots: Slot[]): string {
  return [...slots].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
    .map((slot) => `${DAYS[slot.day]} ${slot.start}–${slot.end}`).join(', ');
}

let nextSlotId = 1;

/**
 * 공간 대여 등록 (3단계)
 * 1. 사진 · 기본 정보 · 대여 가능 시간  2. 가격 · 인원 · 한 줄 요약  3. 완료
 */
export default function SpaceCompose({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [price, setPrice] = useState<number | null>(null);
  const [capacity, setCapacity] = useState(6);
  const [minimumHours, setMinimumHours] = useState(1);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState('');

  const selectedDays = new Set(slots.map((slot) => slot.day));

  function toggleDay(day: number) {
    setSlots((prev) => (prev.some((s) => s.day === day)
      ? prev.filter((s) => s.day !== day)
      : [...prev, { id: nextSlotId++, day, start: '10:00', end: '18:00' }]));
  }

  function addSlot() {
    const last = slots[slots.length - 1];
    setSlots([...slots, { id: nextSlotId++, day: last?.day ?? 0, start: last?.end ?? '10:00', end: last ? '' : '18:00' }]);
  }

  const updateSlot = (id: number, patch: Partial<Slot>) => setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  async function addPhoto(file: File) {
    try { const url = await readImage(file); setPhotos((prev) => [...prev, url].slice(0, MAX_PHOTOS)); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '사진을 읽지 못했어요.'); }
  }

  function input(): PostInput {
    return {
      kind: 'space-rental', storeId, title: title.trim(), description: description.trim(), category,
      price: price ?? 0, capacity, imageUrl: photos[0] ?? '', summary: summary.trim(), status: 'open',
      schedule: scheduleText(slots), minimumHours,
    };
  }

  function checkStep1(): string | null {
    if (!title.trim()) return '공간 이름을 입력해 주세요.';
    if (!category) return '공간 유형을 골라 주세요.';
    if (!description.trim()) return '공간 소개를 입력해 주세요.';
    if (slots.length === 0) return '대여 가능한 요일을 하나 이상 골라 주세요.';
    if (slots.some((s) => !s.start || !s.end || s.start >= s.end)) return '끝나는 시각은 시작 시각보다 뒤여야 해요.';
    if (scheduleText(slots).length > 200) return '대여 가능 시간이 너무 많아요. 시간대를 줄여 주세요.';
    return null;
  }

  async function next() {
    if (step === 1) {
      const problem = checkStep1();
      if (problem) { setError(problem); return; }
      setError(''); setStep(2);
      return;
    }
    if (price === null) { setError('시간당 가격을 입력해 주세요. 무료면 0원을 입력해 주세요.'); return; }
    if (!summary.trim()) { setError('목록에 보일 한 줄 요약을 입력해 주세요.'); return; }
    const data = input();
    const problem = validatePost(data);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try {
      const post = await saveFeedPost(data);
      await addPostImages(post, photos.slice(1));
      setSavedId(post.id); setStep(3);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  const back = () => { if (step === 2) { setError(''); setStep(1); } else onClose(); };

  return (
    <ComposeShell title="공간 대여 등록" step={step} total={3} onBack={back} busy={busy} onSubmit={() => void next()}
      submitLabel={step === 1 ? '다음' : step === 2 ? '등록하기' : undefined}>
      {step === 1 && <>
        <Card title="공간 사진">
          <div className="ow-photos">
            {photos.map((src, i) => (
              <PhotoThumb key={i} src={src} alt={i === 0 ? '대표 사진' : `공간 사진 ${i + 1}`} onRemove={() => setPhotos(photos.filter((_, j) => j !== i))} />
            ))}
            {photos.length < MAX_PHOTOS && <PhotoAdd label="사진 추가" onPick={(file) => void addPhoto(file)} />}
          </div>
          <p className="ow-hint">첫 사진이 대표 사진이 돼요. 최대 {MAX_PHOTOS}장, {IMAGE_RULE}.</p>
        </Card>

        <Card title="기본 정보">
          <Field label="공간 이름" required htmlFor="sp-title">
            <input id="sp-title" className="ow-input" maxLength={70} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 햇살 가득한 작은 모임방" />
          </Field>
          <Field label="공간 유형" required>
            <ChoiceChips label="공간 유형" options={FEED_CATEGORIES['space-rental']} value={category} onChange={setCategory} />
          </Field>
          <Field label="소개" required htmlFor="sp-desc">
            <textarea id="sp-desc" className="ow-input" rows={4} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="공간을 소개해 주세요. (시설, 포함 사항, 주의할 점 등)" />
          </Field>
        </Card>

        <Card title="대여 가능 시간">
          <Field label="요일 선택" required>
            <div className="ow-days" role="group" aria-label="대여 가능 요일">
              {DAYS.map((day, i) => (
                <button key={day} type="button" aria-pressed={selectedDays.has(i)} onClick={() => toggleDay(i)}>{day}</button>
              ))}
            </div>
          </Field>
          {slots.length > 0 && (
            <Field label="시간 설정" required>
              <ul className="ow-slots">
                {[...slots].sort((a, b) => a.day - b.day).map((slot) => (
                  <li key={slot.id} className="ow-slot">
                    <select aria-label="요일" value={slot.day} onChange={(e) => updateSlot(slot.id, { day: Number(e.target.value) })}>
                      {DAYS.map((day, i) => <option key={day} value={i}>{day}요일</option>)}
                    </select>
                    <span className="ow-time-range">
                      <input type="time" aria-label={`${DAYS[slot.day]}요일 시작 시각`} value={slot.start} onChange={(e) => updateSlot(slot.id, { start: e.target.value })} />
                      <span aria-hidden="true">–</span>
                      <input type="time" aria-label={`${DAYS[slot.day]}요일 끝 시각`} value={slot.end} onChange={(e) => updateSlot(slot.id, { end: e.target.value })} />
                    </span>
                    <button type="button" className="ow-icon-btn" aria-label={`${DAYS[slot.day]}요일 ${slot.start}–${slot.end} 지우기`} onClick={() => setSlots(slots.filter((s) => s.id !== slot.id))}>
                      <Icon name="trash" />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="ow-dashed" onClick={addSlot}><Icon name="plus" /> 시간 추가</button>
            </Field>
          )}
        </Card>
      </>}

      {step === 2 && <>
        <Card title="이용 조건">
          <Field label="시간당 가격" required htmlFor="sp-price">
            <WonInput id="sp-price" value={price} onChange={setPrice} placeholder="예: 15,000" />
          </Field>
          <div className="ow-grid-2">
            <Field label="최대 인원" required>
              <Stepper label="최대 인원" value={capacity} onChange={setCapacity} min={1} max={1000} unit="명" />
            </Field>
            <Field label="최소 이용 시간" required>
              <Stepper label="최소 이용 시간" value={minimumHours} onChange={setMinimumHours} min={1} max={24} unit="시간" />
            </Field>
          </div>
        </Card>
        <Card title="목록에 보일 소개">
          <Field label="한 줄 요약" required htmlFor="sp-summary" hint={`공간 대여 목록 카드에 보여요. ${summary.length} / 200자`}>
            <input id="sp-summary" className="ow-input" maxLength={200} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="예: 조명·음향 갖춘 12인 파티룸" />
          </Field>
        </Card>
        <Card title="확인">
          <dl className="ow-review">
            <div><dt>공간</dt><dd>{title} · {category}</dd></div>
            <div><dt>대여 시간</dt><dd>{scheduleText(slots)}</dd></div>
            <div><dt>사진</dt><dd>{photos.length ? `${photos.length}장` : '없음 (기본 그림으로 보여요)'}</dd></div>
          </dl>
        </Card>
      </>}

      {step === 3 && (
        <DoneStep icon="house" title="공간 대여를 등록했어요" desc="이웃들이 공간 대여 목록과 지도에서 바로 볼 수 있어요."
          actions={[
            { label: '등록한 글 보기', onClick: () => navigate(`/space-rental?post=${savedId}`) },
            { label: '사장님 센터로', onClick: onClose, primary: true },
          ]} />
      )}

      <FormError message={error} />
    </ComposeShell>
  );
}
