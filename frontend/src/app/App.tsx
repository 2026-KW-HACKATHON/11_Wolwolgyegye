import AuthProvider from './providers/AuthProvider';
import LayoutModeProvider from './providers/LayoutModeProvider';
import AppRoutes from './router';
import { ToastProvider } from '../shared/toast/ToastContext';
import ToastHost from '../shared/toast/ToastHost';
import { UserSessionProvider } from '../shared/session/UserSessionContext';

export default function App() {
  return (
    <AuthProvider>
      <UserSessionProvider>
        <ToastProvider>
          <LayoutModeProvider>
            <AppRoutes />
            <ToastHost />
          </LayoutModeProvider>
        </ToastProvider>
      </UserSessionProvider>
    </AuthProvider>
  );
}