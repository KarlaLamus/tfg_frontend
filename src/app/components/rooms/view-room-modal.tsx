import { X, Home, Ruler, Tag, CheckCircle, Wrench, Users, PawPrint } from 'lucide-react';
import { Button } from '../ui/button';
import { RoomTypeBadge } from './room-type-badge';
import { RoomSizeBadge } from './room-size-badge';
import { RoomStatusBadge } from './room-status-badge';
import type { RoomRecord } from '../../utils/rooms-api';

interface ViewRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: RoomRecord | null;
}

export function ViewRoomModal({ isOpen, onClose, room }: ViewRoomModalProps) {
  if (!isOpen || !room) return null;

  const isAvailable = room.status === 'operational' && !room.occupied;
  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);

  const sizeLabels = {
    S: 'Pequeña',
    M: 'Mediana',
    L: 'Grande',
  };

  const typeLabels = {
    dog: 'Perros',
    cat: 'Gatos',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-gray-900 text-xl mb-1">Detalles de la sala</h3>
              <p className="text-sm text-gray-600">
                Información completa de la sala {room.code}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {/* Nombre e ID */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-5 border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Nombre de la sala</p>
                  <p className="text-3xl font-bold text-gray-900">{room.code}</p>
                  <p className="text-xs text-gray-500 mt-2">ID: {room.id}</p>
                </div>
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center shadow-sm">
                  <Home className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Estado general */}
            <div
              className={`p-4 rounded-lg border-2 ${
                isAvailable
                  ? 'bg-green-50 border-green-300'
                  : room.status === 'maintenance'
                  ? 'bg-orange-50 border-orange-300'
                  : 'bg-red-50 border-red-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full ${
                    isAvailable
                      ? 'bg-green-500'
                      : room.status === 'maintenance'
                      ? 'bg-orange-500'
                      : 'bg-red-500'
                  }`}
                ></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Estado actual</p>
                  <p
                    className={`text-lg font-bold ${
                      isAvailable
                        ? 'text-green-700'
                        : room.status === 'maintenance'
                        ? 'text-orange-700'
                        : 'text-red-700'
                    }`}
                  >
                    {isAvailable
                      ? 'Disponible para ocupar'
                      : room.status === 'maintenance'
                      ? 'En mantenimiento'
                      : 'Ocupada actualmente'}
                  </p>
                </div>
              </div>
            </div>

            {/* Características */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tipo */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Tag className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Tipo de sala</p>
                </div>
                <p className="text-lg font-bold text-gray-900 mb-2">{typeLabels[room.type]}</p>
                <RoomTypeBadge type={room.type} size="md" />
              </div>

              {/* Tamaño */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Ruler className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Tamaño</p>
                </div>
                <p className="text-lg font-bold text-gray-900 mb-2">{sizeLabels[room.size]}</p>
                <RoomSizeBadge size={room.size} variant="md" />
              </div>

              {/* Estado operativo */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      room.status === 'operational' ? 'bg-green-100' : 'bg-orange-100'
                    }`}
                  >
                    {room.status === 'operational' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Wrench className="w-5 h-5 text-orange-600" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-700">Estado operativo</p>
                </div>
                <p className="text-lg font-bold text-gray-900 mb-2">
                  {room.status === 'operational' ? 'Operativa' : 'Mantenimiento'}
                </p>
                <RoomStatusBadge status={room.status} size="md" />
              </div>

              {/* Capacidad */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Capacidad</p>
                </div>
                <p className="text-lg font-bold text-gray-900 mb-2">
                  {room.currentOccupancy} / {room.capacity} mascotas
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      room.currentOccupancy === 0
                        ? 'bg-gray-300'
                        : room.currentOccupancy < room.capacity * 0.5
                        ? 'bg-green-500'
                        : room.currentOccupancy < room.capacity
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${(room.currentOccupancy / room.capacity) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <span className="text-base font-semibold text-emerald-600">€</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700">Precio diario</p>
                </div>
                <p className="text-lg font-bold text-gray-900 mb-2">
                  {room.pricePerDay != null ? formatAmount(room.pricePerDay) : 'No disponible'}
                </p>
                <p className="text-sm text-gray-500">
                  Valor configurado en la base de datos para esta sala.
                </p>
              </div>
            </div>

            {/* Mascotas alojadas actualmente */}
            {room.currentGuests.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-4">
                  <PawPrint className="w-5 h-5 text-blue-600" />
                  <h4 className="font-medium text-blue-900">
                    Mascotas alojadas actualmente ({room.currentGuests.length})
                  </h4>
                </div>
                <div className="space-y-3">
                  {room.currentGuests.map((guest, index) => (
                    <div
                      key={index}
                      className="bg-white rounded-lg p-3 border border-blue-100"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{guest.petName}</p>
                          <p className="text-sm text-gray-600">{guest.ownerName}</p>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          {guest.reservationCode}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button onClick={onClose} className="w-full bg-gray-600 hover:bg-gray-700 text-white">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
