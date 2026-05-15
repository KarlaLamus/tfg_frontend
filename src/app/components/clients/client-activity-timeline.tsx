import { Calendar, CreditCard, LogIn, LogOut, FileText } from 'lucide-react';
import { Card } from '../ui/card';

interface Activity {
  id: number;
  type: 'reservation' | 'payment' | 'checkin' | 'checkout' | 'tracking';
  description: string;
  date: string;
}

interface ClientActivityTimelineProps {
  activities: Activity[];
}

const activityConfig = {
  reservation: {
    icon: Calendar,
    color: 'bg-blue-100 text-blue-600',
  },
  payment: {
    icon: CreditCard,
    color: 'bg-green-100 text-green-600',
  },
  checkin: {
    icon: LogIn,
    color: 'bg-purple-100 text-purple-600',
  },
  checkout: {
    icon: LogOut,
    color: 'bg-orange-100 text-orange-600',
  },
  tracking: {
    icon: FileText,
    color: 'bg-indigo-100 text-indigo-600',
  },
};

export function ClientActivityTimeline({ activities }: ClientActivityTimelineProps) {
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
      }),
      time: date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  return (
    <Card className="p-6 border-0 shadow-md">
      <h3 className="text-gray-900 mb-4">Historial de actividad</h3>

      <div className="space-y-4">
        {activities.map((activity, index) => {
          const config = activityConfig[activity.type];
          const Icon = config.icon;
          const dateTime = formatDateTime(activity.date);
          const isLast = index === activities.length - 1;

          return (
            <div key={activity.id} className="relative flex gap-3">
              {/* Línea conectora */}
              {!isLast && (
                <div className="absolute left-[18px] top-[36px] w-[2px] h-[calc(100%+4px)] bg-gray-200" />
              )}

              {/* Icono */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 ${config.color}`}>
                <Icon className="w-4 h-4" />
              </div>

              {/* Contenido */}
              <div className="flex-1 pt-0.5">
                <p className="text-sm text-gray-900 mb-1">{activity.description}</p>
                <p className="text-xs text-gray-500">
                  {dateTime.date} · {dateTime.time}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {activities.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">
          No hay actividad reciente
        </p>
      )}
    </Card>
  );
}
