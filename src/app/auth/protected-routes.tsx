import { RequireAuth, RequireRole } from './auth-guards';
import { AppLayout } from '../components/layout/app-layout';
import EmployeesPage from '../pages/employees';

export function ProtectedAppLayout() {
  return (
    <RequireAuth>
      <AppLayout />
    </RequireAuth>
  );
}

export function ProtectedEmployeesPage() {
  return (
    <RequireRole
      roles={['admin']}
      title="Gestión de empleados reservada para administración"
      description="Solo el personal con el booleano admin activado puede gestionar cuentas internas y permisos."
    >
      <EmployeesPage />
    </RequireRole>
  );
}
