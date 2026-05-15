/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authenticateWithGoogleCredential, clearGoogleAutoSelect } from './google-auth';

export type UserRole = 'admin' | 'employee';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  avatarUrl?: string;
  authSource: 'google-backend';
}

interface RoleDefinition {
  label: string;
  description: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loginWithGoogleCredential: (credential: string) => Promise<AuthUser>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  admin: {
    label: 'Administrador',
    description: 'Acceso a métricas, supervisión y gestión de empleados.',
  },
  employee: {
    label: 'Empleado',
    description: 'Gestión diaria de clientes, mascotas, reservas, pagos y seguimiento.',
  },
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_STORAGE_KEY = 'pet-hotel-auth-session';

const canUseSessionStorage = () => typeof window !== 'undefined';

const readStoredUser = (): AuthUser | null => {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(AUTH_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedUser = JSON.parse(rawValue) as AuthUser;

    if (
      typeof parsedUser?.id === 'string' &&
      typeof parsedUser?.name === 'string' &&
      typeof parsedUser?.email === 'string' &&
      typeof parsedUser?.isAdmin === 'boolean' &&
      parsedUser?.authSource === 'google-backend'
    ) {
      return parsedUser;
    }
  } catch {
    // Ignore invalid session payloads and fall back to logged out state.
  }

  return null;
};

const writeStoredUser = (user: AuthUser | null) => {
  if (!canUseSessionStorage()) {
    return;
  }

  if (user == null) {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
};

export const getUserRole = (user: Pick<AuthUser, 'isAdmin'>): UserRole =>
  user.isAdmin ? 'admin' : 'employee';

export const getUserInitials = (name: string) => {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return initials || 'PH';
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  useEffect(() => {
    writeStoredUser(user);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user != null,
      isAdmin: user?.isAdmin ?? false,
      loginWithGoogleCredential: async (credential) => {
        const authenticatedUser = await authenticateWithGoogleCredential(credential);
        writeStoredUser(authenticatedUser);
        setUser(authenticatedUser);

        return authenticatedUser;
      },
      logout: () => {
        clearGoogleAutoSelect();
        writeStoredUser(null);
        setUser(null);
      },
      hasRole: (roles) => (user == null ? false : roles.includes(getUserRole(user))),
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context == null) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  }

  return context;
}
