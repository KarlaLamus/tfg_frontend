import { useNavigate } from 'react-router';
import { Calendar, PawPrint, CreditCard, DoorOpen } from 'lucide-react';
import { Card } from '../ui/card';
import { cn } from '../ui/utils';
import { buildReturnNavigationState } from '../../utils/return-navigation';

interface QuickAction {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  hoverColor: string;
  onClick: () => void;
}

export function QuickActions() {
  const navigate = useNavigate();

  const handleNewReservation = () => {
    navigate('/reservas/nueva', {
      state: buildReturnNavigationState('/', 'Volver al dashboard'),
    });
  };

  const handleRegisterPet = () => {
    // Navegar a mascotas y usar query param para abrir el modal
    navigate('/mascotas?action=new');
  };

  const handleRegisterPayment = () => {
    navigate('/pagos?action=new');
  };

  const handleViewRooms = () => {
    navigate('/salas');
  };

  const actions: QuickAction[] = [
    {
      label: 'Nueva Reserva',
      description: 'Crear una nueva reserva',
      icon: Calendar,
      color: 'from-blue-500 to-blue-600',
      hoverColor: 'hover:from-blue-600 hover:to-blue-700',
      onClick: handleNewReservation,
    },
    {
      label: 'Registrar Mascota',
      description: 'Añadir nueva mascota',
      icon: PawPrint,
      color: 'from-green-500 to-green-600',
      hoverColor: 'hover:from-green-600 hover:to-green-700',
      onClick: handleRegisterPet,
    },
    {
      label: 'Realizar Pago',
      description: 'Registrar un pago',
      icon: CreditCard,
      color: 'from-purple-500 to-purple-600',
      hoverColor: 'hover:from-purple-600 hover:to-purple-700',
      onClick: handleRegisterPayment,
    },
    {
      label: 'Ver Salas',
      description: 'Estado de ocupación',
      icon: DoorOpen,
      color: 'from-amber-500 to-amber-600',
      hoverColor: 'hover:from-amber-600 hover:to-amber-700',
      onClick: handleViewRooms,
    },
  ];

  return (
    <div>
      <h3 className="text-gray-900 mb-4">Accesos Rápidos</h3>
      <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4')}>
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="group text-left"
          >
            <Card className="p-4 sm:p-6 border-0 shadow-md hover:shadow-xl transition-all">
              <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${action.color} ${action.hoverColor} transition-all mb-3 sm:mb-4`}>
                <action.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h4 className="text-gray-900 mb-1 text-sm sm:text-base">{action.label}</h4>
              <p className="text-xs sm:text-sm text-gray-500">{action.description}</p>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
