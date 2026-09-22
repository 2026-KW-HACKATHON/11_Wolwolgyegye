import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_LANDING_PATH } from '../../core/categories/categories';
import { useUserSession } from '../../shared/session/UserSessionContext';
import { useToast } from '../../shared/toast/ToastContext';
import './login.css';

const PROVIDERS = [
  { key: 'naver', label: '네이버로 시작하기', className: 'lp-provider--naver' },
  { key: 'kakao', label: '카카오로 시작하기', className: 'lp-provider--kakao' },
  { key: 'google', label: '구글로 시작하기', className: 'lp-provider--google' },
] as const;

export default function LoginPage() {
  const { userName, login, logout } = useUserSession();
  const [name, setName] = useState('');
  const showToast = useToast();
  const navigate = useNavigate();

  function handleProviderLogin(providerLabel: string) {
    login(`${providerLabel} 사용자`);
    showToast(`${providerLabel} 계정으로 로그인했어요`);
    navigate(DEFAULT_LANDING_PATH);
  }

  function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    login(trimmed);
    showToast(`${trimmed}님, 환영해요!`);
    navigate(DEFAULT_LANDING_PATH);
  }

  function handleLogout() {
    logout();
    showToast('로그아웃 되었어요');
  }

  if (userName) {
    return (
      <div className="lp-card">
        <div className="lp-user-badge">{userName.charAt(0)}</div>
        <h2 className="lp-title">{userName}님</h2>
        <p className="lp-sub">월계1동 이웃들과 함께하고 있어요</p>
        <button type="button" className="lp-logout" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="lp-card">
      <h2 className="lp-title">로그인</h2>
      <p className="lp-sub">월계1동 이웃들과 더 가까워져요</p>

      <div className="lp-provider-list">
        {PROVIDERS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`lp-provider-btn ${p.className}`}
            onClick={() => handleProviderLogin(p.label.replace('로 시작하기', ''))}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="lp-divider">
        <span>또는</span>
      </div>

      <form className="lp-name-form" onSubmit={handleNameSubmit}>
        <input
          className="lp-name-input"
          type="text"
          placeholder="닉네임을 입력해주세요"
          maxLength={12}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="lp-submit" type="submit">
          이 이름으로 시작하기
        </button>
      </form>
    </div>
  );
}
