import { useAuthStatus } from '../../core/auth/useAuthStatus';
import Icon from '../../shared/Icon';
import { useUserSession } from '../../shared/session/UserSessionContext';
import './UserButton.css';

/**
 * 유저 및 설정 버튼. 누르면 유저 탭(로그인 + 설정)이 열린다.
 * 비로그인 / 일반 사용자 / 사장님 상태에 따라 표시만 달라진다.
 */
export default function UserButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const { userName } = useUserSession();
  const status = useAuthStatus();
  const label = status === 'owner' ? '사장님' : userName ? '내 정보' : '로그인';

  return (
    <button
      type="button"
      className="user-button"
      aria-current={active ? 'page' : undefined}
      aria-label={userName ? `${userName}님, 내 정보와 설정` : '로그인과 설정'}
      onClick={onClick}
    >
      <span className="user-button__avatar" data-signed-in={!!userName}>
        {userName ? userName.charAt(0) : <Icon name="user" />}
      </span>
      <span className="user-button__label">{label}</span>
    </button>
  );
}
