import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './app/components/ui/sonner';
import { AuthProvider } from './app/auth/auth-context';

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors duration={3000} />
    </AuthProvider>
  );
}
