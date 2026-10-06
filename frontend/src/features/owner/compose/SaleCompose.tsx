import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../shared/Icon';
import { createSale, validateSale, type SaleInput } from '../ownerApi';
import ComposeShell from './ComposeShell';
import { Card, DoneStep, Field, FormError, Stepper, Toggle, WonInput } from './parts';

/** 기본 마감 시각: 오늘 21시 (이미 지났거나 30분도 안 남았으면 2시간 뒤) */
function defaultEnd(): string {
  const now = new Date();
  const tonight = new Date(now);
  tonight.setHours(21, 0, 0, 0);
  const end = tonight.getTime() > now.getTime() + 30 * 60_000 ? tonight : new Date(now.getTime() + 2 * 3600_000);
  return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
}

/** 마감 시각(HH:MM) → 오늘 그 시각. 자정을 넘기는 값(지금보다 이른 시각)이면 내일로 */
function endDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
  return date;
}

/**
 * 마감세일 등록 (2단계)  1. 상품 정보 · 판매 조건  2. 완료
 * DB closing_sales 에는 할인 금액(정가 − 할인가)으로 저장하고, 정가·할인가·수량·방문 조건·안내는 조건(condition) 한 줄에 함께 적는다.
 */
export default function SaleCompose({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [regular, setRegular] = useState<number | null>(null);
  const [salePrice, setSalePrice] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(5);
  const [end, setEnd] = useState(defaultEnd);
  const [visitOnly, setVisitOnly] = useState(true);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const percent = regular && salePrice !== null && salePrice < regular ? Math.round((1 - salePrice / regular) * 100) : null;
  const ends = end ? endDate(end) : null;
  const tomorrow = ends ? ends.toDateString() !== new Date().toDateString() : false;

  async function submit() {
    if (!name.trim()) { setError('상품명을 입력해 주세요.'); return; }
    if (!regular) { setError('정가를 입력해 주세요.'); return; }
    if (salePrice === null) { setError('할인가를 입력해 주세요. 무료로 드리면 0원을 입력해 주세요.'); return; }
    if (salePrice >= regular) { setError('할인가는 정가보다 낮아야 해요.'); return; }
    if (!ends) { setError('마감 시간을 골라 주세요.'); return; }
    const condition = [
      `정가 ${regular.toLocaleString('ko-KR')}원 → ${salePrice.toLocaleString('ko-KR')}원`,
      `${quantity}개 한정`,
      visitOnly && '매장 방문 구매만',
      note.trim(),
    ].filter(Boolean).join(' · ');
    const input: SaleInput = {
      discountType: salePrice === 0 ? 'free' : 'amount',
      discountAmount: salePrice === 0 ? null : regular - salePrice,
      discountRate: null,
      offer: name.trim(),
      condition,
      startsAt: new Date().toISOString(),
      endsAt: ends.toISOString(),
    };
    const problem = validateSale(input);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try { await createSale(storeId, input); setStep(2); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '등록하지 못했어요. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  return (
    <ComposeShell title="마감세일 등록" step={step} total={2} onBack={onClose} busy={busy} onSubmit={() => void submit()}
      submitLabel={step === 1 ? '마감세일 등록하기' : undefined}>
      {step === 1 && <>
        <div className="ow-banner is-strong">
          <span className="ow-banner-icon" aria-hidden="true"><Icon name="bolt" /></span>
          <div>
            <strong>오늘 안에 판매할 상품을 등록해보세요</strong>
            <p>지금 바로 올리면, 우리 동네 고객에게 특별한 가격으로 소개돼요.</p>
          </div>
        </div>

        <Card title="상품 정보">
          <Field label="상품명" required htmlFor="sa-name">
            <input id="sa-name" className="ow-input" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 갓 구운 소금빵 4개입" />
          </Field>
          <div className="ow-grid-2">
            <Field label="정가" required htmlFor="sa-regular">
              <WonInput id="sa-regular" value={regular} onChange={setRegular} placeholder="8,000" />
            </Field>
            <Field label="할인가" required htmlFor="sa-price">
              <WonInput id="sa-price" value={salePrice} onChange={setSalePrice} placeholder="5,000" invalid={regular !== null && salePrice !== null && salePrice >= regular} />
            </Field>
          </div>
          {percent !== null && <p className="ow-badge" aria-live="polite">{percent === 100 ? '무료 제공' : `${percent}% 할인`}</p>}
        </Card>

        <Card title="판매 조건">
          <Field label="판매 수량" required>
            <div className="ow-narrow"><Stepper label="판매 수량" value={quantity} onChange={setQuantity} min={1} max={999} unit="개" /></div>
          </Field>
          <Field label="마감 시간" required htmlFor="sa-end" hint={tomorrow ? '지금보다 이른 시각이라 내일 그 시각까지로 등록돼요.' : undefined}>
            <span className="ow-addon">
              <Icon name="clock" />
              <span className="ow-addon-prefix">{tomorrow ? '내일' : '오늘'}</span>
              <input id="sa-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </span>
          </Field>
          <Toggle icon="storefront" label="매장 방문만 가능" desc="온라인 결제 없이, 매장에 직접 방문한 고객만 구매할 수 있어요." checked={visitOnly} onChange={setVisitOnly} />
          <Field label="구매자 안내" htmlFor="sa-note">
            <textarea id="sa-note" className="ow-input" rows={3} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="구매 시 참고할 내용을 입력해 주세요." />
          </Field>
        </Card>
      </>}

      {step === 2 && (
        <DoneStep icon="bolt" title="마감세일을 등록했어요" desc={`${name} · ${ends ? `${tomorrow ? '내일' : '오늘'} ${end}` : ''}까지 이웃들에게 보여요.`}
          actions={[
            { label: '마감세일 보기', onClick: () => navigate('/closing-sale') },
            { label: '사장님 센터로', onClick: onClose, primary: true },
          ]} />
      )}

      <FormError message={error} />
    </ComposeShell>
  );
}
