import { Eye, Pencil, Trash2, Calendar, Dog, Cat, Users, PawPrint } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { RoomTypeBadge } from './room-type-badge';
import { RoomSizeBadge } from './room-size-badge';
import { RoomStatusBadge } from './room-status-badge';
import type { RoomRecord } from '../../utils/rooms-api';

interface RoomCardProps {
  room: RoomRecord;
  onView: (room: RoomRecord) => void;
  onEdit: (room: RoomRecord) => void;
  onDelete: (room: RoomRecord) => void;
  onViewOccupancy: (room: RoomRecord) => void;
  canManage?: boolean;
}

export function RoomCard({
  room,
  onView,
  onEdit,
  onDelete,
  onViewOccupancy,
  canManage = true,
}: RoomCardProps) {
  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);

  const handleView = () => {
    onView(room);
  };

  const handleEdit = () => {
    onEdit(room);
  };

  const handleDelete = () => {
    onDelete(room);
  };

  const handleViewOccupancy = () => {
    onViewOccupancy(room);
  };

  // Validaciones defensivas
  const currentGuests = room.currentGuests || [];
  const currentOccupancy = room.currentOccupancy || 0;
  const capacity = room.capacity || 1;

  const isAvailable = room.status === 'operational' && !room.occupied;
  const hasSpace = currentOccupancy < capacity && room.status === 'operational';
  const occupancyPercentage = (currentOccupancy / capacity) * 100;

  return (
    <Card
      className={`p-5 border-0 shadow-md hover:shadow-lg transition-shadow ${
        room.status === 'maintenance'
          ? 'bg-orange-50/30 border-l-4 border-l-orange-500'
          : room.occupied
          ? hasSpace
            ? 'bg-yellow-50/20 border-l-4 border-l-yellow-500'
            : 'bg-red-50/20 border-l-4 border-l-red-400'
          : 'bg-green-50/20 border-l-4 border-l-green-400'
      }`}
    >
      <div className="space-y-4">
        {/* Header con icono y código */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                room.type === 'dog' ? 'bg-blue-100' : 'bg-purple-100'
              }`}
            >
              {room.type === 'dog' ? (
                <Dog className="w-6 h-6 text-blue-600" />
              ) : (
                <Cat className="w-6 h-6 text-purple-600" />
              )}
            </div>
            <div>
              <h4 className="text-gray-900 font-bold text-lg">{room.code}</h4>
              <p className="text-xs text-gray-500">ID: {room.id}</p>
            </div>
          </div>
          <RoomSizeBadge size={room.size} variant="sm" />
        </div>

        {/* Badges de información */}
        <div className="flex flex-wrap gap-2">
          <RoomTypeBadge type={room.type} size="sm" />
          <RoomStatusBadge status={room.status} size="sm" />
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
            {room.pricePerDay != null ? `${formatAmount(room.pricePerDay)}/día` : 'Precio pendiente'}
          </span>
        </div>

        {/* Barra de ocupación */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-600" />
              <p className="text-xs font-medium text-gray-700">Ocupación</p>
            </div>
            <p className="text-sm font-bold text-gray-900">
              {room.currentOccupancy}/{room.capacity}
            </p>
          </div>
          
          {/* Barra de progreso */}
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                occupancyPercentage === 0
                  ? 'bg-gray-300'
                  : occupancyPercentage < 50
                  ? 'bg-green-500'
                  : occupancyPercentage < 100
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${occupancyPercentage}%` }}
            ></div>
          </div>
          
          <p className="text-xs text-gray-500 mt-1">
            {room.status === 'maintenance'
              ? 'En mantenimiento'
              : room.currentOccupancy === 0
              ? 'Sala libre'
              : room.currentOccupancy === room.capacity
              ? 'Capacidad completa'
              : `${room.capacity - room.currentOccupancy} plaza${room.capacity - room.currentOccupancy > 1 ? 's' : ''} disponible${room.capacity - room.currentOccupancy > 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Mascotas actuales */}
        {currentGuests.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <PawPrint className="w-4 h-4 text-blue-600" />
              <p className="text-xs font-medium text-blue-900">Mascotas alojadas</p>
            </div>
            <div className="space-y-1.5">
              {currentGuests.map((guest, index) => (
                <div key={index} className="text-xs">
                  <p className="font-medium text-gray-900">{guest.petName}</p>
                  <p className="text-gray-600">{guest.ownerName}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado visual */}
        <div
          className={`p-3 rounded-lg border ${
            isAvailable
              ? 'bg-green-50 border-green-200'
              : room.status === 'maintenance'
              ? 'bg-orange-50 border-orange-200'
              : hasSpace
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-0.5">Estado</p>
              <p
                className={`text-sm font-medium ${
                  isAvailable
                    ? 'text-green-700'
                    : room.status === 'maintenance'
                    ? 'text-orange-700'
                    : hasSpace
                    ? 'text-yellow-700'
                    : 'text-red-700'
                }`}
              >
                {isAvailable
                  ? 'Disponible'
                  : room.status === 'maintenance'
                  ? 'Mantenimiento'
                  : hasSpace
                  ? 'Ocupada parcial'
                  : 'Ocupada completa'}
              </p>
            </div>
            <div
              className={`w-3 h-3 rounded-full ${
                isAvailable
                  ? 'bg-green-500'
                  : room.status === 'maintenance'
                  ? 'bg-orange-500'
                  : hasSpace
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
            ></div>
          </div>
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
          <Button
            variant="outline"
            size="sm"
            onClick={handleView}
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Eye className="w-4 h-4 mr-2" />
            Ver
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewOccupancy}
            className="text-purple-600 border-purple-200 hover:bg-purple-50"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Histórico
          </Button>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="text-gray-600 hover:bg-gray-50"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </Button>
          )}
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
