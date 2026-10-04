import AuthProvider from './providers/AuthProvider';
import LayoutModeProvider from './providers/LayoutModeProvider';
import AppRoutes from './router';
import { ToastProvider } from '../shared/toast/ToastContext';
import ToastHost from '../shared/toast/ToastHost';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <LayoutModeProvider>
          <AppRoutes />
          <ToastHost />
        </LayoutModeProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
