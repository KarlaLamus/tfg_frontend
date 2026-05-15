import { NavLink } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { 
  LayoutDashboard, 
  Users, 
  PawPrint, 
  Calendar, 
  Briefcase, 
  Activity, 
  DollarSign, 
  Home,
  ShieldCheck,
  X
} from 'lucide-react';
import { cn } from '../ui/utils';
import {
  ROLE_DEFINITIONS,
  getUserRole,
  useAuth,
  type UserRole,
} from '../../auth/auth-context';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
}

const menuItems: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'employee'] },
  { path: '/clientes', label: 'Clientes', icon: Users, roles: ['admin', 'employee'] },
  { path: '/mascotas', label: 'Mascotas', icon: PawPrint, roles: ['admin', 'employee'] },
  { path: '/reservas', label: 'Reservas', icon: Calendar, roles: ['admin', 'employee'] },
  { path: '/servicios', label: 'Servicios', icon: Briefcase, roles: ['admin', 'employee'] },
  { path: '/seguimiento', label: 'Seguimiento', icon: Activity, roles: ['admin', 'employee'] },
  { path: '/pagos', label: 'Pagos', icon: DollarSign, roles: ['admin', 'employee'] },
  { path: '/salas', label: 'Salas', icon: Home, roles: ['admin', 'employee'] },
  { path: '/empleados', label: 'Empleados', icon: ShieldCheck, roles: ['admin'] },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();

  if (user == null) {
    return null;
  }

  const currentRole = getUserRole(user);
  const roleDefinition = ROLE_DEFINITIONS[currentRole];
  const visibleMenuItems = menuItems.filter((item) => item.roles.includes(currentRole));

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-16 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-40 transition-transform duration-300 overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Botón cerrar (solo móvil) */}
        <button
          onClick={onClose}
          className="lg:hidden absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-green-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-700">
              Sesión activa
            </p>
            <p className="mt-2 text-gray-900">{roleDefinition.label}</p>
            <p className="mt-1 text-xs text-gray-600">{roleDefinition.description}</p>
          </div>
        </div>

        {/* Menú de navegación */}
        <nav className="p-4 space-y-1">
          {visibleMenuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all group",
                  isActive
                    ? "bg-gradient-to-r from-blue-50 to-green-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "w-5 h-5 transition-colors",
                      isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                    )}
                  />
                  <span className={cn(
                    isActive ? "font-medium" : "font-normal"
                  )}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer del sidebar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-center">
            <p className="text-xs text-gray-500">v1.0.0</p>
            <p className="text-xs text-gray-400 mt-1">© 2026 PetHotel Manager</p>
          </div>
        </div>
      </aside>
    </>
  );
}
