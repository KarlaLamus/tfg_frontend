import { useState } from 'react';
import { Outlet } from 'react-router';
import { Header } from './header';
import { Sidebar } from './sidebar';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

      {/* Contenedor principal */}
      <div className="flex pt-16">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Contenido principal */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:ml-64 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
