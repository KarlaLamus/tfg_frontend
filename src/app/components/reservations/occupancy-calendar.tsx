import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

interface Pet {
  id: number;
  name: string;
  species: string;
}

interface Client {
  id: number;
  name: string;
}

interface CheckData {
  fechaHora: string;
  empleadoId: number;
  observaciones: string;
}

interface Reservation {
  id: string;
  client: Client;
  pets: Pet[];
  checkIn: string;
  checkOut: string;
  room: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  totalAmount: number;
  checkinData?: CheckData | null;
  checkoutData?: CheckData | null;
}

interface OccupancyCalendarProps {
  reservations: Reservation[];
}

export function OccupancyCalendar({ reservations }: OccupancyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Obtener días del mes actual
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);

  // Navegar meses
  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Contar reservas activas por día
  const getReservationsForDay = (day: number) => {
    const dateToCheck = new Date(year, month, day);
    const dateString = dateToCheck.toISOString().split('T')[0];

    return reservations.filter((reservation) => {
      if (reservation.status === 'cancelled') return false;
      return reservation.checkIn <= dateString && reservation.checkOut >= dateString;
    });
  };

  // Obtener check-ins y check-outs del día
  const getActivityForDay = (day: number) => {
    const dateToCheck = new Date(year, month, day);
    const dateString = dateToCheck.toISOString().split('T')[0];

    const checkIns = reservations.filter(
      (r) => r.checkIn === dateString && r.status !== 'cancelled'
    ).length;
    const checkOuts = reservations.filter(
      (r) => r.checkOut === dateString && r.status !== 'cancelled'
    ).length;

    return { checkIns, checkOuts };
  };

  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  // Crear array de días incluyendo espacios vacíos
  const calendarDays = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  return (
    <Card className="border-0 p-4 shadow-md sm:p-6">
      <div className="space-y-4">
        {/* Header del calendario */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-green-500 text-white">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-gray-900">Calendario de ocupación</h3>
              <p className="text-sm text-gray-600">
                {monthNames[month]} {year}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={previousMonth}
              className="h-9 w-9 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={nextMonth}
              className="h-9 w-9 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-3 border-b border-gray-100 pb-2 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span>Baja ocupación (1-3)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span>Media ocupación (4-6)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
            <span>Alta ocupación (7+)</span>
          </div>
        </div>

        {/* Calendario */}
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
          {/* Nombres de los días */}
          <div className="mb-2 grid grid-cols-7 gap-1 sm:gap-2">
            {dayNames.map((dayName) => (
              <div
                key={dayName}
                className="py-2 text-center text-xs font-medium text-gray-600"
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="aspect-square"></div>;
              }

              const reservationsCount = getReservationsForDay(day).length;
              const { checkIns, checkOuts } = getActivityForDay(day);
              const isToday =
                isCurrentMonth && day === today.getDate();

              let bgColor = 'bg-white';
              if (reservationsCount > 0) {
                if (reservationsCount <= 3) {
                  bgColor = 'bg-green-50 border-green-200';
                } else if (reservationsCount <= 6) {
                  bgColor = 'bg-yellow-50 border-yellow-200';
                } else {
                  bgColor = 'bg-red-50 border-red-200';
                }
              }

              return (
                <div
                  key={day}
                  className={`aspect-square rounded-lg border p-1 sm:p-1.5 ${bgColor} ${
                    isToday ? 'ring-2 ring-blue-500' : 'border-gray-200'
                  } cursor-pointer transition-shadow hover:shadow-md`}
                >
                  <div className="flex h-full flex-col justify-between">
                    <div
                      className={`text-[11px] font-medium sm:text-xs ${
                        isToday ? 'text-blue-600' : 'text-gray-900'
                      }`}
                    >
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {reservationsCount > 0 && (
                        <div className="text-[10px] font-medium text-gray-700 sm:text-xs">
                          {reservationsCount} {reservationsCount === 1 ? 'reserva' : 'reservas'}
                        </div>
                      )}
                      <div className="flex gap-1 text-[10px] sm:text-xs">
                        {checkIns > 0 && (
                          <span className="text-green-600" title="Check-ins">
                            ↓{checkIns}
                          </span>
                        )}
                        {checkOuts > 0 && (
                          <span className="text-orange-600" title="Check-outs">
                            ↑{checkOuts}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>

        {/* Resumen del mes */}
        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {
                reservations.filter(
                  (r) =>
                    r.status !== 'cancelled' &&
                    new Date(r.checkIn).getMonth() === month
                ).length
              }
            </p>
            <p className="text-xs text-gray-600">Nuevas reservas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {
                reservations.filter(
                  (r) =>
                    r.status !== 'cancelled' &&
                    new Date(r.checkIn).getMonth() === month
                ).length
              }
            </p>
            <p className="text-xs text-gray-600">Check-ins</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">
              {
                reservations.filter(
                  (r) =>
                    r.status !== 'cancelled' &&
                    new Date(r.checkOut).getMonth() === month
                ).length
              }
            </p>
            <p className="text-xs text-gray-600">Check-outs</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {reservations.filter((r) => r.status === 'in_progress').length}
            </p>
            <p className="text-xs text-gray-600">En curso ahora</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
