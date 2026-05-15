import { useNavigate } from 'react-router';
import { Menu, PawPrint, User, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  ROLE_DEFINITIONS,
  getUserInitials,
  getUserRole,
  useAuth,
} from '../../auth/auth-context';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  if (user == null) {
    return null;
  }

  const roleDefinition = ROLE_DEFINITIONS[getUserRole(user)];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between">
        {/* Lado izquierdo: Logo y menú móvil */}
        <div className="flex items-center gap-4">
          {/* Botón menú móvil */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-green-500 p-2 rounded-xl">
              <PawPrint className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-gray-900">PetHotel Manager</h1>
            </div>
          </div>
        </div>

        {/* Lado derecho: Perfil de usuario */}
        <div className="flex items-center">
          {/* Menú de perfil */}
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none">
              <div className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-green-500 text-white">
                    {getUserInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-sm text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{roleDefinition.label}</p>
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-default focus:bg-transparent">
                <User className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>{user.email}</span>
                  <span className="text-xs text-gray-500">{roleDefinition.description}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
