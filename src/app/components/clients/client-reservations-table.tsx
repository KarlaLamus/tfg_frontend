import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, Pencil, XCircle, PawPrint, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { DeleteConfirmationModal } from '../ui/delete-confirmation-modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  canCancelReservation,
  hasReservationActiveCheckIn,
} from '../../utils/reservations-api';

interface Reservation {
  id: string;
  pets: string[];
  checkIn: string;
  checkOut: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  amount: number;
  room: string;
}

interface ClientReservationOwner {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface ClientReservationPet {
  id: number;
  name: string;
  species: string;
  breed: string;
  age: number;
}

interface ClientReservationsTableProps {
  reservations: Reservation[];
  client: ClientReservationOwner;
  pets: ClientReservationPet[];
  onCreateReservation?: () => void;
  onEditReservation?: (reservation: Reservation) => void;
  onCancelReservation?: (reservationId: string) => void;
}

const ITEMS_PER_PAGE = 20;

const statusConfig = {
  pending: {
    label: 'Pendiente',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  confirmed: {
    label: 'Confirmada',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  in_progress: {
    label: 'En curso',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  completed: {
    label: 'Finalizada',
    className: 'bg-gray-50 text-gray-700 border-gray-200',
  },
  cancelled: {
    label: 'Cancelada',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
};

export function ClientReservationsTable({
  reservations,
  client,
  pets,
  onCreateReservation,
  onEditReservation,
  onCancelReservation,
}: ClientReservationsTableProps) {
  const navigate = useNavigate();
  const [reservationPendingCancel, setReservationPendingCancel] = useState<Reservation | null>(
    null
  );
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(reservations.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentReservations = reservations.slice(startIndex, endIndex);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleOpenReservationDetail = (reservation: Reservation) => {
    navigate(`/reservas/${reservation.id}`, {
      state: {
        returnTo: `/clientes/${client.id}`,
        returnLabel: 'Volver a cliente',
        reservation: {
          id: reservation.id,
          client: {
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone,
          },
          pets: reservation.pets.map((petName, index) => {
            const matchingPet = pets.find((pet) => pet.name === petName);

            return {
              id: matchingPet?.id ?? index + 1,
              name: petName,
              species: matchingPet?.species === 'Gato' ? 'Gato' : 'Perro',
              breed: matchingPet?.breed ?? 'Raza sin especificar',
              age: matchingPet?.age ?? 0,
            };
          }),
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          room: reservation.room,
          status: reservation.status,
          totalAmount: reservation.amount,
          notes: '',
          services: [],
          createdAt: reservation.checkIn,
        },
      },
    });
  };

  const handleViewReservation = (id: string) => {
    const reservation = reservations.find((item) => item.id === id);

    if (!reservation) {
      return;
    }

    handleOpenReservationDetail(reservation);
  };

  const handleEditReservation = (id: string) => {
    const reservation = reservations.find((item) => item.id === id);

    if (!reservation) {
      return;
    }

    onEditReservation?.(reservation);
  };

  const handleCancelReservation = (id: string) => {
    const reservation = reservations.find((item) => item.id === id);

    if (!reservation) {
      return;
    }

    setReservationPendingCancel(reservation);
  };

  const handleConfirmCancelReservation = () => {
    if (!reservationPendingCancel) {
      return;
    }

    onCancelReservation?.(reservationPendingCancel.id);
    setReservationPendingCancel(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-gray-900">Reservas del cliente</h3>

        {onCreateReservation && (
          <Button
            onClick={onCreateReservation}
            className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Crear reserva
          </Button>
        )}
      </div>

      {/* Tabla para desktop */}
      <Card className="hidden lg:block border-0 shadow-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-gray-700">ID Reserva</TableHead>
              <TableHead className="text-gray-700">Mascotas</TableHead>
              <TableHead className="text-gray-700">Entrada</TableHead>
              <TableHead className="text-gray-700">Salida</TableHead>
              <TableHead className="text-gray-700">Sala</TableHead>
              <TableHead className="text-gray-700">Estado</TableHead>
              <TableHead className="text-gray-700 text-right">Importe</TableHead>
              <TableHead className="text-gray-700 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentReservations.map((reservation) => (
              <TableRow
                key={reservation.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleOpenReservationDetail(reservation)}
              >
                <TableCell className="text-gray-900">{reservation.id}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-gray-700">
                    <PawPrint className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-sm">{reservation.pets.join(', ')}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-600">
                  {formatDate(reservation.checkIn)}
                </TableCell>
                <TableCell className="text-gray-600">
                  {formatDate(reservation.checkOut)}
                </TableCell>
                <TableCell className="text-gray-600 text-sm">{reservation.room}</TableCell>
                <TableCell>
                  <span
                    className={`inline-block px-3 py-1 text-xs rounded-full border ${
                      statusConfig[reservation.status].className
                    }`}
                  >
                    {statusConfig[reservation.status].label}
                  </span>
                </TableCell>
                <TableCell className="text-right text-gray-900">
                  €{reservation.amount.toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleViewReservation(reservation.id);
                      }}
                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      title="Ver reserva"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleEditReservation(reservation.id);
                      }}
                      className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      title="Editar reserva"
                      disabled={reservation.status === 'completed' || reservation.status === 'cancelled'}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCancelReservation(reservation.id);
                      }}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Cancelar reserva"
                      disabled={!canCancelReservation(reservation)}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Tarjetas para móvil/tablet */}
      <div className="lg:hidden space-y-3">
        {currentReservations.map((reservation) => (
          <Card
            key={reservation.id}
            className="cursor-pointer p-4 border-0 shadow-md"
            onClick={() => handleOpenReservationDetail(reservation)}
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">ID Reserva</p>
                  <p className="text-gray-900">{reservation.id}</p>
                </div>
                <span
                  className={`px-3 py-1 text-xs rounded-full border ${
                    statusConfig[reservation.status].className
                  }`}
                >
                  {statusConfig[reservation.status].label}
                </span>
              </div>

              {/* Mascotas */}
              <div>
                <p className="text-sm text-gray-500 mb-1">Mascotas</p>
                <div className="flex items-center gap-1.5 text-gray-700">
                  <PawPrint className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-sm">{reservation.pets.join(', ')}</span>
                </div>
              </div>

              {/* Fechas y Sala */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Entrada</p>
                  <p className="text-gray-900">{formatDate(reservation.checkIn)}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Salida</p>
                  <p className="text-gray-900">{formatDate(reservation.checkOut)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Sala</p>
                <p className="text-sm text-gray-900">{reservation.room}</p>
              </div>

              {/* Importe */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Importe total</span>
                  <span className="text-lg text-gray-900">
                    €{reservation.amount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleViewReservation(reservation.id);
                  }}
                  className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleEditReservation(reservation.id);
                  }}
                  className="flex-1 text-gray-600 hover:bg-gray-50"
                  disabled={reservation.status === 'completed' || reservation.status === 'cancelled'}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCancelReservation(reservation.id);
                  }}
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                  disabled={!canCancelReservation(reservation)}
                  title={
                    hasReservationActiveCheckIn(reservation)
                      ? 'Primero debes registrar el check-out para cancelar la reserva'
                      : 'Cancelar reserva'
                  }
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <Card className="border-0 p-4 shadow-md">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-gray-600">
              Mostrando {startIndex + 1} a {Math.min(endIndex, reservations.length)} de {reservations.length} reservas
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(safeCurrentPage - 1, 1))}
                disabled={safeCurrentPage === 1}
                className="h-9 w-full sm:w-auto"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <p className="text-center text-sm text-gray-600 sm:hidden">
                Página {safeCurrentPage} de {totalPages}
              </p>
              <div className="hidden items-center gap-1 sm:flex">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <Button
                    key={page}
                    variant={safeCurrentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={`h-9 w-9 p-0 ${
                      safeCurrentPage === page
                        ? 'bg-gradient-to-r from-blue-500 to-green-500 text-white'
                        : ''
                    }`}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(safeCurrentPage + 1, totalPages))}
                disabled={safeCurrentPage === totalPages}
                className="h-9 w-full sm:w-auto"
              >
                Siguiente
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {reservations.length === 0 && (
        <Card className="p-8 border-0 shadow-md text-center">
          <div className="max-w-sm mx-auto">
            <p className="text-sm text-gray-600">
              Este cliente aún no tiene reservas registradas
            </p>
          </div>
        </Card>
      )}

      <DeleteConfirmationModal
        isOpen={Boolean(reservationPendingCancel)}
        onClose={() => setReservationPendingCancel(null)}
        onConfirm={handleConfirmCancelReservation}
        title="Cancelar reserva"
        entityLabel="reserva"
        itemName={reservationPendingCancel?.id}
        description="La reserva permanecerá en el historial con estado cancelada."
        question={
          reservationPendingCancel
            ? `¿Seguro que quieres cancelar ${reservationPendingCancel.id}?`
            : undefined
        }
        confirmLabel="Cancelar reserva"
      />
    </div>
  );
}
