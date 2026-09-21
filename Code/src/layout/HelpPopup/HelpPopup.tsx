import { useEffect } from 'react';
import './HelpPopup.css';

interface HelpPopupProps {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
}

/** ? 안내창: 화면 중앙 모달. 바깥 클릭 / 닫기 버튼 / Esc 로 닫힌다. */
export default function HelpPopup({ open, title, body, onClose }: HelpPopupProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="help-popup__overlay" onClick={onClose}>
      <div
        className="help-popup__card"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} 안내`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="help-popup__title">{title}</h2>
        <p className="help-popup__body">{body}</p>
        <button type="button" className="help-popup__close" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}