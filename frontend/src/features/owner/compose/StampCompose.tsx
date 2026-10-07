import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../shared/Icon';
import { fetchOwnerStampPolicy, saveStampPolicy, validateStampPolicy } from '../ownerApi';
import ComposeShell from './ComposeShell';
import { Card, ChoiceChips, DoneStep, Field, FormError, Stepper, WonInput } from './parts';

const BASES = ['1회 방문', '결제 금액'] as const;
type Basis = (typeof BASES)[number];
const VALIDITY = [{ months: 6, label: '발급일로부터 6개월' }, { months: 12, label: '발급일로부터 12개월' }, { months: 24, label: '발급일로부터 24개월' }, { months: 0, label: '기간 제한 없음' }];
/** 스탬프 줄 그림은 이 개수까지만 그린다 (넘으면 글자로만) */
const MAX_DOTS = 20;

/** 적립 기준 → DB unit */
const unitText = (basis: Basis, amount: number | null) => (basis === '1회 방문' ? '1회 방문' : `${(amount ?? 0).toLocaleString('ko-KR')}원 결제`);

/**
 * 스탬프 혜택 등록·수정 (2단계)  1. 적립 설정 · 완성 혜택  2. 완료
 * 가게당 규칙이 하나라서 이미 있으면 그 값을 채워서 고치기로 연다. 유효 기간은 조건(condition)에 적는다.
 */
export default function StampCompose({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [exists, setExists] = useState(false);
  const [basis, setBasis] = useState<Basis>('1회 방문');
  const [amount, setAmount] = useState<number | null>(10_000);
  const [required, setRequired] = useState(10);
  const [reward, setReward] = useState('');
  const [validity, setValidity] = useState(12);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchOwnerStampPolicy(storeId).then((policy) => {
      if (cancelled) return;
      if (policy) {
        setExists(true);
        setRequired(policy.requiredStamps);
        setReward(policy.reward);
        const won = /^([\d,]+)원/.exec(policy.unit);
        if (won) { setBasis('결제 금액'); setAmount(Number(won[1].replace(/,/g, ''))); }
        const months = /(\d+)개월/.exec(policy.condition);
        setValidity(months ? Number(months[1]) : 0);
      }
      setLoaded(true);
    }).catch((cause) => { if (!cancelled) { setError(cause instanceof Error ? cause.message : '스탬프 혜택을 불러오지 못했어요.'); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [storeId]);

  async function submit() {
    if (basis === '결제 금액' && !amount) { setError('스탬프 1개를 찍어 줄 결제 금액을 입력해 주세요.'); return; }
    const input = {
      requiredStamps: required,
      reward: reward.trim(),
      unit: unitText(basis, amount),
      condition: validity ? `스탬프 유효 기간: 발급일로부터 ${validity}개월` : '',
    };
    const problem = validateStampPolicy(input);
    if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try { await saveStampPolicy(storeId, input, exists); setStep(2); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  const title = exists ? '스탬프 혜택 수정' : '스탬프 혜택 등록';

  return (
    <ComposeShell title={title} step={step} total={2} onBack={onClose} busy={busy || !loaded} onSubmit={() => void submit()}
      submitLabel={step === 1 ? (exists ? '스탬프판 고치기' : '스탬프판 만들기') : undefined}>
      {step === 1 && !loaded && <p className="ow-hint">불러오는 중…</p>}
      {step === 1 && loaded && <>
        <div className="ow-banner">
          <span className="ow-banner-icon" aria-hidden="true"><Icon name="gift" /></span>
          <div>
            <strong>단골 손님에게 특별한 혜택을 전해요</strong>
            <p>우리 가게만의 스탬프 혜택을 만들어보세요.</p>
          </div>
        </div>

        <Card title="적립 설정">
          <Field label="적립 기준" required>
            <ChoiceChips label="적립 기준" options={BASES} value={basis} onChange={setBasis} columns={2} />
          </Field>
          {basis === '결제 금액' && (
            <Field label="스탬프 1개당 결제 금액" required htmlFor="st-amount">
              <WonInput id="st-amount" value={amount} onChange={setAmount} placeholder="10,000" />
            </Field>
          )}
          <p className="ow-info"><Icon name="coins" />
            <span>{basis === '1회 방문' ? '방문 1회마다 스탬프 1개 적립' : `${(amount ?? 0).toLocaleString('ko-KR')}원 결제할 때마다 스탬프 1개 적립`}</span>
          </p>
        </Card>

        <Card title="완성 혜택">
          <Field label="모을 개수" required>
            <div className="ow-narrow"><Stepper label="모을 개수" value={required} onChange={setRequired} min={1} max={100} unit="개" /></div>
          </Field>
          <p className="ow-stamp-caption">{required}개 모으면</p>
          {required <= MAX_DOTS && (
            <ol className="ow-stamps" aria-hidden="true" style={{ '--per-row': Math.min(required, 10) } as CSSProperties}>
              {Array.from({ length: required }, (_, i) => (
                <li key={i} className={i === required - 1 ? 'is-goal' : ''}><Icon name={i === required - 1 ? 'gift' : 'stamp'} /></li>
              ))}
            </ol>
          )}
          <Field label="혜택 내용" required htmlFor="st-reward">
            <input id="st-reward" className="ow-input" maxLength={300} value={reward} onChange={(e) => setReward(e.target.value)} placeholder="예: 아메리카노 1잔 무료" />
          </Field>
          <Field label="스탬프 유효 기간" required htmlFor="st-validity">
            <span className="ow-addon">
              <Icon name="calendar" />
              <select id="st-validity" value={validity} onChange={(e) => setValidity(Number(e.target.value))}>
                {VALIDITY.map((v) => <option key={v.months} value={v.months}>{v.label}</option>)}
              </select>
            </span>
          </Field>
        </Card>
      </>}

      {step === 2 && (
        <DoneStep icon="gift" title={exists ? '스탬프판을 고쳤어요' : '스탬프판을 만들었어요'} desc={`스탬프 ${required}개를 모으면 ${reward.trim()}을(를) 드려요.`}
          actions={[
            { label: '스탬프 화면 보기', onClick: () => navigate('/coupon') },
            { label: '가게 관리로', onClick: onClose, primary: true },
          ]} />
      )}

      <FormError message={error} />
    </ComposeShell>
  );
}
