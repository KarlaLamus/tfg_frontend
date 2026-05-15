import type { ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ROLE_DEFINITIONS, getUserRole, useAuth, type UserRole } from './auth-context';

interface RequireAuthProps {
  children: ReactNode;
}

interface RequireRoleProps {
  children: ReactNode;
  roles: UserRole[];
  title?: string;
  description?: string;
}

const buildRedirectPath = (pathname: string, search: string, hash: string) =>
  `${pathname}${search}${hash}`;

function AccessDeniedState({
  roles,
  currentRole,
  title,
  description,
}: {
  roles: UserRole[];
  currentRole: UserRole;
  title: string;
  description?: string;
}) {
  const navigate = useNavigate();

  const allowedRolesLabel = roles
    .map((role) => ROLE_DEFINITIONS[role].label.toLowerCase())
    .join(' o ');
  const currentRoleLabel = ROLE_DEFINITIONS[currentRole].label.toLowerCase();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600">
          {description ??
            `Tu sesión actual es ${currentRoleLabel} y esta sección solo está disponible para ${allowedRolesLabel}.`}
        </p>
      </div>

      <Card className="border-0 p-8 shadow-md">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-50 p-3 text-red-600">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <p className="text-gray-900">Acceso restringido</p>
              <p className="mt-1 text-sm text-gray-600">
                Mantengo visible la navegación general, pero bloqueo la sección para evitar accesos
                manuales por URL.
              </p>
            </div>
          </div>

          <Button
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
          >
            Volver al inicio
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { user } = useAuth();
  const location = useLocation();

  if (user == null) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: buildRedirectPath(location.pathname, location.search, location.hash) }}
      />
    );
  }

  return <>{children}</>;
}

export function RequireRole({
  children,
  roles,
  title = 'Acceso restringido',
  description,
}: RequireRoleProps) {
  const { user, hasRole } = useAuth();
  const location = useLocation();

  if (user == null) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: buildRedirectPath(location.pathname, location.search, location.hash) }}
      />
    );
  }

  if (!hasRole(roles)) {
    return (
      <AccessDeniedState
        roles={roles}
        currentRole={getUserRole(user)}
        title={title}
        description={description}
      />
    );
  }

  return <>{children}</>;
}
