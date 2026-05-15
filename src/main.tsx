// Importa StrictMode de React.
// Sirve para detectar problemas potenciales en desarrollo.
import { StrictMode } from 'react';

// Función para renderizar la app en el DOM (React 18+)
import { createRoot } from 'react-dom/client';

// Importamos React Query (TanStack Query)
import { QueryClientProvider } from '@tanstack/react-query';

// Estilos globales de la aplicación
import './styles/index.css';

// Componente principal de la app
import App from './App.tsx';
import { queryClient } from './app/utils/query-client.ts';

// Se obtiene el elemento raíz del HTML.
const rootElement = document.getElementById('root')!;

// Se crea el root de React.
const root = createRoot(rootElement);

// Render de la aplicación.
root.render(
  <StrictMode>
    {/* 
      QueryClientProvider hace disponible React Query
      para toda la aplicación.
      
      Gracias a esto, cualquier componente puede usar:
      useQuery, useMutation, useQueryClient, etc.
    */}
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);