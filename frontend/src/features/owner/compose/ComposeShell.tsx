import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../shared/Icon';
import './compose.css';

interface ComposeShellProps {
  title: string;
  step: number;
  total: number;
  onBack: () => void;
  /** 하단 고정 버튼 글자. 없으면 버튼을 그리지 않는다 (완료 단계) */
  submitLabel?: string;
  busy?: boolean;
  onSubmit?: () => void;
  children: ReactNode;
}

/**
 * 사장님 등록 화면의 공통 틀. 지도 앱(AppShell) 위를 전부 덮는 화면으로 열린다.
 * [뒤로 · 제목 · 단계] / 내용(스크롤) / 하단 고정 버튼
 * 내용 전체가 하나의 form 이라 하단 버튼이나 Enter 로 다음 단계로 넘어간다.
 */
export default function ComposeShell({ title, step, total, onBack, submitLabel, busy, onSubmit, children }: ComposeShellProps) {
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 단계가 바뀌면 맨 위로, 제목에 초점 (화면 읽기 프로그램이 새 단계를 읽도록)
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus();
  }, [step]);

  // 뒤 화면이 같이 스크롤되지 않게
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!busy) onSubmit?.();
  }

  return createPortal(
    <div className="ow-page" role="dialog" aria-modal="true" aria-labelledby={titleId}
      onKeyDown={(e) => { if (e.key === 'Escape') onBack(); }}>
      <header className="ow-top">
        <button type="button" className="ow-back" aria-label={step > 1 && submitLabel ? '이전 단계' : '사장님 센터로 돌아가기'} onClick={onBack}>
          <Icon name="chevronLeft" />
        </button>
        <h1 id={titleId} ref={headingRef} tabIndex={-1}>{title}</h1>
        <span className="ow-step" aria-label={`${total}단계 중 ${step}단계`}>{step} / {total}</span>
      </header>
      <form className="ow-form" onSubmit={submit} noValidate>
        <div className="ow-body" ref={bodyRef}>{children}</div>
        {submitLabel && (
          <div className="ow-foot">
            <button type="submit" className="ow-submit" disabled={busy}>{busy ? '저장 중…' : submitLabel}</button>
          </div>
        )}
      </form>
    </div>,
    document.body,
  );
}
