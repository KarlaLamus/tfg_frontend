import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, CalendarDays, DoorOpen, Euro, PawPrint } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { ROOMS_QUERY_KEY, fetchRoomsPageData } from '../../utils/rooms-api';
import {
  canChangeReservationStatusAfterCheckIn,
  fetchReservationsPageData,
  getReservationCheckOutRequiredMessage,
  hasReservationActiveCheckIn,
  type ReservationRecord,
} from '../../utils/reservations-api';
import { useAppliedLocalReservationOverrides } from '../../utils/reservation-local-overrides';
import {
  formatRoomTypeLabel,
  formatSpeciesGroupLabel,
  getPetsSpeciesGroup,
  getRoomAvailabilityForReservation,
  type ReservationAvailabilityRoom,
} from '../../utils/reservation-room-availability';

export interface EditableClientReservation {
  id: string;
  pets: string[];
  petDetails?: Array<{
    name: string;
    species: 'Perro' | 'Gato';
  }>;
  checkIn: string;
  checkOut: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  amount: number;
  room: string;
}

interface EditClientReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reservation: EditableClientReservation) => void;
  reservation: EditableClientReservation | null;
}

const statusOptions: Array<{
  value: EditableClientReservation['status'];
  label: string;
}> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'cancelled', label: 'Cancelada' },
];

export function EditClientReservationModal({
  isOpen,
  onClose,
  onSave,
  reservation,
}: EditClientReservationModalProps) {
  const [formData, setFormData] = useState(() => ({
    checkIn: reservation?.checkIn ?? '',
    checkOut: reservation?.checkOut ?? '',
    room: reservation?.room ?? '',
    amount: reservation ? reservation.amount.toString() : '',
    status: reservation?.status ?? ('pending' as EditableClientReservation['status']),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: rooms = [], isLoading: isLoadingRooms } = useQuery({
    queryKey: ROOMS_QUERY_KEY,
    queryFn: fetchRoomsPageData,
  });
  const { data: backendReservations = [], isLoading: isLoadingReservations } = useQuery({
    queryKey: ['reservations-page'],
    queryFn: fetchReservationsPageData,
  });
  const reservations = useAppliedLocalReservationOverrides<ReservationRecord>(backendReservations);
  const reservationPetDetails = useMemo(() => reservation?.petDetails ?? [], [reservation]);
  const selectedPetsSpeciesGroup = useMemo(
    () => getPetsSpeciesGroup(reservationPetDetails),
    [reservationPetDetails]
  );
  const availabilityRooms = useMemo<ReservationAvailabilityRoom[]>(
    () =>
      rooms.map((room) => ({
        id: room.id,
        label: room.code,
        type: room.type,
        capacity: room.capacity,
        status: room.status,
        currentOccupancy: room.currentOccupancy,
      })),
    [rooms]
  );
  const roomAvailability = useMemo(
    () =>
      getRoomAvailabilityForReservation({
        rooms: availabilityRooms,
        reservations,
        pets: reservationPetDetails,
        checkIn: formData.checkIn,
        checkOut: formData.checkOut,
        excludeReservationId: reservation?.id,
      }),
    [availabilityRooms, formData.checkIn, formData.checkOut, reservation?.id, reservationPetDetails, reservations]
  );
  const compatibleRooms = useMemo(
    () => roomAvailability.filter((room) => room.isSelectable),
    [roomAvailability]
  );
  const selectedRoomAvailability = useMemo(
    () => roomAvailability.find((room) => room.roomLabel === formData.room) ?? null,
    [formData.room, roomAvailability]
  );
  const roomAvailabilityReady = !isLoadingRooms && !isLoadingReservations;
  const hasActiveCheckIn = reservation ? hasReservationActiveCheckIn(reservation) : false;

  useEffect(() => {
    if (
      !roomAvailabilityReady ||
      !formData.checkIn ||
      !formData.checkOut ||
      selectedPetsSpeciesGroup === 'mixed'
    ) {
      return;
    }

    if (formData.room && !selectedRoomAvailability?.isSelectable) {
      setFormData((currentData) =>
        currentData.room
          ? {
              ...currentData,
              room: '',
        }
          : currentData
      );
    }
  }, [
    formData.checkIn,
    formData.checkOut,
    formData.room,
    roomAvailabilityReady,
    selectedPetsSpeciesGroup,
    selectedRoomAvailability,
  ]);

  if (!isOpen || !reservation) {
    return null;
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
      ...(field === 'checkIn' || field === 'checkOut'
        ? {
            room: '',
          }
        : {}),
    }));

    if (errors[field] || ((field === 'checkIn' || field === 'checkOut') && errors.room)) {
      setErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors[field];
        if (field === 'checkIn' || field === 'checkOut' || field === 'room') {
          delete nextErrors.room;
        }
        return nextErrors;
      });
    }
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const parsedAmount = Number(formData.amount);

    if (!formData.checkIn) {
      nextErrors.checkIn = 'La fecha de entrada es obligatoria';
    }

    if (!formData.checkOut) {
      nextErrors.checkOut = 'La fecha de salida es obligatoria';
    }

    if (
      formData.checkIn &&
      formData.checkOut &&
      new Date(`${formData.checkIn}T00:00:00`) >= new Date(`${formData.checkOut}T00:00:00`)
    ) {
      nextErrors.checkOut = 'La salida debe ser posterior a la entrada';
    }

    if (selectedPetsSpeciesGroup === 'mixed') {
      nextErrors.room =
        'No puedes mezclar perros y gatos en una misma reserva porque las salas están separadas por especie.';
    }

    if (!formData.room.trim()) {
      nextErrors.room = 'La sala es obligatoria';
    } else if (!selectedRoomAvailability?.isSelectable) {
      nextErrors.room =
        'La sala seleccionada no es compatible con las mascotas elegidas o no tiene plazas libres en esas fechas.';
    }

    if (!formData.amount.trim()) {
      nextErrors.amount = 'El importe es obligatorio';
    } else if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      nextErrors.amount = 'Introduce un importe válido';
    }

    if (
      reservation &&
      !canChangeReservationStatusAfterCheckIn(reservation, formData.status)
    ) {
      nextErrors.status = getReservationCheckOutRequiredMessage('cambiar el estado');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    onSave({
      ...reservation,
      checkIn: formData.checkIn,
      checkOut: formData.checkOut,
      room: formData.room.trim(),
      amount: Number(formData.amount),
      status: formData.status,
    });

    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 p-5">
          <div>
            <h3 className="text-gray-900">Editar reserva</h3>
            <p className="mt-1 text-sm text-gray-600">
              Ajusta las fechas, el estado y la sala de esta reserva.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[calc(100vh-10rem)] space-y-5 overflow-y-auto p-5">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-500">Reserva</p>
                  <p className="text-sm text-gray-900">{reservation.id}</p>
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                    <PawPrint className="h-4 w-4" />
                    Mascotas
                  </p>
                  <p className="text-sm text-gray-900">{reservation.pets.join(', ')}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <CalendarDays className="h-4 w-4" />
                  Entrada
                </label>
                <Input
                  type="date"
                  value={formData.checkIn}
                  onChange={(event) => handleChange('checkIn', event.target.value)}
                  className={errors.checkIn ? 'border-red-300' : ''}
                  disabled={isSubmitting}
                />
                {errors.checkIn && (
                  <p className="mt-1 text-sm text-red-600">{errors.checkIn}</p>
                )}
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <CalendarDays className="h-4 w-4" />
                  Salida
                </label>
                <Input
                  type="date"
                  value={formData.checkOut}
                  onChange={(event) => handleChange('checkOut', event.target.value)}
                  className={errors.checkOut ? 'border-red-300' : ''}
                  disabled={isSubmitting}
                />
                {errors.checkOut && (
                  <p className="mt-1 text-sm text-red-600">{errors.checkOut}</p>
                )}
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <DoorOpen className="h-4 w-4" />
                  Sala
                </label>
                <Select
                  value={formData.room}
                  onValueChange={(value) => handleChange('room', value)}
                  disabled={
                    isSubmitting ||
                    !roomAvailabilityReady ||
                    !formData.checkIn ||
                    !formData.checkOut ||
                    selectedPetsSpeciesGroup === 'mixed' ||
                    compatibleRooms.length === 0
                  }
                >
                  <SelectTrigger className={errors.room ? 'border-red-300' : ''}>
                    <SelectValue
                      placeholder={
                        !roomAvailabilityReady
                          ? 'Cargando salas...'
                          : compatibleRooms.length > 0
                            ? 'Selecciona una sala compatible'
                            : 'No hay salas compatibles disponibles'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {compatibleRooms.map((room) => (
                      <SelectItem key={room.roomId} value={room.roomLabel}>
                        {room.roomLabel} · {formatRoomTypeLabel(room.roomType)} · {room.freeSlots}{' '}
                        plaza{room.freeSlots === 1 ? '' : 's'} libre
                        {room.freeSlots === 1 ? '' : 's'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 text-xs">
                  {selectedPetsSpeciesGroup === 'mixed' ? (
                    <p className="text-amber-600">
                      No puedes mezclar perros y gatos en una misma reserva.
                    </p>
                  ) : !formData.checkIn || !formData.checkOut ? (
                    <p className="text-gray-500">
                      Define las fechas para comprobar disponibilidad en salas de{' '}
                      {formatSpeciesGroupLabel(selectedPetsSpeciesGroup)}.
                    </p>
                  ) : !roomAvailabilityReady ? (
                    <p className="text-gray-500">Comprobando disponibilidad real de salas...</p>
                  ) : compatibleRooms.length > 0 ? (
                    <p className="text-green-600">
                      Hay espacio en {compatibleRooms.length} sala
                      {compatibleRooms.length > 1 ? 's' : ''}: {' '}
                      {compatibleRooms.map((room) => room.roomLabel).join(', ')}.
                    </p>
                  ) : (
                    <p className="text-red-600">
                      No hay salas operativas con hueco para esta reserva en esas fechas.
                    </p>
                  )}
                </div>
                {errors.room && <p className="mt-1 text-sm text-red-600">{errors.room}</p>}
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Euro className="h-4 w-4" />
                  Importe
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(event) => handleChange('amount', event.target.value)}
                  className={errors.amount ? 'border-red-300' : ''}
                  disabled={isSubmitting}
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">Estado</label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    handleChange('status', value as EditableClientReservation['status'])
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((statusOption) => (
                      <SelectItem
                        key={statusOption.value}
                        value={statusOption.value}
                        disabled={
                          hasActiveCheckIn &&
                          !['in_progress'].includes(statusOption.value)
                        }
                      >
                        {statusOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.status && <p className="mt-1 text-sm text-amber-600">{errors.status}</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 p-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-gray-200"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
            >
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
