import LoginPage from '../login';
import SettingsPage from '../settings';
import './user.css';

/** 유저 및 설정 탭: 로그인 창 + 그 안의 설정 영역 */
export default function UserPage() {
  return (
    <div className="user-page">
      <LoginPage />
      <section className="user-page__settings" aria-label="설정">
        <SettingsPage />
      </section>
    </div>
  );
}
