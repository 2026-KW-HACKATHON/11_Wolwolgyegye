import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useToast } from '../../shared/toast/ToastContext';
import { redeemStampCode, type StampRedeemResult } from './ownerApi';

/**
 * 사장님 화면 > 스탬프 찍기: 손님 화면의 6자리 적립 코드를 입력하면 그 손님에게 스탬프가 찍힌다.
 * 결제 금액 기준 가게는 한 번에 여러 개를 찍을 수 있다. 코드는 한 번만 쓸 수 있고 3분 뒤 만료된다.
 */
export default function OwnerStampPanel({ storeId }: { storeId: string }) {
  const showToast = useToast();
  const [code, setCode] = useState('');
  const [count, setCount] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<StampRedeemResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) { setError('6자리 숫자 코드를 입력해 주세요.'); return; }
    setBusy(true); setError(''); setResult(null);
    try {
      const done = await redeemStampCode(storeId, digits, Number(count));
      setResult(done);
      showToast(`스탬프 ${count}개를 찍었어요`);
      setCode(''); setCount('1');
      input.current?.focus();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '스탬프를 찍지 못했어요.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="op-panel">
      <form className="op-panel-section op-form" onSubmit={submit}>
        <h3>손님 적립 코드 입력</h3>
        <p className="op-muted">손님 스탬프 화면의 6자리 번호를 입력하면 바로 스탬프가 찍혀요.</p>
        <label>적립 코드
          <input ref={input} className="op-stamp-code" inputMode="numeric" autoComplete="off" maxLength={7} required
            value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))} placeholder="000 000" aria-describedby="op-stamp-hint" />
        </label>
        <label>찍을 개수
          <input type="number" inputMode="numeric" min={1} max={100} step={1} required value={count} onChange={(e) => setCount(e.target.value)} />
        </label>
        <span id="op-stamp-hint" className="op-muted">코드는 3분 동안 한 번만 쓸 수 있어요.</span>
        {error && <p className="op-error" role="alert">{error}</p>}
        {result && (
          <p className="op-stamp-done" role="status">
            적립 완료 · 손님 잔액 {result.balance}개
            {result.balance >= result.requiredStamps ? ' (선물 교환 가능)' : ` (선물까지 ${result.requiredStamps - result.balance}개)`}
          </p>
        )}
        <button type="submit" className="op-primary" disabled={busy}>{busy ? '적립 중…' : '스탬프 찍기'}</button>
      </form>
    </div>
  );
}
