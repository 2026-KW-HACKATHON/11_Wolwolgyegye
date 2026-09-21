import AuthProvider from './providers/AuthProvider';
import LayoutModeProvider from './providers/LayoutModeProvider';
import AppRoutes from './router';

export default function App() {
  return (
    <AuthProvider>
      <LayoutModeProvider>
        <AppRoutes />
      </LayoutModeProvider>
    </AuthProvider>
  );
}