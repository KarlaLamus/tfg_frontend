import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { Plus, Home, CheckCircle, Wrench, DoorOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { DeleteConfirmationModal } from '../components/ui/delete-confirmation-modal';
import { RoomsFilters } from '../components/rooms/room-filters';
import { RoomCard } from '../components/rooms/room-card';
import { NewRoomModal, type RoomFormData } from '../components/rooms/new-room-modal';
import { ViewRoomModal } from '../components/rooms/view-room-modal';
import { EditRoomModal } from '../components/rooms/edit-room-modal';
import { RoomOccupancyModal } from '../components/rooms/room-occupancy-modal';
import { useAuth } from '../auth/auth-context';
import {
  fetchReservationsPageData,
  type ReservationRecord,
} from '../utils/reservations-api';
import {
  ROOMS_QUERY_KEY,
  createRoomRequest,
  deleteRoomRequest,
  fetchRoomsPageData,
  type RoomRecord,
  type RoomReservationSummary,
  updateRoomRequest,
} from '../utils/rooms-api';
import { useAppliedLocalReservationOverrides } from '../utils/reservation-local-overrides';
import {
  RESERVATION_FORM_ROOMS_QUERY_KEY,
  TRACKING_QUERY_KEY,
  syncDeletedRoomReferences,
} from '../utils/deletion-sync';

const RESERVATIONS_QUERY_KEY = ['reservations-page'];

const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const toStartOfDay = (value: string) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const normalizeRoomName = (value: string) => value.trim().toLowerCase();

const buildRoomReservationSummaries = (reservations: ReservationRecord[]) => {
  const groupedReservations = new Map<string, RoomReservationSummary[]>();

  reservations.forEach((reservation) => {
    if (!reservation.room || reservation.room === 'Sin sala asignada') {
      return;
    }

    const roomKey = normalizeRoomName(reservation.room);
    const existingSummaries = groupedReservations.get(roomKey) ?? [];
    const reservationSummaries = reservation.pets.map((pet, index) => ({
      id: reservation.numericId * 100 + index + 1,
      reservationCode: reservation.id,
      client: reservation.client.name,
      pet: pet.name,
      species: pet.species,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      status: reservation.status,
    }));

    groupedReservations.set(roomKey, [...existingSummaries, ...reservationSummaries]);
  });

  return groupedReservations;
};

export default function RoomsPage() {
  const { hasRole } = useAuth();
  const canManageRooms = hasRole(['admin']);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') ?? '');
  const [typeFilter, setTypeFilter] = useState<string>(() => searchParams.get('type') ?? 'all');
  const [sizeFilter, setSizeFilter] = useState<string>(() => searchParams.get('size') ?? 'all');
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get('status') ?? 'all');
  const [occupancyFilter, setOccupancyFilter] = useState<string>(
    () => searchParams.get('occupancy') ?? 'all'
  );
  const [isNewRoomModalOpen, setIsNewRoomModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isOccupancyModalOpen, setIsOccupancyModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [roomPendingDeleteId, setRoomPendingDeleteId] = useState<number | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);

  const {
    data: backendRooms = [],
    isLoading: isRoomsLoading,
    isError: isRoomsError,
    error: roomsError,
    refetch: refetchRooms,
  } = useQuery({
    queryKey: ROOMS_QUERY_KEY,
    queryFn: fetchRoomsPageData,
  });

  const {
    data: backendReservations = [],
    isLoading: isReservationsLoading,
    isError: isReservationsError,
    error: reservationsError,
    refetch: refetchReservations,
  } = useQuery({
    queryKey: RESERVATIONS_QUERY_KEY,
    queryFn: fetchReservationsPageData,
  });

  const reservations = useAppliedLocalReservationOverrides<ReservationRecord>(backendReservations);

  const rooms = useMemo(() => {
    const today = getToday();
    const reservationsByRoom = buildRoomReservationSummaries(reservations);

    return backendRooms.map((room) => {
      const relatedReservations = reservationsByRoom.get(normalizeRoomName(room.code)) ?? [];
      const currentReservationGuests = relatedReservations.filter((reservation) => {
        if (reservation.status === 'cancelled') {
          return false;
        }

        const checkIn = toStartOfDay(reservation.checkIn);
        const checkOut = toStartOfDay(reservation.checkOut);
        return checkIn <= today && checkOut >= today && reservation.status !== 'completed';
      });

      const currentGuests = currentReservationGuests.map((reservation) => ({
        petName: reservation.pet,
        ownerName: reservation.client,
        reservationCode: reservation.reservationCode,
      }));

      const upcomingReservations = relatedReservations
        .filter((reservation) => {
          if (reservation.status === 'cancelled') {
            return false;
          }

          return toStartOfDay(reservation.checkIn) > today;
        })
        .sort((firstReservation, secondReservation) =>
          firstReservation.checkIn.localeCompare(secondReservation.checkIn)
        );

      const occupancyHistory = relatedReservations
        .filter((reservation) => {
          if (reservation.status === 'cancelled') {
            return false;
          }

          return (
            reservation.status === 'completed' ||
            toStartOfDay(reservation.checkOut) < today
          );
        })
        .sort((firstReservation, secondReservation) =>
          secondReservation.checkOut.localeCompare(firstReservation.checkOut)
        );

      const derivedOccupancy = Math.max(room.currentOccupancy, currentGuests.length);

      return {
        ...room,
        currentGuests,
        currentOccupancy: derivedOccupancy,
        occupied: derivedOccupancy > 0,
        upcomingReservations,
        occupancyHistory,
      };
    });
  }, [backendRooms, reservations]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );
  const roomPendingDelete = useMemo(
    () => rooms.find((room) => room.id === roomPendingDeleteId) ?? null,
    [roomPendingDeleteId, rooms]
  );

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch =
        searchTerm === '' ||
        room.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.size.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = typeFilter === 'all' || room.type === typeFilter;
      const matchesSize = sizeFilter === 'all' || room.size === sizeFilter;
      const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
      const matchesOccupancy =
        occupancyFilter === 'all' ||
        (occupancyFilter === 'free' && !room.occupied) ||
        (occupancyFilter === 'occupied' && room.occupied);

      return (
        matchesSearch &&
        matchesType &&
        matchesSize &&
        matchesStatus &&
        matchesOccupancy
      );
    });
  }, [occupancyFilter, rooms, searchTerm, sizeFilter, statusFilter, typeFilter]);

  const totalRooms = rooms.length;
  const operationalRooms = rooms.filter((room) => room.status === 'operational').length;
  const maintenanceRooms = rooms.filter((room) => room.status === 'maintenance').length;
  const occupiedRooms = rooms.filter((room) => room.occupied).length;

  const handleNewRoom = () => {
    if (!canManageRooms) {
      return;
    }

    setIsNewRoomModalOpen(true);
  };

  const handleView = (room: RoomRecord) => {
    setSelectedRoomId(room.id);
    setIsViewModalOpen(true);
  };

  const handleEdit = (room: RoomRecord) => {
    if (!canManageRooms) {
      return;
    }

    setSelectedRoomId(room.id);
    setIsEditModalOpen(true);
  };

  const handleDelete = (room: RoomRecord) => {
    if (!canManageRooms) {
      return;
    }

    if (room.occupied) {
      toast.error('No se puede eliminar', {
        description:
          'Esta sala está actualmente ocupada. Debes finalizar la reserva antes de eliminarla.',
        duration: 5000,
      });
      return;
    }

    setRoomPendingDeleteId(room.id);
  };

  const handleViewOccupancy = (room: RoomRecord) => {
    setSelectedRoomId(room.id);
    setIsOccupancyModalOpen(true);
  };

  const handleConfirmDeleteRoom = async () => {
    if (!roomPendingDelete || !canManageRooms) {
      return;
    }

    setIsDeletingRoom(true);

    try {
      if (!roomPendingDelete.isLocalOnly) {
        await deleteRoomRequest(roomPendingDelete.id);
      }

      queryClient.setQueryData<RoomRecord[]>(ROOMS_QUERY_KEY, (currentRooms = []) =>
        currentRooms.filter((room) => room.id !== roomPendingDelete.id)
      );
      syncDeletedRoomReferences(queryClient, roomPendingDelete.code);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RESERVATION_FORM_ROOMS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['reservation-detail'] }),
        queryClient.invalidateQueries({ queryKey: TRACKING_QUERY_KEY }),
      ]);

      if (selectedRoomId === roomPendingDelete.id) {
        setSelectedRoomId(null);
        setIsViewModalOpen(false);
        setIsEditModalOpen(false);
        setIsOccupancyModalOpen(false);
      }

      toast.success('Sala eliminada', {
        description: 'Se ha eliminado correctamente.',
      });
      setRoomPendingDeleteId(null);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la sala';
      toast.error('No se pudo eliminar la sala', {
        description: message,
      });
    } finally {
      setIsDeletingRoom(false);
    }
  };

  const handleRoomSubmit = async (roomData: RoomFormData) => {
    if (!canManageRooms) {
      return;
    }

    const normalizedRoomName = roomData.code.trim();

    if (!normalizedRoomName) {
      toast.error('Falta el nombre de la sala', {
        description: 'Debes indicar un nombre antes de crear la sala.',
      });
      return;
    }

    const roomNameAlreadyExists = rooms.some(
      (room) => room.code.trim().toLowerCase() === normalizedRoomName.toLowerCase()
    );

    if (roomNameAlreadyExists) {
      toast.error('Ya existe una sala con ese nombre', {
        description: 'Usa un nombre diferente para identificar la sala.',
      });
      return;
    }

    try {
      const newRoom = await createRoomRequest({
        code: normalizedRoomName,
        type: roomData.type,
        size: roomData.size,
        capacity: roomData.capacity,
        pricePerDay: roomData.pricePerDay,
        status: roomData.status,
      });

      queryClient.setQueryData<RoomRecord[]>(ROOMS_QUERY_KEY, (currentRooms = []) => [
        ...currentRooms,
        newRoom,
      ]);
      await queryClient.invalidateQueries({ queryKey: RESERVATION_FORM_ROOMS_QUERY_KEY });
      setIsNewRoomModalOpen(false);
      toast.success('Sala creada correctamente', {
        description: `La sala ${newRoom.code} ha sido registrada exitosamente.`,
      });
    } catch (error) {
      toast.error('No se pudo crear la sala', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      });
      throw error;
    }
  };

  const handleEditSubmit = async (updatedRoom: RoomRecord) => {
    if (!canManageRooms) {
      return;
    }

    try {
      const savedRoom = await updateRoomRequest(updatedRoom.id, {
        code: updatedRoom.code,
        type: updatedRoom.type,
        size: updatedRoom.size,
        capacity: updatedRoom.capacity,
        pricePerDay: updatedRoom.pricePerDay ?? 0,
        status: updatedRoom.status,
      });

      queryClient.setQueryData<RoomRecord[]>(ROOMS_QUERY_KEY, (currentRooms = []) =>
        currentRooms.map((room) => (room.id === savedRoom.id ? savedRoom : room))
      );
      setIsEditModalOpen(false);
      toast.success('Sala actualizada', {
        description: `Los cambios en la sala ${savedRoom.code} se han guardado correctamente.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RESERVATION_FORM_ROOMS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['reservation-detail'] }),
        queryClient.invalidateQueries({ queryKey: TRACKING_QUERY_KEY }),
      ]);
    } catch (error) {
      toast.error('No se pudo actualizar la sala', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      });
      throw error;
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setSizeFilter('all');
    setStatusFilter('all');
    setOccupancyFilter('all');
    setSearchParams({});
  };

  if (isRoomsLoading || isReservationsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="mb-1 text-gray-900">Gestión de salas</h2>
            <p className="text-sm text-gray-600">Cargando salas y ocupación...</p>
          </div>
        </div>
        <Card className="border-0 p-8 shadow-md">
          <p className="text-sm text-gray-600">Cargando listado de salas...</p>
        </Card>
      </div>
    );
  }

  if (isRoomsError || isReservationsError) {
    const resolvedError = roomsError ?? reservationsError;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-1 text-gray-900">Gestión de salas</h2>
          <p className="text-sm text-gray-600">
            No se pudieron cargar los datos.{' '}
            {resolvedError instanceof Error ? resolvedError.message : 'Inténtalo de nuevo.'}
          </p>
        </div>
        <Card className="border-0 p-8 shadow-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">No se pudo conectar con el backend.</p>
            <Button
              variant="outline"
              onClick={() => {
                void refetchRooms();
                void refetchReservations();
              }}
              className="border-gray-200"
            >
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-1 text-gray-900">Gestión de salas</h2>
          <p className="text-sm text-gray-600">
            {canManageRooms
              ? 'Administra las salas disponibles para alojar mascotas durante su estancia en el hotel'
              : 'Consulta la ocupación actual y el histórico de las salas del centro.'}
          </p>
        </div>
        {canManageRooms ? (
          <Button
            onClick={handleNewRoom}
            className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva sala
          </Button>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Modo consulta para empleados
          </div>
        )}
      </div>

      {!canManageRooms && (
        <Card className="border-0 p-5 shadow-md">
          <p className="text-sm text-gray-600">
            El perfil empleado puede revisar ocupación e histórico, pero la creación, edición y
            eliminación de salas queda reservada a administración.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-gray-600">Salas totales</p>
              <p className="text-2xl font-bold text-gray-900">{totalRooms}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
              <Home className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-gray-600">Salas operativas</p>
              <p className="text-2xl font-bold text-green-600">{operationalRooms}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-gray-600">En mantenimiento</p>
              <p className={`text-2xl font-bold ${maintenanceRooms > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                {maintenanceRooms}
              </p>
            </div>
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                maintenanceRooms > 0
                  ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                  : 'bg-gradient-to-br from-gray-400 to-gray-500'
              }`}
            >
              <Wrench className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-gray-600">Ocupadas actualmente</p>
              <p className="text-2xl font-bold text-purple-600">{occupiedRooms}</p>
              <p className="mt-1 text-xs text-gray-500">{totalRooms - occupiedRooms} libres</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600">
              <DoorOpen className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>
      </div>

      <RoomsFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        sizeFilter={sizeFilter}
        onSizeChange={setSizeFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        occupancyFilter={occupancyFilter}
        onOccupancyChange={setOccupancyFilter}
        onClearFilters={handleClearFilters}
      />

      {filteredRooms.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onViewOccupancy={handleViewOccupancy}
              canManage={canManageRooms}
            />
          ))}
        </div>
      ) : (
        <Card className="border-0 p-12 text-center shadow-md">
          <div className="mx-auto max-w-md">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Home className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-gray-900">No se encontraron salas</h3>
            <p className="mb-6 text-sm text-gray-600">
              {searchTerm ||
              typeFilter !== 'all' ||
              sizeFilter !== 'all' ||
              statusFilter !== 'all' ||
              occupancyFilter !== 'all'
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Comienza creando la primera sala en el sistema'}
            </p>
            {!searchTerm &&
              typeFilter === 'all' &&
              sizeFilter === 'all' &&
              statusFilter === 'all' &&
              occupancyFilter === 'all' &&
              canManageRooms && (
                <Button
                  onClick={handleNewRoom}
                  className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva sala
                </Button>
              )}
          </div>
        </Card>
      )}

      <NewRoomModal
        isOpen={canManageRooms && isNewRoomModalOpen}
        onClose={() => setIsNewRoomModalOpen(false)}
        onSubmit={handleRoomSubmit}
      />

      <ViewRoomModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        room={selectedRoom}
      />

      <EditRoomModal
        key={selectedRoom ? `${selectedRoom.id}-${isEditModalOpen}` : 'room-edit-empty'}
        isOpen={canManageRooms && isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        room={selectedRoom}
        onSubmit={handleEditSubmit}
      />

      <RoomOccupancyModal
        isOpen={isOccupancyModalOpen}
        onClose={() => setIsOccupancyModalOpen(false)}
        room={selectedRoom}
      />

      <DeleteConfirmationModal
        isOpen={canManageRooms && roomPendingDelete !== null}
        onClose={() => setRoomPendingDeleteId(null)}
        onConfirm={handleConfirmDeleteRoom}
        title="Eliminar sala"
        entityLabel="sala"
        itemName={roomPendingDelete?.code}
        isDeleting={isDeletingRoom}
      />
    </div>
  );
}
