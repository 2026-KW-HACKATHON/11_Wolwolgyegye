import './Splash.css';

export default function Splash() {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash__logo">동네 상권</div>
      <div className="splash__spinner" aria-label="로그인 상태 확인 중" />
    </div>
  );
}