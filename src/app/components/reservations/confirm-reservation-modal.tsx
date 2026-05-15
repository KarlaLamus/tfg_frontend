import { CalendarDays, CheckCircle2, DoorOpen, PawPrint, TriangleAlert } from 'lucide-react';
import type { ReservationRecord } from '../../utils/reservations-api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface ConfirmReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reservation: ReservationRecord) => void;
  onEditReservation: (reservation: ReservationRecord) => void;
  reservation: ReservationRecord | null;
}

const normalizeRoomLabel = (value: string) => value.trim().toLowerCase();
const hasAssignedRoom = (roomLabel: string) =>
  normalizeRoomLabel(roomLabel) !== '' && normalizeRoomLabel(roomLabel) !== 'sin sala asignada';

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

export function ConfirmReservationModal({
  isOpen,
  onClose,
  onConfirm,
  onEditReservation,
  reservation,
}: ConfirmReservationModalProps) {
  const roomAssigned = reservation ? hasAssignedRoom(reservation.room) : false;

  const handleConfirm = () => {
    if (!reservation || !roomAssigned) {
      return;
    }

    onConfirm({
      ...reservation,
      status: 'confirmed',
      respondedAt: reservation.respondedAt || new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-3xl overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
        <DialogHeader className="border-b border-gray-100 px-6 py-5 text-left">
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            Confirmar reserva
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            La confirmacion respeta la sala o combinacion de salas ya asignada. Si necesitas
            cambiarla, hazlo desde editar reserva.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          {reservation ? (
            <>
              <div className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-500">Reserva</p>
                  <p className="font-medium text-gray-900">{reservation.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cliente</p>
                  <p className="font-medium text-gray-900">{reservation.client.name}</p>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                    <PawPrint className="h-4 w-4" />
                    Mascotas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {reservation.pets.map((pet) => (
                      <Badge
                        key={pet.id}
                        variant="outline"
                        className="border-gray-200 bg-white px-2.5 py-1 text-gray-700"
                      >
                        {pet.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                    <CalendarDays className="h-4 w-4" />
                    Fechas
                  </p>
                  <p className="text-sm text-gray-900">
                    {formatDate(reservation.checkIn)} al {formatDate(reservation.checkOut)}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                    <DoorOpen className="h-4 w-4" />
                    Sala asignada
                  </p>
                  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {roomAssigned ? reservation.room : 'Sin sala asignada'}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {roomAssigned
                        ? 'Si quieres mover la estancia a otra sala o repartir perros y gatos en salas distintas, hazlo desde editar reserva.'
                        : 'Esta reserva todavia no tiene sala asignada. Ve a editar reserva para asignarla antes de confirmar.'}
                    </p>
                  </div>
                </div>
              </div>

              {!roomAssigned ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="flex items-center gap-2 font-medium text-red-900">
                    <TriangleAlert className="h-4 w-4" />
                    No se puede confirmar esta reserva
                  </p>
                  <p className="mt-2 text-sm text-red-700">
                    Asigna una sala desde editar reserva antes de cambiar el estado a confirmada.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-sm text-blue-900">
                    Esta confirmacion mantendra{' '}
                    <span className="font-semibold">{reservation.room}</span> y el resto de la
                    configuracion actual de la reserva.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>

        <DialogFooter className="border-t border-gray-100 bg-gray-50 px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="border-gray-200">
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => reservation && onEditReservation(reservation)}
            disabled={!reservation}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            Ir a editar reserva
          </Button>
          <Button
            type="button"
            variant="gradient"
            onClick={handleConfirm}
            disabled={!reservation || !roomAssigned}
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirmar reserva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
