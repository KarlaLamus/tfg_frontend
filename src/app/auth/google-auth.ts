import type { AuthUser, UserRole } from './auth-context';

const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
const API_BASE_URL = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') ?? '';

export interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

interface GoogleButtonOptions {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number | string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
  disableAutoSelect: () => void;
}

interface GoogleIdentityNamespace {
  accounts?: {
    id?: GoogleAccountsId;
  };
}

interface GoogleCredentialPayload {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  exp?: number;
}

interface BackendAuthResponse {
  user?: BackendUserPayload;
  empleado?: BackendUserPayload;
  usuario?: BackendUserPayload;
  id?: string | number;
  sub?: string;
  name?: string;
  nombre?: string;
  email?: string;
  correo?: string;
  avatarUrl?: string;
  picture?: string;
  fotoUrl?: string;
  isAdmin?: boolean;
  admin?: boolean;
  administrador?: boolean;
  autorizado?: boolean;
  autorizadoLogin?: boolean;
  permitido?: boolean;
  canAccess?: boolean;
  hasAccess?: boolean;
  activo?: boolean;
  enabled?: boolean;
  permisos?: string[] | boolean;
  permissions?: string[] | boolean;
  role?: string;
  rol?: string;
  perfil?: string;
  tipo?: string;
}

type BackendUserPayload = Omit<BackendAuthResponse, 'user' | 'empleado' | 'usuario'>;

declare global {
  interface Window {
    google?: GoogleIdentityNamespace;
  }
}

let googleScriptPromise: Promise<void> | null = null;

export const isGoogleAuthConfigured = () => GOOGLE_CLIENT_ID.length > 0;

export const loadGoogleIdentityScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Sign-In solo está disponible en navegador'));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('No se pudo cargar Google Identity Services')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

const decodeBase64Url = (value: string) => {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedValue = normalizedValue.padEnd(Math.ceil(normalizedValue.length / 4) * 4, '=');
  const binaryValue = window.atob(paddedValue);
  const bytes = Uint8Array.from(binaryValue, (character) => character.charCodeAt(0));

  return new TextDecoder().decode(bytes);
};

const decodeGoogleCredential = (credential: string): GoogleCredentialPayload => {
  const [, payload] = credential.split('.');

  if (!payload) {
    throw new Error('Google no devolvió una credencial válida');
  }

  const decodedPayload = JSON.parse(decodeBase64Url(payload)) as GoogleCredentialPayload;

  if (!decodedPayload.sub || !decodedPayload.email) {
    throw new Error('La credencial de Google no contiene usuario o email');
  }

  if (decodedPayload.exp && decodedPayload.exp * 1000 < Date.now()) {
    throw new Error('La credencial de Google ha caducado');
  }

  return decodedPayload;
};

const getBackendAuthEndpoint = () => {
  return `${API_BASE_URL}/api/auth/google`;
};

const normalizeRole = (value: unknown): UserRole | null => {
  const normalizedValue = String(value ?? '').trim().toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  if (['admin', 'administrador', 'administrator', 'role_admin'].includes(normalizedValue)) {
    return 'admin';
  }

  if (
    ['employee', 'empleado', 'trabajador', 'recepcion', 'recepcionista', 'role_employee'].includes(
      normalizedValue
    )
  ) {
    return 'employee';
  }

  return null;
};

const getAccessFlag = (payload: BackendUserPayload | BackendAuthResponse | null | undefined) => {
  if (!payload) {
    return null;
  }

  const directFlags = [
    payload.autorizado,
    payload.autorizadoLogin,
    payload.permitido,
    payload.canAccess,
    payload.hasAccess,
    payload.activo,
    payload.enabled,
  ];
  const resolvedDirectFlag = directFlags.find((flag): flag is boolean => typeof flag === 'boolean');

  if (typeof resolvedDirectFlag === 'boolean') {
    return resolvedDirectFlag;
  }

  const permissions = payload.permisos ?? payload.permissions;

  if (typeof permissions === 'boolean') {
    return permissions;
  }

  if (Array.isArray(permissions)) {
    return permissions.length > 0;
  }

  return null;
};

const resolveBackendRole = (
  data: BackendAuthResponse,
  userPayload: BackendUserPayload
): UserRole | null => {
  const explicitRole =
    normalizeRole(userPayload.role) ??
    normalizeRole(userPayload.rol) ??
    normalizeRole(userPayload.perfil) ??
    normalizeRole(userPayload.tipo) ??
    normalizeRole(data.role) ??
    normalizeRole(data.rol) ??
    normalizeRole(data.perfil) ??
    normalizeRole(data.tipo);

  if (explicitRole) {
    return explicitRole;
  }

  const adminFlag =
    userPayload.isAdmin ??
    userPayload.admin ??
    userPayload.administrador ??
    data.isAdmin ??
    data.admin ??
    data.administrador;

  if (adminFlag === true) {
    return 'admin';
  }

  if (adminFlag === false) {
    return 'employee';
  }

  return null;
};

const normalizeBackendUser = (
  data: BackendAuthResponse,
  googlePayload: GoogleCredentialPayload
): AuthUser => {
  const userPayload = data.user ?? data.empleado ?? data.usuario ?? data;
  const resolvedRole = resolveBackendRole(data, userPayload);
  const accessFlag = getAccessFlag(userPayload) ?? getAccessFlag(data);

  if (accessFlag === false) {
    throw new Error('No encontramos tu cuenta activa. Contacta con el administrador del hotel.');
  }

  if (!resolvedRole) {
    throw new Error('Tu cuenta está pendiente de configuración. Contacta con el administrador.');
  }

  return {
    id: String(userPayload.id ?? userPayload.sub ?? googlePayload.sub),
    name:
      userPayload.name ??
      userPayload.nombre ??
      googlePayload.name ??
      [googlePayload.given_name, googlePayload.family_name].filter(Boolean).join(' ') ??
      googlePayload.email,
    email: userPayload.email ?? userPayload.correo ?? googlePayload.email,
    isAdmin: resolvedRole === 'admin',
    avatarUrl: userPayload.avatarUrl ?? userPayload.picture ?? userPayload.fotoUrl ?? googlePayload.picture,
    authSource: 'google-backend',
  };
};

const buildBackendAuthError = (rawBody: string, status: number) => {
  if (rawBody.trim()) {
    try {
      const parsedBody = JSON.parse(rawBody) as {
        message?: string;
        error?: string;
        detalle?: string;
        details?: string;
      };
      const detail =
        parsedBody.message?.trim() ||
        parsedBody.detalle?.trim() ||
        parsedBody.details?.trim() ||
        parsedBody.error?.trim();

      if (detail) {
        return detail;
      }
    } catch {
      return rawBody.trim();
    }
  }

  if (status === 401 || status === 403) {
    return 'No encontramos tu cuenta activa. Contacta con el administrador del hotel.';
  }

  return `El backend rechazó la autenticación de Google (HTTP ${status})`;
};

export const authenticateWithGoogleCredential = async (credential: string): Promise<AuthUser> => {
  const googlePayload = decodeGoogleCredential(credential);
  const backendAuthEndpoint = getBackendAuthEndpoint();

  try {
    const response = await fetch(backendAuthEndpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        idToken: credential,
      }),
    });
    const rawBody = await response.text();

    if (!response.ok) {
      throw new Error(buildBackendAuthError(rawBody, response.status));
    }

    if (!rawBody.trim()) {
      throw new Error('El backend no devolvió datos de usuario ni rol');
    }

    return normalizeBackendUser(
      JSON.parse(rawBody) as BackendAuthResponse,
      googlePayload
    );
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('No se pudo conectar con el backend para validar el login');
    }

    throw error;
  }
};

export const renderGoogleSignInButton = (
  container: HTMLElement,
  callback: (response: GoogleCredentialResponse) => void
) => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Falta VITE_GOOGLE_CLIENT_ID');
  }

  const googleIdentity = window.google?.accounts?.id;

  if (!googleIdentity) {
    throw new Error('Google Identity Services no está disponible');
  }

  googleIdentity.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback,
    ux_mode: 'popup',
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  container.innerHTML = '';
  googleIdentity.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'left',
    width: Math.min(Math.max(container.offsetWidth, 320), 420),
  });
};

export const clearGoogleAutoSelect = () => {
  window.google?.accounts?.id?.disableAutoSelect();
};
