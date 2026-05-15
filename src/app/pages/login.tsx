// Este componente contiene la tarjeta con el botón de acceso
import { LoginForm } from '../components/login-form';
import { Navigate } from 'react-router';

// Importa la imagen que se usará como fondo de la página
import petsImage from "@/assets/loginImg.png";
import { useAuth } from '../auth/auth-context';

// Componente principal de la página de login
export default function LoginPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    // Contenedor principal de toda la pantalla
    // relative → permite posicionar elementos absolutos dentro, como el fondo
    // flex → activa flexbox para alinear el contenido
    // min-h-dvh → altura mínima igual a toda la pantalla visible
    // items-center → centra el contenido en vertical
    // justify-center → centra el contenido en horizontal
    // overflow-hidden → oculta cualquier contenido que sobresalga
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden">
      
      {/* 
        Capa de fondo que ocupa toda la pantalla.
        absolute inset-0 hace que este bloque se pegue a los 4 lados del contenedor padre.
      */}
      <div className="absolute inset-0">
        
        {/* 
          Imagen de fondo.
          h-full w-full → ocupa todo el ancho y alto del contenedor
          object-cover → rellena el espacio sin deformarse, aunque recorte parte de la imagen
        */}
        <img
          src={petsImage}
          alt="Mascotas"
          className="h-full w-full object-cover"
        />

        {/* 
          Primera capa oscura encima de la imagen.
        */}
        <div className="absolute inset-0 bg-slate-950/50" />

        {/* 
          Segunda capa con degradado.
          Añade color al fondo.
        */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/60 via-slate-900/50 to-emerald-900/60" />
      </div>

      {/* 
        Contenedor del formulario.
        relative → necesario para que quede por encima del fondo absoluto
        z-10 → da prioridad visual sobre la imagen y overlays
        w-full → puede ocupar todo el ancho disponible
        max-w-md → limita el ancho máximo para que no se vea demasiado grande
        px-4 → añade espacio horizontal interno en pantallas pequeñas
      */}
      <div className="relative z-10 w-full max-w-md px-4">
        
        {/* Renderiza el formulario de login */}
        <LoginForm />
      </div>
    </div>
  );
}
