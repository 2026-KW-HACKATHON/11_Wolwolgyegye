import { useEffect, useRef, type ReactNode } from 'react';
import './Sheet.css';

/** 화면 가운데 뜨는 안내 창. 모바일에서는 아래에서 올라오는 시트 모양이 된다. ESC·바깥 클릭으로 닫힌다 */
export default function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sh-sheet"
      aria-label={title}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="sh-inner">
        <div className="sh-head">
          <h2 className="sh-title">{title}</h2>
          <button type="button" className="sh-close" aria-label="닫기" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
