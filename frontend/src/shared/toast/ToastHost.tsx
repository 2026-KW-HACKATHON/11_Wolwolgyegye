import { useToastMessage } from './ToastContext';
import './Toast.css';

/** App 최상단에 한 번만 렌더링하는 토스트 표시 영역 */
export default function ToastHost() {
  const message = useToastMessage();
  return (
    <div className={`wol-toast${message ? ' is-visible' : ''}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
