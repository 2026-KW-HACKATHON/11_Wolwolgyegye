import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../shared/Icon';
import { saveFeedPost, validatePost } from '../../store-feed/feedSource';
import { FEED_CATEGORIES, type PostInput } from '../../store-feed/types';
import ComposeShell from './ComposeShell';
import { Card, ChoiceChips, DoneStep, Field, FormError, IMAGE_RULE, PhotoAdd, PhotoThumb, readImage, Stepper, WonInput } from './parts';

/** 오늘 날짜 (이 기기 시간대, YYYY-MM-DD) */
function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const dateLabel = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

/**
 * 원데이 클래스 등록 (3단계)
 * 1. 대표 사진 · 클래스 정보 · 일정 · 안내  2. 한 줄 요약 · 확인  3. 완료
 */
export default function ClassCompose({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [photo, setPhoto] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [capacity, setCapacity] = useState(6);
  const [date, setDate] = useState('');
  const [start, setStart] = useState('14:00');
  const [end, setEnd] = useState('16:00');
  const [description, setDescription] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState('');

  async function pickPhoto(file: File) {
    try { setPhoto(await readImage(file)); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '사진을 읽지 못했어요.'); }
  }

  const startsAt = date && start ? new Date(`${date}T${start}`) : null;
  const duration = start && end ? toMinutes(end) - toMinutes(start) : 0;

  function input(): PostInput {
    return {
      kind: 'oneday-class', storeId, title: title.trim(), description: description.trim(), category,
      price: price ?? 0, capacity, imageUrl: photo, summary: summary.trim(), status: 'open',
      startsAt: startsAt ? startsAt.toISOString() : '', durationMinutes: duration,
    };
  }

  function checkStep1(): string | null {
    if (!title.trim()) return '클래스 이름을 입력해 주세요.';
    if (!category) return '카테고리를 골라 주세요.';
    if (price === null) return '참가비를 입력해 주세요. 무료면 0원을 입력해 주세요.';
    if (!startsAt || !Number.isFinite(startsAt.getTime())) return '수업 날짜를 골라 주세요.';
    if (startsAt.getTime() <= Date.now()) return '수업 시작은 지금 이후로 골라 주세요.';
    if (duration < 15) return '끝나는 시각은 시작보다 15분 이상 뒤여야 해요.';
    if (!description.trim()) return '참가자에게 안내할 내용을 입력해 주세요.';
    return null;
  }

  async function next() {
    if (step === 1) {
      const problem = checkStep1();
      if (problem) { setError(problem); return; }
      setError(''); setStep(2);
      return;
    }
    if (!summary.trim()) { setError('목록에 보일 한 줄 요약을 입력해 주세요.'); return; }
    const data = input();
    const problem = validatePost(data);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try { setSavedId((await saveFeedPost(data)).id); setStep(3); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  const back = () => { if (step === 2) { setError(''); setStep(1); } else onClose(); };

  return (
    <ComposeShell title="원데이 클래스 등록" step={step} total={3} onBack={back} busy={busy} onSubmit={() => void next()}
      submitLabel={step === 1 ? '다음' : step === 2 ? '등록하기' : undefined}>
      {step === 1 && <>
        {photo
          ? <div className="ow-cover"><PhotoThumb src={photo} alt="대표 사진" onRemove={() => setPhoto('')} /></div>
          : <PhotoAdd size="wide" label="대표 사진 추가" onPick={(file) => void pickPhoto(file)} />}
        <p className="ow-hint ow-hint--outside">{IMAGE_RULE}. 없으면 카테고리 기본 그림으로 보여요.</p>

        <Card title="클래스 정보">
          <Field label="클래스 이름" required htmlFor="cl-title">
            <input id="cl-title" className="ow-input" maxLength={70} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 나만의 향초 만들기" />
          </Field>
          <Field label="카테고리" required>
            <ChoiceChips label="카테고리" options={FEED_CATEGORIES['oneday-class']} value={category} onChange={setCategory} />
          </Field>
          <div className="ow-grid-2">
            <Field label="참가비" required htmlFor="cl-price">
              <WonInput id="cl-price" value={price} onChange={setPrice} placeholder="35,000" />
            </Field>
            <Field label="정원" required>
              <Stepper label="정원" value={capacity} onChange={setCapacity} min={1} max={1000} unit="명" />
            </Field>
          </div>
        </Card>

        <Card title="일정">
          <Field label="날짜 선택" required htmlFor="cl-date">
            <span className="ow-addon">
              <Icon name="calendar" />
              <input id="cl-date" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
            </span>
          </Field>
          <Field label="시간 설정" required>
            <span className="ow-addon">
              <Icon name="clock" />
              <span className="ow-time-range">
                <input type="time" aria-label="시작 시각" value={start} onChange={(e) => setStart(e.target.value)} />
                <span aria-hidden="true">–</span>
                <input type="time" aria-label="끝 시각" value={end} onChange={(e) => setEnd(e.target.value)} />
              </span>
            </span>
          </Field>
        </Card>

        <Card title="참가자에게 안내할 내용">
          <Field label="안내 내용" required htmlFor="cl-desc">
            <textarea id="cl-desc" className="ow-input" rows={4} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="준비물, 주의사항 등 참가자에게 안내할 내용을 입력해 주세요." />
          </Field>
        </Card>
      </>}

      {step === 2 && <>
        <Card title="목록에 보일 소개">
          <Field label="한 줄 요약" required htmlFor="cl-summary" hint={`원데이클래스 목록 카드에 보여요. ${summary.length} / 200자`}>
            <input id="cl-summary" className="ow-input" maxLength={200} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="예: 반죽부터 굽기까지, 빵 2개를 가져가요" />
          </Field>
        </Card>
        <Card title="확인">
          <dl className="ow-review">
            <div><dt>클래스</dt><dd>{title} · {category}</dd></div>
            <div><dt>일정</dt><dd>{startsAt ? `${dateLabel.format(startsAt)} ${start} – ${end}` : ''}</dd></div>
            <div><dt>참가비</dt><dd>{(price ?? 0).toLocaleString('ko-KR')}원 / 1인 · 정원 {capacity}명</dd></div>
          </dl>
        </Card>
      </>}

      {step === 3 && (
        <DoneStep icon="palette" title="원데이 클래스를 등록했어요" desc="이웃들이 원데이클래스 목록과 지도에서 바로 볼 수 있어요."
          actions={[
            { label: '등록한 글 보기', onClick: () => navigate(`/oneday-class?post=${savedId}`) },
            { label: '가게 관리로', onClick: onClose, primary: true },
          ]} />
      )}

      <FormError message={error} />
    </ComposeShell>
  );
}
