import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { Plus, Search, ArrowLeft, AlertTriangle, Dog, Cat, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/auth-context';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { PetInfoCard } from '../components/tracking/pet-info-card';
import { TrackingFilters } from '../components/tracking/tracking-filters';
import { TrackingTimeline } from '../components/tracking/tracking-timeline';
import {
  NewTrackingModal,
  type TrackingFormData,
} from '../components/tracking/new-tracking-modal';
import {
  EditTrackingModal,
  type EditTrackingFormData,
} from '../components/tracking/edit-tracking-modal';
import type { EditablePet } from '../components/pets/edit-pet-modal';
import { ImageWithFallback } from '../components/noImg/ImageWithFallback';
import { EMPLOYEES_QUERY_KEY, fetchEmployeesPageData } from '../utils/employees-api';
import { useAppliedLocalPetChanges } from '../utils/pet-local-overrides';
import { fetchPetsPageData, PETS_QUERY_KEY } from '../utils/pets-api';
import { useAppliedLocalReservationOverrides } from '../utils/reservation-local-overrides';
import { RESERVATIONS_QUERY_KEY } from '../utils/deletion-sync';
import { fetchReservationsPageData, type ReservationRecord } from '../utils/reservations-api';
import { searchById, smartSearch } from '../utils/search';
import {
  createTrackingRequest,
  deleteTrackingRequest,
  fetchTrackingPageData,
  TRACKING_QUERY_KEY,
  type TrackingHostedPet,
  type TrackingRecord,
  updateTrackingRequest,
} from '../utils/tracking-api';

const hasIncident = (record: TrackingRecord) =>
  record.incidents !== null && record.incidents.trim() !== '';

const normalizeComparableText = (value?: string | null) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const toLocalDateKey = (value?: string | Date | null) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value.split('T')[0] ?? '' : '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const startOfLocalDay = (value?: string | Date | null) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const matchesHostedPetSearch = (searchValue: string, pet: TrackingHostedPet) => {
  const normalizedSearch = normalizeComparableText(searchValue);

  if (!normalizedSearch) {
    return true;
  }

  return (
    smartSearch(
      searchValue,
      pet.name,
      pet.client.name,
      pet.reservation.room,
      pet.reservation.id,
      pet.breed,
      pet.species
    ) ||
    searchById(searchValue, pet.reservation.id) ||
    [
      pet.name,
      pet.client.name,
      pet.reservation.room,
      pet.reservation.id,
      pet.breed,
      pet.species,
    ].some((candidate) => normalizeComparableText(candidate).includes(normalizedSearch))
  );
};

const getTrackablePetSortTimestamp = (pet: TrackingHostedPet) => {
  return (
    startOfLocalDay(pet.lastTracking?.date)?.getTime() ??
    startOfLocalDay(pet.reservation.checkIn)?.getTime() ??
    pet.reservation.numericId
  );
};

const getReservationPetDetails = (
  reservationPetId: number,
  petsById: Map<number, EditablePet>
) => {
  return petsById.get(reservationPetId) ?? null;
};

const mergeTrackablePetWithDetailedPet = (
  pet: TrackingHostedPet,
  detailedPet: EditablePet | null
): TrackingHostedPet => {
  if (!detailedPet) {
    return pet;
  }

  return {
    ...pet,
    name: detailedPet.name?.trim() || pet.name,
    species: detailedPet.species || pet.species,
    breed: detailedPet.breed?.trim() || pet.breed,
    sex: detailedPet.sex?.trim() || pet.sex,
    neutered:
      detailedPet.neutered === 'Si'
        ? true
        : detailedPet.neutered === 'No'
          ? false
          : pet.neutered,
    photoUrl: detailedPet.photoUrl?.trim() || pet.photoUrl || '',
    observations: detailedPet.observations?.trim() || pet.observations,
  };
};

const buildTrackablePetFromReservation = (
  reservation: ReservationRecord,
  reservationPet: ReservationRecord['pets'][number],
  detailedPet: EditablePet | null
): TrackingHostedPet => ({
  id: reservationPet.id,
  name: detailedPet?.name?.trim() || reservationPet.name.trim() || 'Mascota sin nombre',
  species: detailedPet?.species ?? reservationPet.species,
  breed: detailedPet?.breed?.trim() || reservationPet.breed.trim() || 'Raza no especificada',
  sex: detailedPet?.sex?.trim() || 'Sin especificar',
  neutered: detailedPet?.neutered === 'Si',
  photoUrl: detailedPet?.photoUrl?.trim() ?? '',
  observations: detailedPet?.observations?.trim() ?? '',
  allergies: '',
  medication: '',
  specialNeeds: '',
  vet: '',
  vetPhone: '',
  reservation: {
    id: reservation.id,
    numericId: reservation.numericId,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    status: reservation.status,
    room: reservation.room?.trim() || 'Sin sala asignada',
  },
  client: {
    id: reservation.client.id,
    name: reservation.client.name.trim() || 'Dueño sin nombre',
    phone: reservation.client.phone.trim(),
  },
  trackingCount: 0,
  incidentsCount: 0,
});

const extractTrackingNumericId = (value: string | number) => {
  const directNumericId = Number(value);

  if (Number.isFinite(directNumericId) && directNumericId > 0) {
    return directNumericId;
  }

  return Number(value.toString().replace(/\D+/g, '')) || 0;
};

export default function TrackingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') ?? '');
  const [speciesFilter, setSpeciesFilter] = useState<string>(() => searchParams.get('species') ?? 'all');
  const [dailyStatusFilter, setDailyStatusFilter] = useState<string>(
    () => searchParams.get('dailyStatus') ?? 'all'
  );
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<string>(
    () => searchParams.get('incidentStatus') ?? 'all'
  );
  const [trackingSearchTerm, setTrackingSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [incidentFilter, setIncidentFilter] = useState<string>('all');
  const [isNewTrackingModalOpen, setIsNewTrackingModalOpen] = useState(false);
  const [isEditTrackingModalOpen, setIsEditTrackingModalOpen] = useState(false);
  const [isPetPickerOpen, setIsPetPickerOpen] = useState(false);
  const [petPickerSearchTerm, setPetPickerSearchTerm] = useState('');
  const [selectedTrackingRecord, setSelectedTrackingRecord] = useState<TrackingRecord | null>(null);
  const lastRequestedPetIdRef = useRef<number | null | undefined>(undefined);
  const requestedPetIdFromQuery = (() => {
    const numericPetId = Number(searchParams.get('petId'));

    return Number.isFinite(numericPetId) && numericPetId > 0 ? numericPetId : null;
  })();
  const shouldAutoOpenNewTracking = searchParams.get('openNew') === '1';

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: TRACKING_QUERY_KEY,
    queryFn: fetchTrackingPageData,
  });
  const { data: employees = [] } = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: fetchEmployeesPageData,
  });
  const {
    data: backendReservations = [],
    isLoading: isLoadingReservations,
    isError: isReservationsError,
  } = useQuery({
    queryKey: RESERVATIONS_QUERY_KEY,
    queryFn: fetchReservationsPageData,
  });
  const reservations = useAppliedLocalReservationOverrides<ReservationRecord>(backendReservations);
  const { data: backendPets = [] } = useQuery({
    queryKey: PETS_QUERY_KEY,
    queryFn: fetchPetsPageData,
  });
  const pets = useAppliedLocalPetChanges(backendPets);
  const petsById = useMemo(() => new Map(pets.map((pet) => [pet.id, pet] as const)), [pets]);

  const trackedPets = data?.pets ?? [];
  const activeReservationPets = useMemo(() => {
    if (isReservationsError) {
      return [];
    }

    return reservations
      .filter((reservation) => reservation.status === 'in_progress')
      .flatMap((reservation) =>
        reservation.pets.map((reservationPet) =>
          buildTrackablePetFromReservation(
            reservation,
            reservationPet,
            getReservationPetDetails(reservationPet.id, petsById)
          )
        )
      );
  }, [isReservationsError, petsById, reservations]);
  const visiblePets = useMemo(() => {
    if (isReservationsError) {
      return trackedPets.map((trackedPet) =>
        mergeTrackablePetWithDetailedPet(
          trackedPet,
          getReservationPetDetails(trackedPet.id, petsById)
        )
      );
    }

    const trackedPetsById = new Map(trackedPets.map((pet) => [pet.id, pet] as const));
    const activePetsById = new Map(activeReservationPets.map((pet) => [pet.id, pet] as const));

    const mergedActivePets = activeReservationPets.map((reservationPet) => {
      const trackedPet = trackedPetsById.get(reservationPet.id);
      const detailedPet = getReservationPetDetails(reservationPet.id, petsById);

      if (!trackedPet) {
        return mergeTrackablePetWithDetailedPet(reservationPet, detailedPet);
      }

      return mergeTrackablePetWithDetailedPet(
        {
          ...reservationPet,
          ...trackedPet,
          photoUrl: reservationPet.photoUrl || trackedPet.photoUrl || '',
          breed: trackedPet.breed || reservationPet.breed,
          sex: trackedPet.sex || reservationPet.sex,
          observations: trackedPet.observations || reservationPet.observations,
          allergies: trackedPet.allergies || reservationPet.allergies,
          medication: trackedPet.medication || reservationPet.medication,
          specialNeeds: trackedPet.specialNeeds || reservationPet.specialNeeds,
          vet: trackedPet.vet || reservationPet.vet,
          vetPhone: trackedPet.vetPhone || reservationPet.vetPhone,
          client: reservationPet.client,
          reservation: reservationPet.reservation,
        },
        detailedPet
      );
    });

    const trackedOnlyPets = trackedPets
      .filter((trackedPet) => !activePetsById.has(trackedPet.id))
      .map((trackedPet) =>
        mergeTrackablePetWithDetailedPet(
          trackedPet,
          getReservationPetDetails(trackedPet.id, petsById)
        )
      );

    return [...mergedActivePets, ...trackedOnlyPets].sort((petA, petB) => {
      const activeDifference =
        Number(petB.reservation.status === 'in_progress') -
        Number(petA.reservation.status === 'in_progress');

      if (activeDifference !== 0) {
        return activeDifference;
      }

      const recencyDifference =
        getTrackablePetSortTimestamp(petB) - getTrackablePetSortTimestamp(petA);

      if (recencyDifference !== 0) {
        return recencyDifference;
      }

      return petA.name.localeCompare(petB.name, 'es', { sensitivity: 'base' });
    });
  }, [activeReservationPets, isReservationsError, petsById, trackedPets]);
  const trackingByPetId = data?.trackingByPetId ?? {};
  const selectedPet =
    selectedPetId !== null ? visiblePets.find((pet) => pet.id === selectedPetId) ?? null : null;
  const trackingRecords = selectedPetId !== null ? trackingByPetId[selectedPetId] ?? [] : [];
  const canCreateTracking = selectedPet?.reservation.status === 'in_progress';
  const currentEmployee = useMemo(() => {
    if (!user) {
      return null;
    }

    return (
      employees.find((employee) => employee.email.trim().toLowerCase() === user.email.trim().toLowerCase()) ??
      employees.find(
        (employee) =>
          normalizeComparableText(employee.name) === normalizeComparableText(user.name)
      ) ??
      null
    );
  }, [employees, user]);

  useEffect(() => {
    if (requestedPetIdFromQuery === lastRequestedPetIdRef.current) {
      return;
    }

    lastRequestedPetIdRef.current = requestedPetIdFromQuery;

    if (requestedPetIdFromQuery) {
      setSelectedPetId(requestedPetIdFromQuery);
      setSelectedTrackingRecord(null);
      setTrackingSearchTerm('');
      setDateFilter('all');
      setEmployeeFilter('all');
      setIncidentFilter('all');
      return;
    }

    setSelectedPetId(null);
    setSelectedTrackingRecord(null);
    setTrackingSearchTerm('');
    setDateFilter('all');
    setEmployeeFilter('all');
    setIncidentFilter('all');
  }, [requestedPetIdFromQuery]);

  useEffect(() => {
    if (!shouldAutoOpenNewTracking || !selectedPet || isNewTrackingModalOpen) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('openNew');

    if (selectedPet.reservation.status !== 'in_progress') {
      toast.error('Solo puedes registrar seguimientos en reservas en curso', {
        description: `${selectedPet.name} no tiene una estancia activa en este momento.`,
        duration: 5000,
      });
      setSearchParams(nextSearchParams, { replace: true });
      return;
    }

    setIsNewTrackingModalOpen(true);
    setSearchParams(nextSearchParams, { replace: true });
  }, [
    isNewTrackingModalOpen,
    searchParams,
    selectedPet,
    setSearchParams,
    shouldAutoOpenNewTracking,
  ]);

  const handleSelectPet = (pet: TrackingHostedPet, options?: { openNew?: boolean }) => {
    setSelectedPetId(pet.id);
    setTrackingSearchTerm('');
    setDateFilter('all');
    setEmployeeFilter('all');
    setIncidentFilter('all');

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('petId', String(pet.id));
    if (options?.openNew) {
      nextSearchParams.set('openNew', '1');
    } else {
      nextSearchParams.delete('openNew');
    }
    setSearchParams(nextSearchParams, { replace: true });
  };

  const handleBackToList = () => {
    setSelectedPetId(null);
    setSelectedTrackingRecord(null);

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('petId');
    nextSearchParams.delete('openNew');
    setSearchParams(nextSearchParams, { replace: true });
  };

  const handleNewTracking = () => {
    if (!selectedPet) {
      return;
    }

    if (selectedPet.reservation.status !== 'in_progress') {
      toast.error('Solo puedes crear seguimientos en reservas en curso', {
        description: `${selectedPet.name} no tiene una estancia activa en este momento.`,
        duration: 5000,
      });
      return;
    }

    setIsNewTrackingModalOpen(true);
  };

  const handleOpenPetPicker = () => {
    setPetPickerSearchTerm('');
    setIsPetPickerOpen(true);
  };

  const filteredPetPickerOptions = activeReservationPets.filter((pet) =>
    matchesHostedPetSearch(petPickerSearchTerm, pet)
  );

  const handleTrackingSubmit = async (trackingData: TrackingFormData) => {
    if (!selectedPet) {
      return;
    }

    try {
      await createTrackingRequest({
        petId: selectedPet.id,
        reservationId: selectedPet.reservation.numericId,
        employeeId:
          currentEmployee?.id ??
          (trackingData.empleadoId > 0 ? trackingData.empleadoId : null),
        employeeName:
          currentEmployee?.name ?? trackingData.empleadoNombre ?? user?.name ?? 'Sin asignar',
        date: trackingData.fecha,
        createdAt: trackingData.fechaCreacion,
        feeding: trackingData.alimentacion,
        medication: trackingData.medicacionAdministrada,
        behavior: trackingData.comportamiento,
        incidents: trackingData.incidencias || null,
        photoUrl: trackingData.fotoUrl || null,
        photoFile: trackingData.photoFile ?? null,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: TRACKING_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['pet-detail', String(selectedPet.id)] }),
      ]);

      toast.success('Seguimiento registrado correctamente', {
        description: 'Se ha guardado correctamente en la base de datos.',
        duration: 5000,
      });
    } catch (trackingError) {
      const description =
        trackingError instanceof Error ? trackingError.message : 'Inténtalo de nuevo.';

      toast.error('No se pudo registrar el seguimiento', {
        description,
        duration: 6000,
      });
      throw trackingError;
    }
  };

  const handleEditTracking = (record: TrackingRecord) => {
    setSelectedTrackingRecord(record);
    setIsEditTrackingModalOpen(true);
  };

  const handleEditTrackingSubmit = async (editData: EditTrackingFormData) => {
    if (!selectedPet || !selectedTrackingRecord) {
      return;
    }

    try {
      await updateTrackingRequest({
        trackingId: extractTrackingNumericId(editData.id),
        petId: selectedPet.id,
        reservationId: selectedPet.reservation.numericId,
        employeeId:
          currentEmployee?.id ??
          (selectedTrackingRecord.employee.id > 0 ? selectedTrackingRecord.employee.id : null),
        employeeName:
          currentEmployee?.name ?? selectedTrackingRecord.employee.name ?? user?.name ?? 'Sin asignar',
        date: selectedTrackingRecord.date,
        createdAt: selectedTrackingRecord.createdAt,
        feeding: editData.alimentacion,
        medication: editData.medicacionAdministrada,
        behavior: editData.comportamiento,
        incidents: editData.incidencias || null,
        photoUrl: editData.fotoUrl || null,
        photoFile: editData.photoFile ?? null,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: TRACKING_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['pet-detail', String(selectedPet.id)] }),
      ]);
      setSelectedTrackingRecord(null);

      toast.success('Seguimiento actualizado correctamente', {
        description: 'Los cambios se han guardado en la base de datos.',
        duration: 5000,
      });
    } catch (trackingError) {
      const description =
        trackingError instanceof Error ? trackingError.message : 'Inténtalo de nuevo.';

      toast.error('No se pudo actualizar el seguimiento', {
        description,
        duration: 6000,
      });
      throw trackingError;
    }
  };

  const handleDeleteTracking = async (recordId: string) => {
    if (!selectedPet) {
      return;
    }

    try {
      await deleteTrackingRequest(recordId, selectedPet.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: TRACKING_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['pet-detail', String(selectedPet.id)] }),
      ]);

      if (selectedTrackingRecord?.id === recordId) {
        setSelectedTrackingRecord(null);
      }

      toast.success('Seguimiento eliminado', {
        description: 'Se ha eliminado correctamente de la base de datos.',
        duration: 5000,
      });
    } catch (trackingError) {
      const description =
        trackingError instanceof Error ? trackingError.message : 'Inténtalo de nuevo.';

      toast.error('No se pudo eliminar el seguimiento', {
        description,
        duration: 6000,
      });
      throw trackingError;
    }
  };

  const handleClearFilters = () => {
    setTrackingSearchTerm('');
    setDateFilter('all');
    setEmployeeFilter('all');
    setIncidentFilter('all');
  };

  const filteredVisiblePets = visiblePets.filter((pet) => {
    const todayLocalDate = toLocalDateKey(new Date());
    const isActiveStay = pet.reservation.status === 'in_progress';
    const hasTrackingToday = toLocalDateKey(pet.lastTracking?.date) === todayLocalDate;
    const matchesSearch = matchesHostedPetSearch(searchTerm, pet);
    const matchesSpecies =
      speciesFilter === 'all' ||
      normalizeComparableText(pet.species) === normalizeComparableText(speciesFilter);
    const matchesDailyStatus =
      dailyStatusFilter === 'all' ||
      (dailyStatusFilter === 'pending_today' && isActiveStay && !hasTrackingToday) ||
      (dailyStatusFilter === 'done_today' && isActiveStay && hasTrackingToday) ||
      (dailyStatusFilter === 'active_only' && isActiveStay) ||
      (dailyStatusFilter === 'without_tracking' && isActiveStay && pet.trackingCount === 0);

    const matchesIncidentStatus =
      incidentStatusFilter === 'all' ||
      (incidentStatusFilter === 'with_incidents' && pet.incidentsCount > 0) ||
      (incidentStatusFilter === 'no_incidents' && pet.incidentsCount === 0);

    return matchesSearch && matchesSpecies && matchesDailyStatus && matchesIncidentStatus;
  });

  const filteredRecords = trackingRecords.filter((record) => {
    const normalizedTrackingSearch = normalizeComparableText(trackingSearchTerm);
    const matchesSearch =
      !normalizedTrackingSearch ||
      [
        record.feeding,
        record.medication,
        record.behavior,
        record.incidents ?? '',
        record.employee.name,
      ].some((candidate) =>
        normalizeComparableText(candidate).includes(normalizedTrackingSearch)
      );

    const matchesEmployee =
      employeeFilter === 'all' || record.employee.id.toString() === employeeFilter;

    const matchesIncident =
      incidentFilter === 'all' ||
      (incidentFilter === 'with_incidents' && hasIncident(record)) ||
      (incidentFilter === 'no_incidents' && !hasIncident(record));

    let matchesDate = true;
    const today = startOfLocalDay(new Date());
    const todayLocalDate = toLocalDateKey(today);
    const recordDay = startOfLocalDay(record.date);

    if (dateFilter === 'today') {
      matchesDate = toLocalDateKey(record.date) === todayLocalDate;
    } else if (dateFilter === 'last_7_days' && today && recordDay) {
      const diff = Math.floor((today.getTime() - recordDay.getTime()) / (1000 * 60 * 60 * 24));
      matchesDate = diff >= 0 && diff <= 7;
    }

    return matchesSearch && matchesEmployee && matchesIncident && matchesDate;
  });

  const totalVisiblePets = visiblePets.length;
  const totalActivePets = activeReservationPets.length;
  const totalDogs = visiblePets.filter((pet) => pet.species === 'Perro').length;
  const totalCats = visiblePets.filter((pet) => pet.species === 'Gato').length;

  const totalRecords = trackingRecords.length;
  const totalIncidents = trackingRecords.filter(hasIncident).length;
  const stayDays = selectedPet
    ? Math.ceil(
        (new Date(selectedPet.reservation.checkOut).getTime() -
          new Date(selectedPet.reservation.checkIn).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;
  const lastRecord = trackingRecords[0];

  const trackingEmployees = Array.from(
    new Map(trackingRecords.map((record) => [record.employee.id, record.employee] as const)).values()
  );
  const visiblePetsEmptyMessage =
    dailyStatusFilter === 'pending_today'
      ? 'No hay seguimientos pendientes para hoy en reservas en curso'
      : dailyStatusFilter === 'done_today'
        ? 'Todavía no se ha registrado ningún seguimiento hoy en reservas en curso'
        : dailyStatusFilter === 'active_only'
          ? 'No hay mascotas con reservas en curso en este momento'
          : dailyStatusFilter === 'without_tracking'
            ? 'No hay mascotas en curso sin seguimiento todavía'
            : searchTerm || speciesFilter !== 'all' || incidentStatusFilter !== 'all'
              ? 'Intenta ajustar los filtros de búsqueda'
              : 'No hay seguimientos ni reservas en curso disponibles ahora mismo';

  if (!selectedPet) {
    if (isLoading || isLoadingReservations) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-gray-900 mb-1">Seguimiento de mascotas</h2>
            <p className="text-sm text-gray-600">Cargando seguimientos del backend...</p>
          </div>

          <Card className="border-0 p-6 shadow-md">
            <p className="text-sm text-gray-600">Obteniendo listado y detalle de seguimientos...</p>
          </Card>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-gray-900 mb-1">Seguimiento de mascotas</h2>
            <p className="text-sm text-gray-600">
              No se pudieron cargar los seguimientos desde backend.
            </p>
          </div>

          <Card className="border-0 p-6 shadow-md">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600">
                {error instanceof Error
                  ? error.message
                  : 'La API de seguimiento no devolvio datos validos.'}
              </p>
              <Button variant="outline" onClick={() => refetch()} className="border-gray-200">
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
            <h2 className="text-gray-900 mb-1">Seguimiento de mascotas</h2>
            <p className="text-sm text-gray-600">
              Consulta seguimientos existentes de cualquier mascota y registra nuevos seguimientos para las reservas que estén en curso
            </p>
          </div>
          <Button
            onClick={handleOpenPetPicker}
            className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Registrar seguimiento
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5 border-0 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Mascotas en seguimiento</p>
                <p className="text-2xl font-bold text-gray-900">{totalVisiblePets}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Dog className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-5 border-0 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Reservas en curso</p>
                <p
                  className={`text-2xl font-bold ${
                    totalActivePets > 0 ? 'text-green-600' : 'text-gray-500'
                  }`}
                >
                  {totalActivePets}
                </p>
              </div>
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  totalActivePets > 0
                    ? 'bg-gradient-to-br from-green-500 to-green-600'
                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                }`}
              >
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-5 border-0 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Perros</p>
                <p className="text-2xl font-bold text-blue-600">{totalDogs}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Dog className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-5 border-0 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Gatos</p>
                <p className="text-2xl font-bold text-purple-600">{totalCats}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Cat className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-4 border-0 shadow-md">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar por mascota, cliente, sala o reserva..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={speciesFilter}
              onChange={(event) => setSpeciesFilter(event.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las especies</option>
              <option value="Perro">Perros</option>
              <option value="Gato">Gatos</option>
            </select>
            <select
              value={dailyStatusFilter}
              onChange={(event) => setDailyStatusFilter(event.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las mascotas</option>
              <option value="pending_today">Pendientes de hoy</option>
              <option value="done_today">Hechos hoy</option>
              <option value="active_only">En curso</option>
              <option value="without_tracking">Sin seguimiento aún</option>
            </select>
            <select
              value={incidentStatusFilter}
              onChange={(event) => setIncidentStatusFilter(event.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas</option>
              <option value="with_incidents">Con incidencias</option>
              <option value="no_incidents">Sin incidencias</option>
            </select>
            {(searchTerm || speciesFilter !== 'all' || dailyStatusFilter !== 'all' || incidentStatusFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setSpeciesFilter('all');
                  setDailyStatusFilter('all');
                  setIncidentStatusFilter('all');
                  setSearchParams({});
                }}
              >
                Limpiar
              </Button>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVisiblePets.map((pet) => (
            <Card
              key={`${pet.id}-${pet.reservation.id}`}
              className="p-5 border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => handleSelectPet(pet)}
            >
              <div className="flex gap-4">
                <div className="relative flex-shrink-0">
                  {pet.photoUrl ? (
                    <ImageWithFallback
                      src={pet.photoUrl}
                      alt={pet.name}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-gray-100">
                      {pet.species === 'Perro' ? (
                        <Dog className="h-10 w-10 text-blue-500" />
                      ) : (
                        <Cat className="h-10 w-10 text-purple-500" />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 mb-0.5 truncate">{pet.name}</h3>
                      <p className="text-xs text-gray-500 truncate">
                        {pet.breed} • {pet.sex}
                      </p>
                    </div>
                    {pet.species === 'Perro' ? (
                      <Dog className="w-5 h-5 text-blue-500 flex-shrink-0 ml-2" />
                    ) : (
                      <Cat className="w-5 h-5 text-purple-500 flex-shrink-0 ml-2" />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="font-medium">Cliente:</span>
                      <span className="truncate">{pet.client.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="font-medium">Sala:</span>
                      <span>{pet.reservation.room}</span>
                      <span className="text-gray-400">•</span>
                      <span>{pet.reservation.id}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-600">
                        {pet.trackingCount} seguimiento{pet.trackingCount !== 1 ? 's' : ''}
                      </span>
                      {pet.incidentsCount > 0 && (
                        <span className="text-amber-600 font-medium">
                          {pet.incidentsCount} incidencia{pet.incidentsCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {pet.lastTracking && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        Último registro:{' '}
                        {new Date(pet.lastTracking.date).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-blue-600 font-medium text-center">
                  Click para ver seguimiento completo →
                </p>
              </div>
            </Card>
          ))}
        </div>

        {filteredVisiblePets.length === 0 && (
          <Card className="p-12 border-0 shadow-md text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Dog className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 mb-2">No se encontraron mascotas</h3>
              <p className="text-sm text-gray-600">
                {visiblePetsEmptyMessage}
              </p>
              {!searchTerm &&
                speciesFilter === 'all' &&
                dailyStatusFilter === 'all' &&
                incidentStatusFilter === 'all' && (
                  <Button
                    onClick={handleOpenPetPicker}
                    variant="outline"
                    className="mt-4 border-gray-200"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Buscar mascota con reserva en curso
                  </Button>
                )}
            </div>
          </Card>
        )}

        <Dialog open={isPetPickerOpen} onOpenChange={setIsPetPickerOpen}>
          <DialogContent className="max-w-2xl border-0 p-0 shadow-2xl">
            <DialogHeader className="border-b border-gray-100 px-6 py-5 text-left">
              <DialogTitle>Registrar seguimiento</DialogTitle>
              <DialogDescription>
                Selecciona una mascota con reserva en curso. Si aún no tiene seguimientos, aquí podrás crear el primero.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-6 py-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar por mascota, cliente, sala o reserva..."
                  value={petPickerSearchTerm}
                  onChange={(event) => setPetPickerSearchTerm(event.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-[420px] overflow-y-auto space-y-2">
                {filteredPetPickerOptions.map((pet) => (
                  <button
                    key={`picker-${pet.id}-${pet.reservation.id}`}
                    type="button"
                    onClick={() => {
                      handleSelectPet(pet, { openNew: true });
                      setIsPetPickerOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                  >
                    {pet.photoUrl ? (
                      <ImageWithFallback
                        src={pet.photoUrl}
                        alt={pet.name}
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100">
                        {pet.species === 'Perro' ? (
                          <Dog className="h-7 w-7 text-blue-500" />
                        ) : (
                          <Cat className="h-7 w-7 text-purple-500" />
                        )}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{pet.name}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {pet.client.name} • {pet.reservation.room} • {pet.reservation.id}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {pet.trackingCount > 0
                          ? `${pet.trackingCount} seguimiento${pet.trackingCount !== 1 ? 's' : ''} registrado${pet.trackingCount !== 1 ? 's' : ''}`
                          : 'Sin seguimientos registrados todavía'}
                      </p>
                    </div>

                    <span className="text-sm font-medium text-blue-600">Seleccionar</span>
                  </button>
                ))}

                {filteredPetPickerOptions.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center">
                    <p className="text-sm text-gray-600">
                      No hay mascotas con reserva en curso que coincidan con la búsqueda.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-gray-900 mb-1">Seguimiento de {selectedPet.name}</h2>
          <p className="text-sm text-gray-600">
            Consulta el historial y registra nuevos seguimientos si la reserva está en curso
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleBackToList}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <Button
            onClick={handleNewTracking}
            disabled={!canCreateTracking}
            className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo seguimiento
          </Button>
        </div>
        {!canCreateTracking && (
          <p className="text-sm text-gray-600">
            Esta reserva no está en curso. Puedes consultar y editar registros existentes, pero no crear uno nuevo.
          </p>
        )}
      </div>

      <PetInfoCard pet={selectedPet} reservation={selectedPet.reservation} client={selectedPet.client} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 border-0 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Seguimientos</p>
              <p className="text-2xl font-bold text-gray-900">{totalRecords}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-0 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Incidencias</p>
              <p
                className={`text-2xl font-bold ${
                  totalIncidents > 0 ? 'text-amber-600' : 'text-green-600'
                }`}
              >
                {totalIncidents}
              </p>
            </div>
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                totalIncidents > 0
                  ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                  : 'bg-gradient-to-br from-green-500 to-green-600'
              }`}
            >
              {totalIncidents > 0 ? (
                <AlertTriangle className="w-6 h-6 text-white" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-white" />
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5 border-0 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Días de estancia</p>
              <p className="text-2xl font-bold text-purple-600">{stayDays}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-0 shadow-md">
          <div>
            <p className="text-sm text-gray-600 mb-1">Último registro</p>
            {lastRecord ? (
              <>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(lastRecord.createdAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                  })}
                  ,{' '}
                  {new Date(lastRecord.createdAt).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-xs text-gray-500 mt-1">por {lastRecord.employee.name}</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Sin registros aún</p>
            )}
          </div>
        </Card>
      </div>

      <TrackingFilters
        searchTerm={trackingSearchTerm}
        onSearchChange={setTrackingSearchTerm}
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        employeeFilter={employeeFilter}
        onEmployeeChange={setEmployeeFilter}
        incidentFilter={incidentFilter}
        onIncidentChange={setIncidentFilter}
        onClearFilters={handleClearFilters}
        employees={trackingEmployees}
      />

      <TrackingTimeline
        records={filteredRecords}
        onEdit={handleEditTracking}
        onDelete={handleDeleteTracking}
      />

      {filteredRecords.length === 0 && (
        <Card className="p-12 border-0 shadow-md text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-gray-900 mb-2">No se encontraron registros</h3>
            <p className="text-sm text-gray-600 mb-6">
              {trackingSearchTerm ||
              dateFilter !== 'all' ||
              employeeFilter !== 'all' ||
              incidentFilter !== 'all'
                ? 'Intenta ajustar los filtros de búsqueda'
                : `Aún no hay registros de seguimiento para ${selectedPet.name}`}
            </p>
            {!trackingSearchTerm &&
              dateFilter === 'all' &&
              employeeFilter === 'all' &&
              incidentFilter === 'all' && (
                <Button
                  onClick={handleNewTracking}
                  disabled={!canCreateTracking}
                  className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear primer seguimiento
                </Button>
              )}
          </div>
        </Card>
      )}

        <NewTrackingModal
          isOpen={isNewTrackingModalOpen}
          onClose={() => setIsNewTrackingModalOpen(false)}
          onSubmit={handleTrackingSubmit}
          petName={selectedPet.name}
          reservationId={selectedPet.reservation.numericId}
          reservationCode={selectedPet.reservation.id}
          employeeId={currentEmployee?.id ?? (lastRecord?.employee.id ?? 0)}
          employeeName={currentEmployee?.name ?? lastRecord?.employee.name ?? user?.name ?? 'Sin asignar'}
        />

      <EditTrackingModal
        key={
          selectedTrackingRecord
            ? `${selectedTrackingRecord.id}-${isEditTrackingModalOpen}`
            : 'tracking-edit-empty'
        }
        isOpen={isEditTrackingModalOpen}
        onClose={() => setIsEditTrackingModalOpen(false)}
        onSubmit={handleEditTrackingSubmit}
        petName={selectedPet.name}
        trackingRecord={selectedTrackingRecord}
      />
    </div>
  );
}
