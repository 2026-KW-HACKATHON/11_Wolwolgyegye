import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStatus } from '../core/auth/useAuthStatus';
import { DEFAULT_LANDING_PATH } from '../core/categories/categories';
import AppShell from '../layout/AppShell/AppShell';
import Splash from '../layout/Splash/Splash';
import OwnerPage from '../features/owner/OwnerPage';

/**
 * 최상위 경로 정의.
 * - 토큰 확인이 끝나기 전에는 화면을 그리지 않고 스플래시만 보여준다.
 * - 개별 카테고리 경로는 AppShell 안의 KeepAlivePages 가 마스터 배열을 보고 처리한다.
 * - 사장님 영역(/owner)은 손님 앱의 AppShell/네비게이션과 무관한 별도 화면이라 여기서 바로 갈라진다.
 */
export default function AppRoutes() {
  const status = useAuthStatus();

  if (status === 'checking') {
    return <Splash />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={DEFAULT_LANDING_PATH} replace />} />
      <Route path="/owner" element={status === 'owner' ? <OwnerPage /> : <Navigate to="/login?intent=owner" replace />} />
      <Route path="/*" element={<AppShell />} />
    </Routes>
  );
}
