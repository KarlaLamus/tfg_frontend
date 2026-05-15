import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { buildReturnNavigationState } from '../../utils/return-navigation';

interface Reservation {
  id: string;
  checkIn: string;
  checkOut: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  room: string;
}

interface PetReservationsTableProps {
  reservations: Reservation[];
  petId: number;
  petName: string;
  petSpecies: 'Perro' | 'Gato';
  owner: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
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

export function PetReservationsTable({
  reservations,
  petId,
  petName,
  petSpecies,
  owner,
}: PetReservationsTableProps) {
  const navigate = useNavigate();
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

  const handleViewReservation = (reservation: Reservation) => {
    navigate(`/reservas/${reservation.id}`, {
      state: {
        ...buildReturnNavigationState(`/mascotas/${petId}`, 'Volver a mascota'),
        reservation: {
          id: reservation.id,
          client: owner,
          pets: [
            {
              id: petId,
              name: petName,
              species: petSpecies,
              breed: '',
              age: 0,
            },
          ],
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          room: reservation.room,
          status: reservation.status,
          totalAmount: 0,
          notes: '',
          services: [],
          createdAt: reservation.checkIn,
        },
      },
    });
  };

  return (
    <div className="space-y-4" data-pet-id={petId}>
      <h3 className="text-gray-900">Historial de estancias</h3>

      {/* Tabla para desktop */}
      <Card className="hidden lg:block border-0 shadow-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-gray-700">ID Reserva</TableHead>
              <TableHead className="text-gray-700">Fecha entrada</TableHead>
              <TableHead className="text-gray-700">Fecha salida</TableHead>
              <TableHead className="text-gray-700">Estado</TableHead>
              <TableHead className="text-gray-700">Sala / Box</TableHead>
              <TableHead className="text-gray-700 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentReservations.map((reservation) => (
              <TableRow key={reservation.id} className="hover:bg-gray-50">
                <TableCell className="text-gray-900">{reservation.id}</TableCell>
                <TableCell className="text-gray-600">
                  {formatDate(reservation.checkIn)}
                </TableCell>
                <TableCell className="text-gray-600">
                  {formatDate(reservation.checkOut)}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-block px-3 py-1 text-xs rounded-full border ${
                      statusConfig[reservation.status].className
                    }`}
                  >
                    {statusConfig[reservation.status].label}
                  </span>
                </TableCell>
                <TableCell className="text-gray-600">{reservation.room}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewReservation(reservation)}
                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      title="Ver reserva"
                    >
                      <Eye className="w-4 h-4" />
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
          <Card key={reservation.id} className="p-4 border-0 shadow-md">
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

              {/* Fechas */}
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

              {/* Sala */}
              <div>
                <p className="text-sm text-gray-500 mb-1">Sala / Box</p>
                <p className="text-sm text-gray-900">{reservation.room}</p>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewReservation(reservation)}
                  className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver reserva
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
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600">
              Esta mascota aún no tiene reservas registradas
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
