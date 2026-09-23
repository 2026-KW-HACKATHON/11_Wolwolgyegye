import { useEffect, useRef, type ReactNode } from 'react';

export default function FeedDialog({ title, onDismiss, children }: { title: string; onDismiss: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return (
    <dialog ref={ref} className="sf-dialog" aria-label={title} onCancel={(e) => { e.preventDefault(); onDismiss(); }}
      onClick={(e) => { if (e.target === ref.current) { const r = ref.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onDismiss(); } }}>
      <div className="sf-dialog-head"><h2>{title}</h2><button type="button" className="sf-icon-btn" aria-label="닫기" onClick={onDismiss}>×</button></div>
      {children}
    </dialog>
  );
}
