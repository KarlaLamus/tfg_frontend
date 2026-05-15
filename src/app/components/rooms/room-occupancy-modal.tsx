import { X, Calendar, Clock, User, PawPrint } from 'lucide-react';
import { Button } from '../ui/button';
import type { RoomRecord } from '../../utils/rooms-api';

interface RoomOccupancyModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomRecord | null;
}

export function RoomOccupancyModal({ isOpen, onClose, room }: RoomOccupancyModalProps) {
  if (!isOpen || !room) return null;

  const occupancyHistory = room.occupancyHistory ?? [];
  const upcomingReservations = room.upcomingReservations ?? [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const calculateDays = (checkIn: string, checkOut: string) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="mb-1 text-xl text-gray-900">Ocupación de sala {room.code}</h3>
              <p className="text-sm text-gray-600">
                Histórico y reservas futuras de esta sala
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 transition-colors hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            <div
              className={`rounded-lg border-2 p-4 ${
                room.occupied
                  ? 'border-red-300 bg-red-50'
                  : room.status === 'maintenance'
                    ? 'border-orange-300 bg-orange-50'
                    : 'border-green-300 bg-green-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-4 w-4 rounded-full ${
                    room.occupied
                      ? 'bg-red-500'
                      : room.status === 'maintenance'
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                  }`}
                />
                <div>
                  <p className="text-sm text-gray-600">Estado actual</p>
                  <p
                    className={`text-lg font-bold ${
                      room.occupied
                        ? 'text-red-700'
                        : room.status === 'maintenance'
                          ? 'text-orange-700'
                          : 'text-green-700'
                    }`}
                  >
                    {room.occupied
                      ? 'Ocupada actualmente'
                      : room.status === 'maintenance'
                        ? 'En mantenimiento'
                        : 'Disponible'}
                  </p>
                </div>
              </div>
            </div>

            {upcomingReservations.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <h4 className="font-medium text-gray-900">Reservas futuras</h4>
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                    {upcomingReservations.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {upcomingReservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="rounded-lg border border-blue-200 bg-blue-50 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{reservation.reservationCode}</p>
                          <p className="text-sm text-gray-600">
                            {calculateDays(reservation.checkIn, reservation.checkOut)} días
                          </p>
                        </div>
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                          Confirmada
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">{reservation.client}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <PawPrint className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">
                            {reservation.pet} ({reservation.species})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">Entrada: {formatDate(reservation.checkIn)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">Salida: {formatDate(reservation.checkOut)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {occupancyHistory.length > 0 ? (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-gray-600" />
                  <h4 className="font-medium text-gray-900">Histórico de ocupación</h4>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                    {occupancyHistory.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {occupancyHistory.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{reservation.reservationCode}</p>
                          <p className="text-sm text-gray-600">
                            {calculateDays(reservation.checkIn, reservation.checkOut)} días
                          </p>
                        </div>
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                          Completada
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">{reservation.client}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <PawPrint className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">
                            {reservation.pet} ({reservation.species})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">Entrada: {formatDate(reservation.checkIn)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">Salida: {formatDate(reservation.checkOut)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <Calendar className="h-8 w-8 text-gray-400" />
                </div>
                <h4 className="mb-2 text-gray-900">Sin histórico de ocupación</h4>
                <p className="text-sm text-gray-600">
                  Esta sala aún no ha sido utilizada para ninguna reserva
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <Button onClick={onClose} className="w-full bg-gray-600 text-white hover:bg-gray-700">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
