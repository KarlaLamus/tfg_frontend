import {
  Activity,
  Calendar,
  DollarSign,
  ClipboardCheck,
  UserPlus,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { Card } from '../ui/card';

export interface RecentActivityItem {
  id: string;
  type: 'reservation' | 'payment' | 'tracking' | 'client';
  title: string;
  description: string;
  timestamp: string;
  importance: 'high' | 'normal';
  href: string;
}

interface RecentActivityProps {
  activities: RecentActivityItem[];
  isLoading?: boolean;
}

const getTimeAgo = (timestamp: string) => {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  const minutesAgo = Math.max(
    Math.floor((Date.now() - date.getTime()) / (1000 * 60)),
    0
  );

  if (minutesAgo < 60) {
    return `Hace ${minutesAgo} min`;
  }

  if (minutesAgo < 120) {
    return 'Hace 1 hora';
  }

  if (minutesAgo < 1440) {
    return `Hace ${Math.floor(minutesAgo / 60)} horas`;
  }

  const days = Math.floor(minutesAgo / 1440);
  return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
};

const getTimeString = (timestamp: string) => {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return 'Sin hora';
  }

  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const activityTypeConfig = {
  reservation: {
    icon: Calendar,
    color: 'bg-purple-100 text-purple-600',
    badge: 'Reserva',
  },
  payment: {
    icon: DollarSign,
    color: 'bg-amber-100 text-amber-600',
    badge: 'Pago',
  },
  tracking: {
    icon: ClipboardCheck,
    color: 'bg-blue-100 text-blue-600',
    badge: 'Seguimiento',
  },
  client: {
    icon: UserPlus,
    color: 'bg-teal-100 text-teal-600',
    badge: 'Cliente',
  },
} as const;

export function RecentActivity({
  activities,
  isLoading = false,
}: RecentActivityProps) {
  const navigate = useNavigate();
  const highPriority = activities.filter((activity) => activity.importance === 'high').length;

  const handleViewAll = () => {
    navigate('/reservas');
  };

  return (
    <Card className="border-0 p-6 shadow-md">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-50 p-2">
            <Activity className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-gray-900">Actividad reciente</h3>
            <p className="text-sm text-gray-500">
              {isLoading ? 'Cargando...' : `${highPriority} acciones importantes`}
            </p>
          </div>
        </div>
        <button
          className="text-sm text-blue-600 transition-colors hover:text-blue-700"
          onClick={handleViewAll}
        >
          Ver todo
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-600">Cargando actividad...</p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-gray-600">No hay actividad reciente disponible.</p>
      ) : (
        <div className="space-y-3">
          {activities.map((activity, index) => {
            const typeConfig = activityTypeConfig[activity.type];

            return (
              <div key={activity.id}>
                <div
                  className={`cursor-pointer rounded-lg p-3 transition-colors hover:bg-gray-50 ${
                    activity.importance === 'high' ? 'border-l-2 border-l-blue-500' : ''
                  }`}
                  onClick={() => navigate(activity.href)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 rounded-lg p-2 ${typeConfig.color}`}>
                      <typeConfig.icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                        {activity.importance === 'high' && (
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="mb-1 text-xs text-gray-600">{activity.description}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400">{getTimeAgo(activity.timestamp)}</p>
                        <span className="text-xs text-gray-300">•</span>
                        <p className="text-xs text-gray-400">{getTimeString(activity.timestamp)}</p>
                      </div>
                    </div>

                    {activity.importance === 'high' && (
                      <div className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                        {typeConfig.badge}
                      </div>
                    )}
                  </div>
                </div>

                {index < activities.length - 1 && <div className="ml-12 border-b border-gray-100" />}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
