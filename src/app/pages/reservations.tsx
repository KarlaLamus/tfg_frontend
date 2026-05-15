import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ReservationsFilters } from '../components/reservations/reservations-filters';
import { ReservationsTable } from '../components/reservations/reservations-table';
import { OccupancyCalendar } from '../components/reservations/occupancy-calendar';
import { smartSearch, searchById } from '../utils/search';
import { buildReturnNavigationState } from '../utils/return-navigation';
import {
  saveLocalReservationOverride,
  useAppliedLocalReservationOverrides,
} from '../utils/reservation-local-overrides';
import {
  fetchReservationsPageData,
  updateReservationStatusRequest,
  type ReservationRecord,
} from '../utils/reservations-api';

const isDateWithinReservation = (filterDate: string, reservation: ReservationRecord) => {
  if (!filterDate) {
    return true;
  }

  return reservation.checkIn <= filterDate && reservation.checkOut >= filterDate;
};

const getReservationRecencyTimestamp = (reservation: ReservationRecord) => {
  const primaryTimestamp = new Date(`${reservation.checkIn}T00:00:00`).getTime();

  if (!Number.isNaN(primaryTimestamp)) {
    return primaryTimestamp;
  }

  const createdAtTimestamp = new Date(reservation.createdAt).getTime();

  if (!Number.isNaN(createdAtTimestamp)) {
    return createdAtTimestamp;
  }

  return reservation.numericId;
};

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get('status') ?? 'all');
  const [dateFilter, setDateFilter] = useState(() => searchParams.get('date') ?? '');
  const [roomFilter, setRoomFilter] = useState(() => searchParams.get('room') ?? '');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>(
    () => searchParams.get('paymentStatus') ?? 'all'
  );
  const [showCalendar, setShowCalendar] = useState(false);
  const {
    data: backendReservations = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['reservations-page'],
    queryFn: fetchReservationsPageData,
  });

  const reservations = useAppliedLocalReservationOverrides<ReservationRecord>(backendReservations);

  const handleNewReservation = () => {
    navigate('/reservas/nueva', {
      state: buildReturnNavigationState('/reservas', 'Volver a reservas'),
    });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter('');
    setRoomFilter('');
    setPaymentStatusFilter('all');
    setSearchParams({});
  };

  const handleUpdateReservation = async (updatedReservation: ReservationRecord) => {
    const savedReservation = await updateReservationStatusRequest(
      updatedReservation.numericId,
      updatedReservation.status,
      updatedReservation.status === 'in_progress'
        ? updatedReservation.checkinData
        : updatedReservation.status === 'completed'
          ? updatedReservation.checkoutData
          : null
    );
    const nextReservation = savedReservation
      ? {
          ...updatedReservation,
          ...savedReservation,
          checkinData: updatedReservation.checkinData ?? savedReservation.checkinData,
          checkoutData: updatedReservation.checkoutData ?? savedReservation.checkoutData,
        }
      : updatedReservation;

    saveLocalReservationOverride(nextReservation);
    queryClient.setQueryData<ReservationRecord[]>(['reservations-page'], (currentReservations = []) =>
      currentReservations.map((reservation) =>
        reservation.id === nextReservation.id ? nextReservation : reservation
      )
    );
    queryClient.setQueryData<ReservationRecord>(
      ['reservation-detail', nextReservation.id],
      nextReservation
    );
    void queryClient.invalidateQueries({ queryKey: ['reservations-page'] });
    void queryClient.invalidateQueries({ queryKey: ['reservation-detail', nextReservation.id] });
  };

  const filteredReservations = useMemo(() => {
    return reservations
      .filter((reservation) => {
        const petNames = reservation.pets.map((pet) => pet.name).join(' ');
        const matchesSearch =
          searchById(searchTerm, reservation.id) ||
          smartSearch(searchTerm, reservation.client.name, petNames);
        const matchesStatus = statusFilter === 'all' || reservation.status === statusFilter;
        const matchesDate = isDateWithinReservation(dateFilter, reservation);
        const matchesRoom = !roomFilter || smartSearch(roomFilter, reservation.room);
        const matchesPaymentStatus =
          paymentStatusFilter === 'all' ||
          (paymentStatusFilter === 'paid'
            ? reservation.paymentStatus === 'paid'
            : reservation.paymentStatus !== 'paid');

        return (
          matchesSearch &&
          matchesStatus &&
          matchesDate &&
          matchesRoom &&
          matchesPaymentStatus
        );
      })
      .sort((leftReservation, rightReservation) => {
        const recencyDifference =
          getReservationRecencyTimestamp(rightReservation) -
          getReservationRecencyTimestamp(leftReservation);

        if (recencyDifference !== 0) {
          return recencyDifference;
        }

        return rightReservation.numericId - leftReservation.numericId;
      });
  }, [dateFilter, paymentStatusFilter, reservations, roomFilter, searchTerm, statusFilter]);

  if (isLoading) {
    return (
      <div className="min-w-0 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="mb-1 text-gray-900">Gestion de reservas</h2>
            <p className="text-sm text-gray-600">Cargando reservas del sistema...</p>
          </div>
        </div>
        <Card className="border-0 p-8 shadow-md">
          <p className="text-sm text-gray-600">Cargando listado de reservas...</p>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-w-0 space-y-6">
        <div>
          <h2 className="mb-1 text-gray-900">Gestion de reservas</h2>
          <p className="text-sm text-gray-600">
            No se pudieron cargar los datos.{' '}
            {error instanceof Error ? error.message : 'Intentalo de nuevo.'}
          </p>
        </div>
        <Card className="border-0 p-8 shadow-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">No se pudo conectar con el backend.</p>
            <Button variant="outline" onClick={() => refetch()} className="border-gray-200">
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-1 text-gray-900">Gestion de reservas</h2>
          <p className="text-sm text-gray-600">
            Administra las estancias de mascotas en el hotel, incluyendo check-in, check-out y
            seguimiento.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => setShowCalendar((value) => !value)}
            className={`w-full sm:w-auto ${
              showCalendar
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'border-gray-200'
            }`}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {showCalendar ? 'Ocultar calendario' : 'Ver calendario'}
          </Button>
          <Button
            onClick={handleNewReservation}
            className="w-full bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600 sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva reserva
          </Button>
        </div>
      </div>

      {showCalendar && <OccupancyCalendar reservations={reservations} />}

      <ReservationsFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        roomFilter={roomFilter}
        onRoomChange={setRoomFilter}
        paymentStatusFilter={paymentStatusFilter}
        onPaymentStatusChange={setPaymentStatusFilter}
        onClearFilters={handleClearFilters}
      />

      {filteredReservations.length > 0 ? (
        <ReservationsTable
          reservations={filteredReservations}
          onUpdateReservation={handleUpdateReservation}
        />
      ) : (
        <Card className="border-0 p-12 text-center shadow-md">
          <div className="mx-auto max-w-md">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <CalendarIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-gray-900">No se encontraron reservas</h3>
            <p className="mb-6 text-sm text-gray-600">
              {searchTerm ||
              statusFilter !== 'all' ||
              roomFilter ||
              dateFilter ||
              paymentStatusFilter !== 'all'
                ? 'Intenta ajustar los filtros de búsqueda.'
                : 'Comienza creando la primera reserva en el sistema.'}
            </p>
            {!searchTerm &&
              statusFilter === 'all' &&
              !roomFilter &&
              !dateFilter &&
              paymentStatusFilter === 'all' && (
              <Button
                onClick={handleNewReservation}
                className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nueva reserva
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
