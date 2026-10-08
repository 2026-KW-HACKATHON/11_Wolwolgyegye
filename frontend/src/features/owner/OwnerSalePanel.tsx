import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useToast } from '../../shared/toast/ToastContext';
import { formatSaleDiscount } from '../closing-sale/discount';
import { hhmm } from '../closing-sale/time';
import { createSale, deleteSale, endSale, fetchOwnerSales, validateSale, type OwnerSale, type SaleDiscountType, type SaleInput } from './ownerApi';

/** Date → <input type="datetime-local"> 값 (이 기기 시간대) */
function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** 기본 세일 시간: 지금부터 오늘 21시까지 (이미 지났으면 2시간 뒤까지) */
function defaultRange() {
  const now = new Date();
  const tonight = new Date(now);
  tonight.setHours(21, 0, 0, 0);
  const end = tonight.getTime() > now.getTime() + 30 * 60_000 ? tonight : new Date(now.getTime() + 2 * 3600_000);
  return { start: localInput(now), end: localInput(end) };
}

const TYPE_LABELS: Record<SaleDiscountType, string> = { rate: '% 할인', amount: '금액 할인', free: '무료 제공' };

/**
 * 사장님 화면 > 마감세일: 진행 중·예정 세일 목록과 새 세일 등록.
 * 진행 중인 세일은 지금 종료(기록은 남김)하거나 삭제(기록까지 지움)하고, 예정 세일은 삭제한다. 삭제는 한 번 더 확인한다.
 */
export default function OwnerSalePanel({ storeId }: { storeId: string }) {
  const showToast = useToast();
  const [sales, setSales] = useState<OwnerSale[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [type, setType] = useState<SaleDiscountType>('rate');
  const [value, setValue] = useState('');
  const [offer, setOffer] = useState('');
  const [condition, setCondition] = useState('');
  const [range, setRange] = useState(defaultRange);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** 삭제 확인 중인 세일 */
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { setSales(await fetchOwnerSales(storeId)); setLoadError(''); }
    catch (e) { setLoadError(e instanceof Error ? e.message : '마감세일을 불러오지 못했어요.'); }
  }, [storeId]);
  useEffect(() => { setSales(null); void reload(); }, [reload]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const amount = Number(value);
    const input: SaleInput = {
      discountType: type,
      discountAmount: type === 'amount' ? amount : null,
      discountRate: type === 'rate' ? amount / 100 : null,
      offer, condition, startsAt: range.start, endsAt: range.end,
    };
    const problem = validateSale(input);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try {
      await createSale(storeId, input);
      showToast('마감세일을 등록했어요');
      setValue(''); setOffer(''); setCondition(''); setRange(defaultRange());
      await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '등록하지 못했어요.'); }
    finally { setBusy(false); }
  }

  async function act(sale: OwnerSale, action: 'end' | 'delete') {
    setConfirmId(null);
    try {
      if (action === 'end') { await endSale(sale.id); showToast('세일을 종료했어요'); }
      else { await deleteSale(sale.id); showToast('세일을 삭제했어요'); }
      await reload();
    } catch (cause) { showToast(cause instanceof Error ? cause.message : '처리하지 못했어요.'); }
  }

  const now = Date.now();
  return (
    <div className="op-panel">
      <section className="op-panel-section" aria-label="진행 중·예정 세일">
        <h3>진행 중·예정 세일</h3>
        {loadError && <p className="op-error" role="alert">{loadError}</p>}
        {!loadError && sales === null && <p className="op-muted">불러오는 중…</p>}
        {sales?.length === 0 && <p className="op-muted">진행 중인 세일이 없어요.</p>}
        {!!sales?.length && (
          <ul className="op-list">
            {sales.map((sale) => {
              const started = Date.parse(sale.startsAt) <= now;
              return (
                <li key={sale.id} className="op-list-row">
                  <div>
                    <strong>{formatSaleDiscount(sale)}{sale.discountType === 'free' ? ' 제공' : ' 할인'}</strong>
                    <span className="op-muted">{started ? '진행 중' : '예정'} · {hhmm(sale.startsAt)} ~ {hhmm(sale.endsAt)}</span>
                    {(sale.offer || sale.condition) && <span className="op-muted">{[sale.offer, sale.condition].filter(Boolean).join(' · ')}</span>}
                  </div>
                  {confirmId === sale.id ? (
                    <span className="op-row-actions">
                      <button type="button" className="op-text-btn" onClick={() => setConfirmId(null)}>취소</button>
                      <button type="button" className="op-text-btn is-danger" onClick={() => void act(sale, 'delete')}>정말 삭제</button>
                    </span>
                  ) : (
                    <span className="op-row-actions">
                      {started && <button type="button" className="op-text-btn" onClick={() => void act(sale, 'end')}>지금 종료</button>}
                      <button type="button" className="op-text-btn is-danger" onClick={() => setConfirmId(sale.id)}>삭제</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form className="op-panel-section op-form" onSubmit={submit}>
        <h3>새 세일 등록</h3>
        <div className="op-segment" role="radiogroup" aria-label="할인 방식">
          {(Object.keys(TYPE_LABELS) as SaleDiscountType[]).map((key) => (
            <button key={key} type="button" role="radio" aria-checked={type === key} className={type === key ? 'is-on' : ''} onClick={() => { setType(key); setValue(''); }}>
              {TYPE_LABELS[key]}
            </button>
          ))}
        </div>
        {type !== 'free' && (
          <label>{type === 'rate' ? '할인율 (%)' : '할인 금액 (원)'}
            <input type="number" required inputMode="numeric" min={1} max={type === 'rate' ? 100 : 10_000_000} step={1} value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'rate' ? '30' : '2000'} />
          </label>
        )}
        <label>{type === 'free' ? '제공 내용' : '할인 대상 (선택)'}
          <input required={type === 'free'} maxLength={500} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder={type === 'free' ? '빵 2개 사면 1개 무료' : '오늘 구운 빵 전 품목'} />
        </label>
        <label>조건 (선택)
          <input maxLength={500} value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="포장 주문만" />
        </label>
        <div className="op-form-grid">
          <label>시작<input type="datetime-local" required value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /></label>
          <label>끝<input type="datetime-local" required value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} /></label>
        </div>
        {error && <p className="op-error" role="alert">{error}</p>}
        <button type="submit" className="op-primary" disabled={busy}>{busy ? '등록 중…' : '세일 등록'}</button>
      </form>
    </div>
  );
}
