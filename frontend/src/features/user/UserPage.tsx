import LoginPage from '../login';
import SettingsPage from '../settings';
import './user.css';

/** 유저 탭: 로그인 창(로그인하면 계정 정보) + 설정 */
export default function UserPage() {
  return (
    <div className="user-page">
      <LoginPage />
      <SettingsPage />
    </div>
  );
}
