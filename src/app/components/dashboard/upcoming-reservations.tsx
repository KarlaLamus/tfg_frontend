import { Calendar, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

export interface UpcomingReservationItem {
  id: string;
  petName: string;
  ownerName: string;
  type: 'checkin' | 'checkout';
  date: string;
  room: string;
  status: 'confirmada' | 'pendiente';
  reservationCode: string;
}

interface UpcomingReservationsProps {
  reservations: UpcomingReservationItem[];
  isLoading?: boolean;
}

const getDateLabel = (dateString: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const reservationDate = new Date(`${dateString}T00:00:00`);
  reservationDate.setHours(0, 0, 0, 0);

  if (reservationDate.getTime() === today.getTime()) {
    return 'Hoy';
  }

  if (reservationDate.getTime() === tomorrow.getTime()) {
    return 'Mañana';
  }

  return reservationDate.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });
};

const groupByDate = (reservationList: UpcomingReservationItem[]) => {
  const groups: Record<string, UpcomingReservationItem[]> = {};

  reservationList.forEach((reservation) => {
    if (!groups[reservation.date]) {
      groups[reservation.date] = [];
    }
    groups[reservation.date].push(reservation);
  });

  return groups;
};

export function UpcomingReservations({
  reservations,
  isLoading = false,
}: UpcomingReservationsProps) {
  const navigate = useNavigate();
  const groupedReservations = groupByDate(reservations);
  const sortedDates = Object.keys(groupedReservations).sort();
  const todayIsoDate = new Date().toISOString().split('T')[0];
  const todayReservations = reservations.filter((reservation) => reservation.date === todayIsoDate);
  const checkins = todayReservations.filter((reservation) => reservation.type === 'checkin').length;
  const checkouts = todayReservations.filter((reservation) => reservation.type === 'checkout').length;

  const handleReservationClick = (reservation: UpcomingReservationItem) => {
    navigate(`/reservas/${reservation.reservationCode}`, {
      state: {
        returnTo: '/',
        returnLabel: 'Volver al dashboard',
      },
    });
  };

  const handleViewAll = () => {
    navigate('/reservas');
  };

  return (
    <Card className="border-0 p-6 shadow-md">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-gray-900">Próximas reservas</h3>
            <p className="text-sm text-gray-500">
              {isLoading ? 'Cargando...' : `Hoy: ${checkins} entradas • ${checkouts} salidas`}
            </p>
          </div>
        </div>
        <button
          className="text-sm text-blue-600 transition-colors hover:text-blue-700"
          onClick={handleViewAll}
        >
          Ver todas
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-600">Cargando próximas reservas...</p>
      ) : sortedDates.length === 0 ? (
        <p className="text-sm text-gray-600">No hay entradas ni salidas próximas.</p>
      ) : (
        <div className="space-y-4">
          {sortedDates.slice(0, 3).map((date) => {
            const dateReservations = groupedReservations[date];
            const dateLabel = getDateLabel(date);
            const isToday = date === todayIsoDate;
            const tomorrowIsoDate = (() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              return tomorrow.toISOString().split('T')[0];
            })();
            const isTomorrow = date === tomorrowIsoDate;

            return (
              <div key={date} className="space-y-2">
                <div className="flex items-center gap-2 pb-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <p
                    className={`text-xs font-medium ${
                      isToday ? 'text-red-600' : isTomorrow ? 'text-orange-600' : 'text-gray-600'
                    }`}
                  >
                    {dateLabel}
                  </p>
                  <div className="flex-1 border-b border-gray-200" />
                </div>

                {dateReservations.map((reservation) => (
                  <div
                    key={`${reservation.reservationCode}-${reservation.type}`}
                    className={`cursor-pointer rounded-lg border p-3 transition-all ${
                      isToday
                        ? 'border-red-200 bg-red-50 hover:bg-red-100'
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => handleReservationClick(reservation)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-lg p-2 ${
                          reservation.type === 'checkin' ? 'bg-green-100' : 'bg-amber-100'
                        }`}
                      >
                        {reservation.type === 'checkin' ? (
                          <ArrowDownRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-amber-600" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {reservation.petName}
                          </p>
                          <Badge
                            variant="secondary"
                            className={
                              reservation.status === 'confirmada'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }
                          >
                            {reservation.type === 'checkin' ? 'Entrada' : 'Salida'}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500">
                          {reservation.ownerName} • {reservation.room}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{reservation.reservationCode}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
