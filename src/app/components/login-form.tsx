import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

// Componentes reutilizables del proyecto
// Card se usa como contenedor visual tipo tarjeta
// Button es el botón personalizado de la aplicación
import { Card } from './ui/card';
import { Button } from './ui/button';
import { cn } from './ui/utils';

// Icono decorativo de huella para el branding de la app
import { PawPrint } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import {
  isGoogleAuthConfigured,
  loadGoogleIdentityScript,
  renderGoogleSignInButton,
} from '../auth/google-auth';

const missingGoogleConfigMessage = 'Falta VITE_GOOGLE_CLIENT_ID en el entorno de Vite.';

// Componente del formulario de login
export function LoginForm() {
  // navigate es una función que permite redirigir al usuario a otra ruta
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithGoogleCredential } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(() =>
    isGoogleAuthConfigured() ? null : missingGoogleConfigMessage
  );
  const [renderAttempt, setRenderAttempt] = useState(0);

  const redirectPath = ((location.state as { from?: string } | null)?.from ?? '/');

  useEffect(() => {
    let isMounted = true;

    if (!isGoogleAuthConfigured()) {
      return;
    }

    loadGoogleIdentityScript()
      .then(() => {
        if (!isMounted || !googleButtonRef.current) {
          return;
        }

        setGoogleError(null);
        renderGoogleSignInButton(googleButtonRef.current, (response) => {
          if (!response.credential) {
            setGoogleError('Google no devolvió credencial de acceso.');
            return;
          }

          setIsAuthenticating(true);
          setGoogleError(null);

          loginWithGoogleCredential(response.credential)
            .then(() => {
              navigate(redirectPath, { replace: true });
            })
            .catch((error) => {
              const message =
                error instanceof Error
                  ? error.message
                  : 'No se pudo completar la autenticación con Google.';
              setGoogleError(message);
            })
            .finally(() => {
              if (isMounted) {
                setIsAuthenticating(false);
              }
            });
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setGoogleError(
          error instanceof Error
            ? error.message
            : 'No se pudo cargar el inicio de sesión con Google.'
        );
      });

    return () => {
      isMounted = false;
    };
  }, [loginWithGoogleCredential, navigate, redirectPath, renderAttempt]);

  return (
    // Card actúa como caja principal del formulario
    // w-full → ocupa todo el ancho disponible
    // max-w-lg → limita el ancho máximo
    // border-0 → elimina el borde para mantener un diseño minimalista
    // bg-white/95 → fondo blanco semitransparente que mejora la integración con el fondo
    // p-* → padding interno que define el espacio entre el contenido y los bordes
    // shadow-2xl → sombra pronunciada que aporta profundidad y jerarquía visual
    // backdrop-blur-sm → desenfoque del fondo que genera un efecto de vidrio (glassmorphism)
<Card className="w-full max-w-lg min-h-[380px] flex flex-col justify-center border-0 bg-white/95 p-6 shadow-2xl backdrop-blur-sm">      
      {/* Bloque superior con icono y nombre del sistema */}
      <div className="mb-4 flex flex-col items-center sm:mb-5">
        {/* Contenedor del icono de huella */}
        <div className="mb-2 rounded-2xl bg-gradient-to-br from-blue-500 to-green-500 p-2.5 sm:mb-3">
          {/* Icono visual del sistema */}
          <PawPrint className="h-6 w-6 text-white sm:h-7 sm:w-7" />
        </div>

        {/* Nombre y subtítulo de la aplicación */}
        <div className="text-center">
          <h2 className="mb-1 text-gray-900">PetHotel Manager</h2>
          <p className="text-xs text-gray-500 sm:text-sm">
            Sistema de gestión hotelera
          </p>
        </div>
      </div>

      {/* Título y texto descriptivo del acceso */}
      <div className="mb-6 text-center">
        <h3 className="mb-1 text-gray-900">Iniciar sesión</h3>
        <p className="text-sm text-gray-600">
          Accede con tu cuenta de Google para continuar
        </p>
      </div>

      <div className="mb-6 rounded-2xl bg-slate-50 p-4 text-sm text-gray-600">
        Bienvenido a la plataforma de gestión de PetHotel. Inicia sesión para acceder a tus
        herramientas de trabajo.
      </div>

      {/* Botón principal para autenticación con Google */}
      <div className="space-y-3">
        <div
          ref={googleButtonRef}
          className={cn(
            'flex min-h-11 w-full justify-center sm:min-h-12',
            isAuthenticating && 'pointer-events-none opacity-60'
          )}
        />

        {isAuthenticating && (
          <p className="text-center text-xs text-gray-500">Verificando sesión de Google...</p>
        )}

        {googleError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-900">
            <p className="font-medium">{googleError}</p>
            <p className="mt-1 text-xs text-amber-800">
              Si crees que debería estar habilitada, revisa tu cuenta con el equipo de gestión.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRenderAttempt((currentAttempt) => currentAttempt + 1)}
              className="mx-auto mt-3 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
            >
              Reintentar
            </Button>
          </div>
        )}
      </div>

    </Card>
  );
}
