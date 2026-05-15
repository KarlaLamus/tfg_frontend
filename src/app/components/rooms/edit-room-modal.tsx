import { useEffect, useState } from 'react';
import { X, Home, Ruler, Tag, Users, Euro } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { RoomRecord } from '../../utils/rooms-api';

interface EditRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (roomData: RoomRecord) => Promise<void> | void;
  room: RoomRecord | null;
}

export function EditRoomModal({ isOpen, onClose, onSubmit, room }: EditRoomModalProps) {
  const [type, setType] = useState<'dog' | 'cat'>(() => room?.type ?? 'dog');
  const [size, setSize] = useState<'S' | 'M' | 'L'>(() => room?.size ?? 'M');
  const [capacity, setCapacity] = useState(() => String(room?.capacity ?? 1));
  const [pricePerDay, setPricePerDay] = useState(() =>
    room?.pricePerDay != null ? String(room.pricePerDay) : '0'
  );
  const [status, setStatus] = useState<'operational' | 'maintenance'>(
    () => room?.status ?? 'operational'
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !room) return null;

  useEffect(() => {
    if (!room || !isOpen) {
      return;
    }

    setType(room.type);
    setSize(room.size);
    setCapacity(String(room.capacity));
    setPricePerDay(room.pricePerDay != null ? String(room.pricePerDay) : '0');
    setStatus(room.status);
    setErrors({});
    setIsSubmitting(false);
  }, [isOpen, room]);

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const parsedCapacity = Number(capacity);
    const parsedPrice = Number(pricePerDay.replace(',', '.'));

    if (!capacity.trim()) {
      nextErrors.capacity = 'La capacidad es obligatoria';
    } else if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
      nextErrors.capacity = 'Introduce una capacidad valida mayor que 0';
    }

    if (!pricePerDay.trim()) {
      nextErrors.pricePerDay = 'El precio diario es obligatorio';
    } else if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      nextErrors.pricePerDay = 'Introduce un precio diario valido';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const updatedRoom: RoomRecord = {
      ...room,
      type,
      size,
      capacity: Number(capacity),
      pricePerDay: Number(pricePerDay.replace(',', '.')),
      status,
    };

    setIsSubmitting(true);

    try {
      await onSubmit(updatedRoom);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-gray-900 text-xl mb-1">Editar sala</h3>
              <p className="text-sm text-gray-600">
                Modifica la información de la sala {room.code}
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form onSubmit={handleSubmit} className="space-y-5" id="edit-room-form">
            {/* Nombre de la sala (solo lectura) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600" />
                Nombre de la sala
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={room.code}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    No editable
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                El nombre actual se muestra como referencia
              </p>
            </div>

            {/* Tipo de sala */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <Home className="w-4 h-4 text-purple-600" />
                Tipo de sala <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('dog')}
                  disabled={isSubmitting}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    type === 'dog'
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-2xl ${
                        type === 'dog' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}
                    >
                      🐕
                    </div>
                    <div>
                      <p className={`font-medium ${type === 'dog' ? 'text-blue-900' : 'text-gray-900'}`}>
                        Perros
                      </p>
                      <p className="text-xs text-gray-600">Salas serie P</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setType('cat')}
                  disabled={isSubmitting}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    type === 'cat'
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-2xl ${
                        type === 'cat' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}
                    >
                      🐱
                    </div>
                    <div>
                      <p className={`font-medium ${type === 'cat' ? 'text-blue-900' : 'text-gray-900'}`}>
                        Gatos
                      </p>
                      <p className="text-xs text-gray-600">Salas serie G</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Tamaño */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-green-600" />
                Tamaño <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSize('S')}
                  disabled={isSubmitting}
                  className={`p-3 border-2 rounded-lg text-center transition-all ${
                    size === 'S'
                      ? 'border-green-500 bg-green-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className={`font-medium mb-0.5 ${size === 'S' ? 'text-green-900' : 'text-gray-900'}`}>
                    S
                  </p>
                  <p className="text-xs text-gray-600">Pequeña</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSize('M')}
                  disabled={isSubmitting}
                  className={`p-3 border-2 rounded-lg text-center transition-all ${
                    size === 'M'
                      ? 'border-green-500 bg-green-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className={`font-medium mb-0.5 ${size === 'M' ? 'text-green-900' : 'text-gray-900'}`}>
                    M
                  </p>
                  <p className="text-xs text-gray-600">Mediana</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSize('L')}
                  disabled={isSubmitting}
                  className={`p-3 border-2 rounded-lg text-center transition-all ${
                    size === 'L'
                      ? 'border-green-500 bg-green-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className={`font-medium mb-0.5 ${size === 'L' ? 'text-green-900' : 'text-gray-900'}`}>
                    L
                  </p>
                  <p className="text-xs text-gray-600">Grande</p>
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    Capacidad real <span className="text-red-500">*</span>
                  </span>
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={capacity}
                  onChange={(event) => {
                    setCapacity(event.target.value);

                    if (errors.capacity) {
                      setErrors((currentErrors) => {
                        const nextErrors = { ...currentErrors };
                        delete nextErrors.capacity;
                        return nextErrors;
                      });
                    }
                  }}
                  disabled={isSubmitting}
                  className={errors.capacity ? 'border-red-500' : ''}
                />
                {errors.capacity && <p className="mt-1 text-sm text-red-500">{errors.capacity}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  <span className="flex items-center gap-2">
                    <Euro className="h-4 w-4 text-green-600" />
                    Precio diario <span className="text-red-500">*</span>
                  </span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricePerDay}
                  onChange={(event) => {
                    setPricePerDay(event.target.value);

                    if (errors.pricePerDay) {
                      setErrors((currentErrors) => {
                        const nextErrors = { ...currentErrors };
                        delete nextErrors.pricePerDay;
                        return nextErrors;
                      });
                    }
                  }}
                  disabled={isSubmitting}
                  className={errors.pricePerDay ? 'border-red-500' : ''}
                />
                {errors.pricePerDay && (
                  <p className="mt-1 text-sm text-red-500">{errors.pricePerDay}</p>
                )}
              </div>
            </div>

            {/* Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Estado operativo
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('operational')}
                  disabled={isSubmitting}
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    status === 'operational'
                      ? 'border-green-500 bg-green-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        status === 'operational' ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    <p className={`font-medium ${status === 'operational' ? 'text-green-900' : 'text-gray-900'}`}>
                      Operativa
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 ml-5">Lista para usar</p>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('maintenance')}
                  disabled={isSubmitting}
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    status === 'maintenance'
                      ? 'border-orange-500 bg-orange-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        status === 'maintenance' ? 'bg-orange-500' : 'bg-gray-300'
                      }`}
                    />
                    <p className={`font-medium ${status === 'maintenance' ? 'text-orange-900' : 'text-gray-900'}`}>
                      Mantenimiento
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 ml-5">En reparación</p>
                </button>
              </div>
            </div>

            {room.occupied && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Nota:</strong> Esta sala está actualmente ocupada. Los cambios se aplicarán pero no afectarán a la reserva actual.
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Footer con botones */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="edit-room-form"
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
