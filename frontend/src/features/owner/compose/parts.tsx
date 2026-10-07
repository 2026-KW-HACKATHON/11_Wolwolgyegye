import { useId, useRef, type ReactNode } from 'react';
import Icon from '../../../shared/Icon';
import type { IconName } from '../../../shared/icons';

/** 흰 카드 한 묶음 (제목 + 내용) */
export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="ow-card">
      {title && <h2 className="ow-card-title">{title}</h2>}
      {children}
    </section>
  );
}

/** 라벨 + 입력. required 면 빨간 * 를 붙인다 (화면 읽기용 "필수"도 함께) */
export function Field({ label, required, hint, children, htmlFor }: { label: string; required?: boolean; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="ow-field">
      <label className="ow-label" htmlFor={htmlFor}>
        {label}{required && <span className="ow-req" aria-label="필수">*</span>}
      </label>
      {children}
      {hint && <p className="ow-hint">{hint}</p>}
    </div>
  );
}

/** 하나만 고르는 칩 묶음 (radio) */
export function ChoiceChips<T extends string>({ label, options, value, onChange, columns = 3, icons }: {
  label: string; options: readonly T[]; value: T | ''; onChange: (value: T) => void; columns?: number; icons?: Partial<Record<T, IconName>>;
}) {
  return (
    <div className="ow-chips" role="radiogroup" aria-label={label} data-cols={columns}>
      {options.map((option) => (
        <button key={option} type="button" role="radio" aria-checked={value === option} onClick={() => onChange(option)}>
          {value === option ? <Icon name="check" /> : icons?.[option] && <Icon name={icons[option]!} />}
          <span>{option}</span>
        </button>
      ))}
    </div>
  );
}

/** − 값 + */
export function Stepper({ label, value, onChange, min, max, unit }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; unit: string }) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next) || min)));
  return (
    <div className="ow-stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`${label} 줄이기`} disabled={value <= min} onClick={() => set(value - 1)}><Icon name="minus" /></button>
      <span className="ow-stepper-value">
        <input type="number" inputMode="numeric" aria-label={label} min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} />
        <span aria-hidden="true">{unit}</span>
      </span>
      <button type="button" aria-label={`${label} 늘리기`} disabled={value >= max} onClick={() => set(value + 1)}><Icon name="plus" /></button>
    </div>
  );
}

/** 켜기/끄기 */
export function Toggle({ label, desc, icon, checked, onChange }: { label: string; desc?: string; icon?: IconName; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return (
    <div className="ow-toggle-row">
      {icon && <Icon name={icon} className="ow-toggle-icon" />}
      <div className="ow-toggle-text">
        <label htmlFor={id}>{label}</label>
        {desc && <p>{desc}</p>}
      </div>
      <input id={id} type="checkbox" role="switch" className="ow-switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

/** 원 단위 숫자 입력 (쉼표 + "원") */
export function WonInput({ id, value, onChange, placeholder, invalid }: { id?: string; value: number | null; onChange: (value: number | null) => void; placeholder?: string; invalid?: boolean }) {
  return (
    <span className="ow-won">
      <input
        id={id}
        inputMode="numeric"
        aria-invalid={invalid || undefined}
        value={value === null ? '' : value.toLocaleString('ko-KR')}
        placeholder={placeholder}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
          onChange(digits ? Number(digits) : null);
        }}
      />
      <span aria-hidden="true">원</span>
    </span>
  );
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const IMAGE_RULE = 'JPG · PNG · WebP, 1MB 이하';

/** 고른 파일을 data:image 값으로 읽는다 (저장할 때 feedSource 가 올린다) */
export function readImage(file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type) || file.size > 1024 * 1024) return Promise.reject(new Error(`사진은 ${IMAGE_RULE} 파일을 골라 주세요.`));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('사진을 읽지 못했어요. 다른 파일을 골라 주세요.'));
    reader.readAsDataURL(file);
  });
}

/** 점선 상자의 "사진 추가" 버튼 (숨긴 file input 을 연다) */
export function PhotoAdd({ label, onPick, size = 'tile', disabled }: { label: string; onPick: (file: File) => void; size?: 'tile' | 'wide' | 'box'; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={`ow-photo-add is-${size}`} disabled={disabled} onClick={() => inputRef.current?.click()}>
        <span className="ow-photo-add-icon" aria-hidden="true"><Icon name={size === 'tile' ? 'plus' : 'image'} /></span>
        <span>{label}</span>
      </button>
      <input ref={inputRef} type="file" accept={IMAGE_TYPES.join(',')} hidden onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) onPick(file);
      }} />
    </>
  );
}

/** 고른 사진 한 장 (지우기 버튼 포함) */
export function PhotoThumb({ src, alt, onRemove }: { src: string; alt: string; onRemove: () => void }) {
  return (
    <div className="ow-photo">
      <img src={src} alt={alt} />
      <button type="button" className="ow-photo-remove" aria-label={`${alt} 지우기`} onClick={onRemove}><Icon name="trash" /></button>
    </div>
  );
}

/** 입력 오류 한 줄 */
export function FormError({ message }: { message: string }) {
  return message ? <p className="ow-error" role="alert">{message}</p> : null;
}

/** 마지막 단계: 등록 완료 */
export function DoneStep({ icon, title, desc, actions }: { icon: IconName; title: string; desc: string; actions: { label: string; onClick: () => void; primary?: boolean }[] }) {
  return (
    <div className="ow-done">
      <span className="ow-done-icon" aria-hidden="true"><Icon name={icon} /></span>
      <h2>{title}</h2>
      <p>{desc}</p>
      <div className="ow-done-actions">
        {actions.map((action) => (
          <button key={action.label} type="button" className={action.primary ? 'ow-submit' : 'ow-secondary'} onClick={action.onClick}>{action.label}</button>
        ))}
      </div>
    </div>
  );
}
