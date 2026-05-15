import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  CalendarDays,
  DoorOpen,
  Euro,
  Minus,
  PawPrint,
  Percent,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  canChangeReservationStatusAfterCheckIn,
  fetchReservationDetail,
  fetchReservationsPageData,
  extractReservationNumericId,
  formatReservationCode,
  getReservationCheckOutRequiredMessage,
  hasReservationActiveCheckIn,
  updateReservationRequest,
  updateReservationStatusRequest,
  type ReservationRecord,
} from '../utils/reservations-api';
import {
  mergeReservationWithLocalOverride,
  saveLocalReservationOverride,
  useAppliedLocalReservationOverrides,
  useLocalReservationOverride,
} from '../utils/reservation-local-overrides';
import {
  buildReturnNavigationState,
  getSafeReturnNavigation,
  type ReturnNavigationState,
} from '../utils/return-navigation';
import { ROOMS_QUERY_KEY, fetchRoomsPageData } from '../utils/rooms-api';
import {
  SERVICES_QUERY_KEY,
  fetchServicesPageData,
  type ServiceRecord,
} from '../utils/services-api';
import {
  buildMixedRoomAssignment,
  formatRoomTypeLabel,
  formatSpeciesGroupLabel,
  getPetsSpeciesGroup,
  getRoomAvailabilityForReservation,
  mapPetSpeciesToRoomType,
  parseMixedRoomAssignment,
  type ReservationAvailabilityRoom,
} from '../utils/reservation-room-availability';
import { getPetReservationOverlaps } from '../utils/reservation-overlaps';
import {
  buildReservationPaymentPath,
  type ReservationPaymentNavigationState,
} from '../utils/reservation-payment-navigation';
import { API_BASE_URL, apiFetch } from '../utils/api-client';
type EditReservationLocationState = ReturnNavigationState;
type DiscountMode = 'percentage' | 'amount';
type ReservationSaveMode = 'backend' | 'localFallback' | 'localMixedRoomAssignment';
type ClientDetailReservationCache = {
  id: string;
  pets: string[];
  checkIn: string;
  checkOut: string;
  status: ReservationRecord['status'];
  amount: number;
  room: string;
};
type ClientDetailCache = {
  reservations?: ClientDetailReservationCache[];
};
const CLIENTS_API_URL = API_BASE_URL;

const formatAmount = (amount: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);

const formatShortDate = (dateString: string) =>
  new Date(`${dateString}T00:00:00`).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const RESERVATIONS_QUERY_KEY = ['reservations-page'];

const getServicesSubtotal = (services: ReservationRecord['services']) =>
  services.reduce((sum, service) => sum + service.price * service.quantity, 0);

const areAmountsEqual = (firstAmount: number, secondAmount: number) =>
  Math.abs(firstAmount - secondAmount) < 0.01;

const buildNumericIdKey = (ids: number[]) =>
  [...ids].sort((firstId, secondId) => firstId - secondId).join('|');

const normalizeServiceName = (value: string) => value.trim().toLowerCase();
const hasConfiguredRoomPrice = (pricePerDay: number | null | undefined) =>
  pricePerDay != null && Number.isFinite(pricePerDay) && pricePerDay >= 0;

const buildServicesKey = (services: ReservationRecord['services']) =>
  services
    .map((service) => `${normalizeServiceName(service.name)}:${Math.round(service.quantity)}`)
    .sort()
    .join('|');

const isRecoverableReservationUpdateError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  return !error.message.includes('La reserva solicitada no es valida');
};

const mapReservationToClientDetailCache = (
  reservation: ReservationRecord
): ClientDetailReservationCache => ({
  id: reservation.id,
  pets: reservation.pets.map((pet) => pet.name),
  checkIn: reservation.checkIn,
  checkOut: reservation.checkOut,
  status: reservation.status,
  amount: reservation.totalAmount,
  room: reservation.room,
});

const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getTodayDateInputValue = () => formatDateForInput(new Date());

const getNextDateInputValue = (dateValue: string) => {
  if (!dateValue) {
    return getTodayDateInputValue();
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return getTodayDateInputValue();
  }

  date.setDate(date.getDate() + 1);

  return formatDateForInput(date);
};

interface ReservationEditorBackendClientDetail {
  mascotas?: Array<{
    id: number;
    nombre: string;
    especie: string;
    raza: string;
    edad: number;
  }>;
}

const mapBackendSpeciesToUi = (species: string): ReservationRecord['pets'][number]['species'] =>
  species.toUpperCase() === 'GATO' ? 'Gato' : 'Perro';

const fetchClientPetsForReservationEditor = async (
  clientId: number
): Promise<ReservationRecord['pets']> => {
  const response = await apiFetch(`${CLIENTS_API_URL}/api/clientes/${clientId}`);

  if (!response.ok) {
    throw new Error('No se pudieron cargar las mascotas del cliente');
  }

  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return [];
  }

  const data: ReservationEditorBackendClientDetail = JSON.parse(rawBody);

  return (data.mascotas ?? []).map((pet) => ({
    id: pet.id,
    name: pet.nombre,
    species: mapBackendSpeciesToUi(pet.especie),
    breed: pet.raza,
    age: Number(pet.edad ?? 0),
  }));
};

function ReservationEditForm({
  reservation,
  onCancel,
  onSave,
}: {
  reservation: ReservationRecord;
  onCancel: () => void;
  onSave: (reservation: ReservationRecord, saveMode: ReservationSaveMode) => void;
}) {
  const initialServices = reservation.services.map((service) => ({
    ...service,
    maxQuantity: service.maxQuantity ?? service.quantity,
  }));
  const hasSeparatedNotes = Boolean(reservation.customerNotes || reservation.internalNotes);
  const initialInternalNotes = hasSeparatedNotes ? reservation.internalNotes : reservation.notes;
  const initialServicesSubtotal = getServicesSubtotal(initialServices);
  const initialLodgingAmount = reservation.lodgingAmount ?? Math.max(
    reservation.totalAmount + reservation.discount - initialServicesSubtotal,
    0
  );
  const initialSubtotalBeforeDiscount = initialLodgingAmount + initialServicesSubtotal;
  const initialMixedRoomAssignment = parseMixedRoomAssignment(reservation.room);
  const [formData, setFormData] = useState(() => ({
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    room: initialMixedRoomAssignment.isMixed ? '' : reservation.room,
    dogRoom: initialMixedRoomAssignment.dogRoom,
    catRoom: initialMixedRoomAssignment.catRoom,
    status: reservation.status,
    paymentStatus: reservation.paymentStatus ?? 'pending',
    customerNotes: reservation.customerNotes,
    internalNotes: initialInternalNotes,
    lodgingAmount: initialLodgingAmount,
    pets: reservation.pets,
    services: initialServices,
  }));
  const [discountMode, setDiscountMode] = useState<DiscountMode>('percentage');
  const [discountAmount, setDiscountAmount] = useState(() =>
    clamp(reservation.discount, 0, initialSubtotalBeforeDiscount)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    data: fetchedClientPets = [],
    isLoading: isLoadingClientPets,
    isError: isClientPetsError,
  } = useQuery({
    queryKey: ['reservation-editor-client-pets', reservation.client.id],
    queryFn: () => fetchClientPetsForReservationEditor(reservation.client.id),
    enabled: Boolean(reservation.client.id),
  });
  const { data: rooms = [], isLoading: isLoadingRooms } = useQuery({
    queryKey: ROOMS_QUERY_KEY,
    queryFn: fetchRoomsPageData,
  });
  const {
    data: services = [],
    isLoading: isLoadingServices,
    isError: isServicesError,
  } = useQuery({
    queryKey: SERVICES_QUERY_KEY,
    queryFn: fetchServicesPageData,
  });
  const { data: backendReservations = [], isLoading: isLoadingReservations } = useQuery({
    queryKey: RESERVATIONS_QUERY_KEY,
    queryFn: fetchReservationsPageData,
  });
  const activeServices = useMemo(
    () => services.filter((service) => service.status === 'active'),
    [services]
  );
  const stayDays = useMemo(() => {
    if (!formData.checkIn || !formData.checkOut) {
      return 0;
    }

    return Math.max(
      Math.ceil(
        (new Date(formData.checkOut).getTime() - new Date(formData.checkIn).getTime()) /
          (1000 * 60 * 60 * 24)
      ),
      0
    );
  }, [formData.checkIn, formData.checkOut]);
  const servicesSubtotal = getServicesSubtotal(formData.services);
  const subtotalBeforeDiscount = formData.lodgingAmount + servicesSubtotal;
  const effectiveDiscountAmount = clamp(discountAmount, 0, subtotalBeforeDiscount);
  const totalAmount = Math.max(subtotalBeforeDiscount - effectiveDiscountAmount, 0);
  const discountPercentage =
    subtotalBeforeDiscount > 0 ? (effectiveDiscountAmount / subtotalBeforeDiscount) * 100 : 0;
  const todayDateInputValue = getTodayDateInputValue();
  const minCheckInDate =
    reservation.checkIn && reservation.checkIn < todayDateInputValue
      ? reservation.checkIn
      : todayDateInputValue;
  const minCheckOutDate =
    formData.checkOut === reservation.checkOut &&
    formData.checkIn === reservation.checkIn &&
    reservation.checkOut
      ? reservation.checkOut
      : formData.checkIn
        ? getNextDateInputValue(formData.checkIn)
      : todayDateInputValue;
  const hasActiveCheckIn = hasReservationActiveCheckIn(reservation);
  const effectivePaymentStatus = reservation.paymentStatus ?? formData.paymentStatus;
  const availablePets = Array.from(
    new Map(
      [...fetchedClientPets, ...reservation.pets, ...formData.pets].map((pet) => [pet.id, pet])
    ).values()
  );
  const reservations = useAppliedLocalReservationOverrides<ReservationRecord>(backendReservations);
  const selectedPetsSpeciesGroup = useMemo(
    () => getPetsSpeciesGroup(formData.pets),
    [formData.pets]
  );
  const selectedDogPets = useMemo(
    () => formData.pets.filter((pet) => mapPetSpeciesToRoomType(pet.species) === 'dog'),
    [formData.pets]
  );
  const selectedCatPets = useMemo(
    () => formData.pets.filter((pet) => mapPetSpeciesToRoomType(pet.species) === 'cat'),
    [formData.pets]
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
      selectedPetsSpeciesGroup === 'mixed'
        ? []
        : getRoomAvailabilityForReservation({
            rooms: availabilityRooms,
            reservations,
            pets: formData.pets,
            checkIn: formData.checkIn,
            checkOut: formData.checkOut,
            excludeReservationId: reservation.id,
          }),
    [
      availabilityRooms,
      formData.checkIn,
      formData.checkOut,
      formData.pets,
      reservation.id,
      reservations,
      selectedPetsSpeciesGroup,
    ]
  );
  const dogRoomAvailability = useMemo(
    () =>
      selectedPetsSpeciesGroup !== 'mixed'
        ? []
        : getRoomAvailabilityForReservation({
            rooms: availabilityRooms.filter((room) => room.type === 'dog'),
            reservations,
            pets: selectedDogPets,
            checkIn: formData.checkIn,
            checkOut: formData.checkOut,
            excludeReservationId: reservation.id,
          }),
    [
      availabilityRooms,
      formData.checkIn,
      formData.checkOut,
      reservation.id,
      reservations,
      selectedDogPets,
      selectedPetsSpeciesGroup,
    ]
  );
  const catRoomAvailability = useMemo(
    () =>
      selectedPetsSpeciesGroup !== 'mixed'
        ? []
        : getRoomAvailabilityForReservation({
            rooms: availabilityRooms.filter((room) => room.type === 'cat'),
            reservations,
            pets: selectedCatPets,
            checkIn: formData.checkIn,
            checkOut: formData.checkOut,
            excludeReservationId: reservation.id,
          }),
    [
      availabilityRooms,
      formData.checkIn,
      formData.checkOut,
      reservation.id,
      reservations,
      selectedCatPets,
      selectedPetsSpeciesGroup,
    ]
  );
  const compatibleRooms = useMemo(
    () => roomAvailability.filter((room) => room.isSelectable),
    [roomAvailability]
  );
  const compatibleDogRooms = useMemo(
    () => dogRoomAvailability.filter((room) => room.isSelectable),
    [dogRoomAvailability]
  );
  const compatibleCatRooms = useMemo(
    () => catRoomAvailability.filter((room) => room.isSelectable),
    [catRoomAvailability]
  );
  const selectedRoomAvailability = useMemo(
    () => roomAvailability.find((room) => room.roomLabel === formData.room) ?? null,
    [formData.room, roomAvailability]
  );
  const selectedDogRoomAvailability = useMemo(
    () => dogRoomAvailability.find((room) => room.roomLabel === formData.dogRoom) ?? null,
    [dogRoomAvailability, formData.dogRoom]
  );
  const selectedCatRoomAvailability = useMemo(
    () => catRoomAvailability.find((room) => room.roomLabel === formData.catRoom) ?? null,
    [catRoomAvailability, formData.catRoom]
  );
  const effectiveRoomValue =
    selectedPetsSpeciesGroup === 'mixed'
      ? buildMixedRoomAssignment({
          dogRoom: formData.dogRoom,
          catRoom: formData.catRoom,
        })
      : formData.room;
  const isOriginalRoomAssignment =
    effectiveRoomValue === reservation.room &&
    formData.checkIn === reservation.checkIn &&
    formData.checkOut === reservation.checkOut &&
    buildNumericIdKey(formData.pets.map((pet) => pet.id)) ===
      buildNumericIdKey(reservation.pets.map((pet) => pet.id));
  const roomSelectOptions = useMemo(() => {
    if (
      !selectedRoomAvailability ||
      compatibleRooms.some((room) => room.roomLabel === selectedRoomAvailability.roomLabel)
    ) {
      return compatibleRooms;
    }

    return [selectedRoomAvailability, ...compatibleRooms];
  }, [compatibleRooms, selectedRoomAvailability]);
  const dogRoomSelectOptions = useMemo(() => {
    if (
      !selectedDogRoomAvailability ||
      compatibleDogRooms.some((room) => room.roomLabel === selectedDogRoomAvailability.roomLabel)
    ) {
      return compatibleDogRooms;
    }

    return [selectedDogRoomAvailability, ...compatibleDogRooms];
  }, [compatibleDogRooms, selectedDogRoomAvailability]);
  const catRoomSelectOptions = useMemo(() => {
    if (
      !selectedCatRoomAvailability ||
      compatibleCatRooms.some((room) => room.roomLabel === selectedCatRoomAvailability.roomLabel)
    ) {
      return compatibleCatRooms;
    }

    return [selectedCatRoomAvailability, ...compatibleCatRooms];
  }, [compatibleCatRooms, selectedCatRoomAvailability]);
  const selectedRoomRecord = useMemo(
    () => rooms.find((room) => room.code === formData.room) ?? null,
    [formData.room, rooms]
  );
  const selectedDogRoomRecord = useMemo(
    () => rooms.find((room) => room.code === formData.dogRoom) ?? null,
    [formData.dogRoom, rooms]
  );
  const selectedCatRoomRecord = useMemo(
    () => rooms.find((room) => room.code === formData.catRoom) ?? null,
    [formData.catRoom, rooms]
  );
  const roomAvailabilityReady = !isLoadingRooms && !isLoadingReservations;
  const estimatedLodgingAmount = useMemo(() => {
    if (stayDays <= 0) {
      return 0;
    }

    if (selectedPetsSpeciesGroup === 'mixed') {
      if (!selectedDogRoomRecord || !selectedCatRoomRecord) {
        return null;
      }

      return (
        ((selectedDogRoomRecord.pricePerDay ?? 0) * selectedDogPets.length +
          (selectedCatRoomRecord.pricePerDay ?? 0) * selectedCatPets.length) *
        stayDays
      );
    }

    if (!selectedRoomRecord || formData.pets.length === 0) {
      return 0;
    }

    return (selectedRoomRecord.pricePerDay ?? 0) * formData.pets.length * stayDays;
  }, [
    formData.pets.length,
    selectedCatRoomRecord,
    selectedCatPets.length,
    selectedDogRoomRecord,
    selectedDogPets.length,
    selectedPetsSpeciesGroup,
    selectedRoomRecord,
    stayDays,
  ]);

  useEffect(() => {
    if (activeServices.length === 0) {
      return;
    }

    setFormData((currentData) => ({
      ...currentData,
      services: currentData.services.map((service) => {
        const matchingService = activeServices.find(
          (activeService) =>
            activeService.id === service.id ||
            normalizeServiceName(activeService.name) === normalizeServiceName(service.name)
        );

        return matchingService
          ? {
              ...service,
              id: matchingService.id,
              name: matchingService.name,
            }
          : service;
      }),
    }));
  }, [activeServices]);

  useEffect(() => {
    const hasRoomOrDateChanges =
      formData.checkIn !== reservation.checkIn ||
      formData.checkOut !== reservation.checkOut ||
      effectiveRoomValue !== reservation.room;

    if (!hasRoomOrDateChanges || estimatedLodgingAmount == null) {
      return;
    }

    setFormData((currentData) => {
      if (areAmountsEqual(currentData.lodgingAmount, estimatedLodgingAmount)) {
        return currentData;
      }

      return {
        ...currentData,
        lodgingAmount: estimatedLodgingAmount,
      };
    });
  }, [
    effectiveRoomValue,
    estimatedLodgingAmount,
    formData.checkIn,
    formData.checkOut,
    reservation.checkIn,
    reservation.checkOut,
    reservation.room,
  ]);

  useEffect(() => {
    setFormData((currentData) => {
      if (selectedPetsSpeciesGroup === 'mixed') {
        const currentSingleRoomRecord = rooms.find((room) => room.code === currentData.room) ?? null;
        const nextDogRoom =
          currentData.dogRoom ||
          (currentSingleRoomRecord?.type === 'dog' ? currentData.room : '');
        const nextCatRoom =
          currentData.catRoom ||
          (currentSingleRoomRecord?.type === 'cat' ? currentData.room : '');

        if (
          currentData.room === '' &&
          nextDogRoom === currentData.dogRoom &&
          nextCatRoom === currentData.catRoom
        ) {
          return currentData;
        }

        return {
          ...currentData,
          room: '',
          dogRoom: nextDogRoom,
          catRoom: nextCatRoom,
        };
      }

      if (selectedPetsSpeciesGroup === 'dog' && !currentData.room && currentData.dogRoom) {
        return {
          ...currentData,
          room: currentData.dogRoom,
        };
      }

      if (selectedPetsSpeciesGroup === 'cat' && !currentData.room && currentData.catRoom) {
        return {
          ...currentData,
          room: currentData.catRoom,
        };
      }

      return currentData;
    });
  }, [rooms, selectedPetsSpeciesGroup]);

  useEffect(() => {
    if (!roomAvailabilityReady || !formData.checkIn || !formData.checkOut || formData.pets.length === 0) {
      return;
    }

    if (selectedPetsSpeciesGroup === 'mixed') {
      setFormData((currentData) => {
        const nextDogRoom =
          currentData.dogRoom && !selectedDogRoomAvailability?.isSelectable && !isOriginalRoomAssignment
            ? ''
            : currentData.dogRoom;
        const nextCatRoom =
          currentData.catRoom && !selectedCatRoomAvailability?.isSelectable && !isOriginalRoomAssignment
            ? ''
            : currentData.catRoom;

        if (nextDogRoom === currentData.dogRoom && nextCatRoom === currentData.catRoom) {
          return currentData;
        }

        return {
          ...currentData,
          dogRoom: nextDogRoom,
          catRoom: nextCatRoom,
        };
      });

      return;
    }

    if (formData.room && !selectedRoomAvailability?.isSelectable && !isOriginalRoomAssignment) {
      setFormData((currentData) => ({
        ...currentData,
        room: '',
      }));
    }
  }, [
    formData.room,
    formData.checkIn,
    formData.checkOut,
    formData.pets.length,
    isOriginalRoomAssignment,
    roomAvailabilityReady,
    selectedCatRoomAvailability,
    selectedDogRoomAvailability,
    selectedPetsSpeciesGroup,
    selectedRoomAvailability,
  ]);

  const isServiceSelected = (service: ServiceRecord) =>
    formData.services.some(
      (selectedService) =>
        selectedService.id === service.id ||
        normalizeServiceName(selectedService.name) === normalizeServiceName(service.name)
    );

  const handleToggleService = (service: ServiceRecord) => {
    const suggestedQuantity = Math.max(stayDays, 1);

    setFormData((currentData) => {
      const serviceIsSelected = currentData.services.some(
        (selectedService) =>
          selectedService.id === service.id ||
          normalizeServiceName(selectedService.name) === normalizeServiceName(service.name)
      );

      if (serviceIsSelected) {
        return {
          ...currentData,
          services: currentData.services.filter(
            (selectedService) =>
              selectedService.id !== service.id &&
              normalizeServiceName(selectedService.name) !== normalizeServiceName(service.name)
          ),
        };
      }

      return {
        ...currentData,
        services: [
          ...currentData.services,
          {
            id: service.id,
            name: service.name,
            price: service.price,
            quantity: suggestedQuantity,
            maxQuantity: suggestedQuantity,
          },
        ],
      };
    });
  };

  const handleChange = (
    field: 'checkIn' | 'checkOut' | 'room' | 'dogRoom' | 'catRoom' | 'status' | 'paymentStatus',
    value: string
  ) => {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }));

    if (
      errors[field] ||
      ((field === 'checkIn' || field === 'status') && errors.status) ||
      (field === 'status' && errors.paymentStatus) ||
      ((field === 'checkIn' || field === 'checkOut') && errors.pets)
    ) {
      setErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors[field];
        if (field === 'checkIn' || field === 'status') {
          delete nextErrors.status;
        }
        if (
          field === 'checkIn' ||
          field === 'checkOut' ||
          field === 'room' ||
          field === 'dogRoom' ||
          field === 'catRoom'
        ) {
          delete nextErrors.room;
          delete nextErrors.dogRoom;
          delete nextErrors.catRoom;
        }
        if (field === 'checkIn') {
          delete nextErrors.checkOut;
        }
        if (field === 'checkIn' || field === 'checkOut') {
          delete nextErrors.pets;
        }
        if (field === 'status') {
          delete nextErrors.paymentStatus;
        }
        return nextErrors;
      });
    }
  };

  const handleServiceQuantityChange = (serviceId: number, nextQuantity: number) => {
    setFormData((currentData) => ({
      ...currentData,
      services: currentData.services.map((service) => {
        if (service.id !== serviceId) {
          return service;
        }

        return {
          ...service,
          quantity: Math.max(Math.round(nextQuantity), 0),
        };
      }),
    }));
  };

  const handleTogglePet = (petToToggle: ReservationRecord['pets'][number]) => {
    setFormData((currentData) => {
      const isSelected = currentData.pets.some((pet) => pet.id === petToToggle.id);

      return {
        ...currentData,
        pets: isSelected
          ? currentData.pets.filter((pet) => pet.id !== petToToggle.id)
          : [...currentData.pets, petToToggle],
      };
    });

    if (errors.pets) {
      setErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors.pets;
        delete nextErrors.room;
        delete nextErrors.dogRoom;
        delete nextErrors.catRoom;
        return nextErrors;
      });
    }
  };

  const handleDiscountInputChange = (value: string) => {
    const normalizedValue = Number(value);
    const safeNumericValue = Number.isFinite(normalizedValue) ? Math.max(normalizedValue, 0) : 0;

    if (discountMode === 'percentage') {
      setDiscountAmount(clamp((subtotalBeforeDiscount * safeNumericValue) / 100, 0, subtotalBeforeDiscount));
      return;
    }

    setDiscountAmount(clamp(safeNumericValue, 0, subtotalBeforeDiscount));
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const isEditingOriginalCheckIn = formData.checkIn === reservation.checkIn;

    if (formData.pets.length === 0) {
      nextErrors.pets = 'Selecciona al menos una mascota';
    }

    if (!formData.checkIn) {
      nextErrors.checkIn = 'La fecha de entrada es obligatoria';
    } else if (!isEditingOriginalCheckIn && formData.checkIn < todayDateInputValue) {
      nextErrors.checkIn = 'La fecha de entrada no puede ser anterior al dia actual';
    }

    if (!formData.checkOut) {
      nextErrors.checkOut = 'La fecha de salida es obligatoria';
    }

    if (
      formData.checkIn &&
      formData.checkOut &&
      new Date(formData.checkIn) >= new Date(formData.checkOut)
    ) {
      nextErrors.checkOut = 'La fecha de salida debe ser posterior a la entrada';
    }

    const petReservationOverlaps = getPetReservationOverlaps({
      reservations,
      petIds: formData.pets.map((pet) => pet.id),
      checkIn: formData.checkIn,
      checkOut: formData.checkOut,
      excludeReservationId: reservation.id,
    });

    if (petReservationOverlaps.length > 0) {
      const overlapMessages = petReservationOverlaps
        .slice(0, 2)
        .map(
          (overlap) =>
            `${overlap.petName}: ${formatShortDate(overlap.checkIn)} - ${formatShortDate(overlap.checkOut)}`
        );
      const hasMoreOverlaps = petReservationOverlaps.length > 2;
      const hasSingleOverlap = petReservationOverlaps.length === 1;

      nextErrors.pets = hasSingleOverlap
        ? `La mascota ya tiene una reserva en esas fechas: ${overlapMessages[0]}.`
        : hasMoreOverlaps
          ? `Ya hay mascotas con reservas en esas fechas. Conflictos: ${overlapMessages.join(', ')} y más.`
          : `Ya hay mascotas con reservas en esas fechas. Conflictos: ${overlapMessages.join(', ')}.`;
    }

    if (
      formData.checkIn &&
      formData.checkIn > todayDateInputValue &&
      (formData.status === 'in_progress' || formData.status === 'completed')
    ) {
      nextErrors.status =
        'No puedes registrar el check-in antes del día de entrada de la reserva.';
    }

    if (
      (formData.status === 'in_progress' || formData.status === 'completed') &&
      effectivePaymentStatus !== 'paid'
    ) {
      nextErrors.paymentStatus =
        'Las reservas en curso o finalizadas deben estar marcadas como pagadas.';
    }

    if (!canChangeReservationStatusAfterCheckIn(reservation, formData.status)) {
      nextErrors.status = getReservationCheckOutRequiredMessage('cambiar el estado');
    }

    if (selectedPetsSpeciesGroup === 'mixed') {
      if (!formData.dogRoom || !selectedDogRoomRecord) {
        nextErrors.dogRoom = 'Selecciona una sala para perros';
      } else if (!hasConfiguredRoomPrice(selectedDogRoomRecord.pricePerDay)) {
        nextErrors.dogRoom =
          'La sala de perros seleccionada no tiene precio diario configurado en base de datos.';
      } else if (!isOriginalRoomAssignment && !selectedDogRoomAvailability?.isSelectable) {
        nextErrors.dogRoom = 'La sala de perros no está disponible para esas fechas.';
      }

      if (!formData.catRoom || !selectedCatRoomRecord) {
        nextErrors.catRoom = 'Selecciona una sala para gatos';
      } else if (!hasConfiguredRoomPrice(selectedCatRoomRecord.pricePerDay)) {
        nextErrors.catRoom =
          'La sala de gatos seleccionada no tiene precio diario configurado en base de datos.';
      } else if (!isOriginalRoomAssignment && !selectedCatRoomAvailability?.isSelectable) {
        nextErrors.catRoom = 'La sala de gatos no está disponible para esas fechas.';
      }
    } else if (!formData.room || !selectedRoomRecord) {
      nextErrors.room = 'Selecciona una sala';
    } else if (!hasConfiguredRoomPrice(selectedRoomRecord.pricePerDay)) {
      nextErrors.room = 'La sala seleccionada no tiene precio diario configurado en base de datos.';
    } else if (!isOriginalRoomAssignment && !selectedRoomAvailability?.isSelectable) {
      nextErrors.room = 'La sala seleccionada no está disponible para esas fechas.';
    }

    return nextErrors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (
      (selectedPetsSpeciesGroup !== 'mixed' && !selectedRoomRecord) ||
      (selectedPetsSpeciesGroup === 'mixed' && (!selectedDogRoomRecord || !selectedCatRoomRecord))
    ) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      let saveMode: ReservationSaveMode = 'backend';
      const hasReservationContentChanges =
        formData.checkIn !== reservation.checkIn ||
        formData.checkOut !== reservation.checkOut ||
        effectiveRoomValue !== reservation.room ||
        formData.customerNotes !== reservation.customerNotes ||
        formData.internalNotes !== initialInternalNotes ||
        buildNumericIdKey(formData.pets.map((pet) => pet.id)) !==
          buildNumericIdKey(reservation.pets.map((pet) => pet.id)) ||
        buildServicesKey(formData.services) !== buildServicesKey(initialServices) ||
        !areAmountsEqual(formData.lodgingAmount, initialLodgingAmount) ||
        !areAmountsEqual(effectiveDiscountAmount, reservation.discount) ||
        !areAmountsEqual(totalAmount, reservation.totalAmount);
      const nextReservation: ReservationRecord = {
        ...reservation,
        pets: formData.pets,
        checkIn: formData.checkIn,
        checkOut: formData.checkOut,
        room: effectiveRoomValue,
        status: formData.status,
        paymentStatus: effectivePaymentStatus,
        customerNotes: formData.customerNotes,
        internalNotes: formData.internalNotes,
        notes: `${formData.customerNotes}\n${formData.internalNotes}`.trim(),
        lodgingAmount: formData.lodgingAmount,
        services: formData.services,
        discount: effectiveDiscountAmount,
        totalAmount,
      };

      if (hasReservationContentChanges) {
        if (selectedPetsSpeciesGroup === 'mixed') {
          saveMode = 'localMixedRoomAssignment';
        } else {
          const roomRecord = selectedRoomRecord;

          if (!roomRecord) {
            setErrors({ room: 'Selecciona una sala válida para guardar la reserva.' });
            setIsSubmitting(false);
            return;
          }

          try {
            await updateReservationRequest(reservation.numericId, {
              clientId: reservation.client.id,
              roomId: roomRecord.id,
              petIds: formData.pets.map((pet) => pet.id),
              checkIn: formData.checkIn,
              checkOut: formData.checkOut,
              requestedAt: reservation.createdAt,
              customerNotes: formData.customerNotes,
              internalNotes: formData.internalNotes,
              services: formData.services,
              lodgingAmount: formData.lodgingAmount,
              subtotalBeforeDiscount,
              discount: effectiveDiscountAmount,
              totalAmount,
              status: formData.status,
            });
          } catch (updateError) {
            if (!isRecoverableReservationUpdateError(updateError)) {
              throw updateError;
            }

            saveMode = 'localFallback';
          }
        }
      }

      if (formData.status !== reservation.status) {
        await updateReservationStatusRequest(reservation.numericId, formData.status);
      }

      onSave(nextReservation, saveMode);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'No se pudo actualizar la reserva';

      setErrors({ submit: message });
      toast.error('No se pudo actualizar la reserva', {
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-0 p-6 shadow-md">
      <h2 className="mb-2 text-gray-900">Editar reserva {reservation.id}</h2>
      <p className="mb-6 text-sm text-gray-600">
        Ajusta fechas, estado, servicios y descuento. El importe final se recalcula automaticamente.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">Cliente</p>
              <p className="text-sm text-gray-900">{reservation.client.name}</p>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                <PawPrint className="h-4 w-4" />
                Mascotas
              </p>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {availablePets.map((pet) => {
                    const isSelected = formData.pets.some((selectedPet) => selectedPet.id === pet.id);

                    return (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => handleTogglePet(pet)}
                        disabled={isSubmitting}
                        className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                          isSelected
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {pet.name}
                      </button>
                    );
                  })}
                </div>
                {isLoadingClientPets && (
                  <p className="text-xs text-gray-500">Cargando mascotas del cliente...</p>
                )}
                {isClientPetsError && (
                  <p className="text-xs text-amber-600">
                    No se pudieron cargar más mascotas del cliente. Puedes seguir con las ya
                    incluidas en la reserva.
                  </p>
                )}
                {errors.pets && <p className="text-sm text-red-600">{errors.pets}</p>}
              </div>
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
              min={minCheckInDate}
            />
            {errors.checkIn && <p className="mt-1 text-sm text-red-600">{errors.checkIn}</p>}
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
              min={minCheckOutDate}
            />
            {errors.checkOut && <p className="mt-1 text-sm text-red-600">{errors.checkOut}</p>}
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <DoorOpen className="h-4 w-4" />
                {selectedPetsSpeciesGroup === 'mixed' ? 'Sala para perros' : 'Sala'}
              </label>
              <select
                value={selectedPetsSpeciesGroup === 'mixed' ? formData.dogRoom : formData.room}
                onChange={(event) =>
                  handleChange(
                    selectedPetsSpeciesGroup === 'mixed' ? 'dogRoom' : 'room',
                    event.target.value
                  )
                }
                disabled={
                  isSubmitting ||
                  !roomAvailabilityReady ||
                  formData.pets.length === 0 ||
                  !formData.checkIn ||
                  !formData.checkOut ||
                  (selectedPetsSpeciesGroup === 'mixed'
                    ? dogRoomSelectOptions.length === 0
                    : roomSelectOptions.length === 0)
                }
                className={`h-9 w-full rounded-md border bg-input-background px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 ${
                  selectedPetsSpeciesGroup === 'mixed'
                    ? errors.dogRoom
                      ? 'border-red-300'
                      : 'border-input'
                    : errors.room
                      ? 'border-red-300'
                      : 'border-input'
                }`}
              >
                {!roomAvailabilityReady ? (
                  <option value="">Cargando salas...</option>
                ) : selectedPetsSpeciesGroup === 'mixed' ? (
                  dogRoomSelectOptions.length > 0 ? null : (
                    <option value="">No hay salas para perros disponibles</option>
                  )
                ) : roomSelectOptions.length > 0 ? null : (
                  <option value="">No hay salas compatibles disponibles</option>
                )}
                {(selectedPetsSpeciesGroup === 'mixed'
                  ? dogRoomSelectOptions
                  : roomSelectOptions
                ).map((room) => (
                  <option key={room.roomId} value={room.roomLabel}>
                    {room.roomLabel} · {formatRoomTypeLabel(room.roomType)} · {room.freeSlots}{' '}
                    plaza{room.freeSlots === 1 ? '' : 's'} libre
                    {room.freeSlots === 1 ? '' : 's'}
                    {room.roomLabel === reservation.room ? ' · sala actual' : ''}
                  </option>
                ))}
              </select>
              {selectedPetsSpeciesGroup === 'mixed' ? (
                <>
                  <div className="mt-2 text-xs">
                    {!formData.checkIn || !formData.checkOut ? (
                      <p className="text-gray-500">
                        Define las fechas para comprobar disponibilidad en salas de perros.
                      </p>
                    ) : !roomAvailabilityReady ? (
                      <p className="text-gray-500">Comprobando disponibilidad real de salas...</p>
                    ) : compatibleDogRooms.length > 0 ? (
                      <p className="text-green-600">
                        Hay espacio en {compatibleDogRooms.length} sala
                        {compatibleDogRooms.length > 1 ? 's' : ''} de perros:{' '}
                        {compatibleDogRooms.map((room) => room.roomLabel).join(', ')}.
                      </p>
                    ) : (
                      <p className="text-red-600">
                        No hay salas operativas de perros con hueco para esta reserva en esas
                        fechas.
                      </p>
                    )}
                  </div>
                  {errors.dogRoom && (
                    <p className="mt-1 text-sm text-red-600">{errors.dogRoom}</p>
                  )}
                </>
              ) : (
                <>
                  <div className="mt-2 text-xs">
                    {formData.pets.length === 0 ? (
                      <p className="text-gray-500">
                        Selecciona mascotas para ver las salas compatibles.
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
                </>
              )}
            </div>

            {selectedPetsSpeciesGroup === 'mixed' && (
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <DoorOpen className="h-4 w-4" />
                  Sala para gatos
                </label>
                <select
                  value={formData.catRoom}
                  onChange={(event) => handleChange('catRoom', event.target.value)}
                  disabled={
                    isSubmitting ||
                    !roomAvailabilityReady ||
                    formData.pets.length === 0 ||
                    !formData.checkIn ||
                    !formData.checkOut ||
                    catRoomSelectOptions.length === 0
                  }
                  className={`h-9 w-full rounded-md border bg-input-background px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 ${
                    errors.catRoom ? 'border-red-300' : 'border-input'
                  }`}
                >
                  {!roomAvailabilityReady ? (
                    <option value="">Cargando salas...</option>
                  ) : catRoomSelectOptions.length > 0 ? null : (
                    <option value="">No hay salas para gatos disponibles</option>
                  )}
                  {catRoomSelectOptions.map((room) => (
                    <option key={room.roomId} value={room.roomLabel}>
                      {room.roomLabel} · {formatRoomTypeLabel(room.roomType)} · {room.freeSlots}{' '}
                      plaza{room.freeSlots === 1 ? '' : 's'} libre
                      {room.freeSlots === 1 ? '' : 's'}
                      {room.roomLabel === reservation.room ? ' · sala actual' : ''}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-xs">
                  {!formData.checkIn || !formData.checkOut ? (
                    <p className="text-gray-500">
                      Define las fechas para comprobar disponibilidad en salas de gatos.
                    </p>
                  ) : !roomAvailabilityReady ? (
                    <p className="text-gray-500">Comprobando disponibilidad real de salas...</p>
                  ) : compatibleCatRooms.length > 0 ? (
                    <p className="text-green-600">
                      Hay espacio en {compatibleCatRooms.length} sala
                      {compatibleCatRooms.length > 1 ? 's' : ''} de gatos:{' '}
                      {compatibleCatRooms.map((room) => room.roomLabel).join(', ')}.
                    </p>
                  ) : (
                    <p className="text-red-600">
                      No hay salas operativas de gatos con hueco para esta reserva en esas fechas.
                    </p>
                  )}
                </div>
                {errors.catRoom && <p className="mt-1 text-sm text-red-600">{errors.catRoom}</p>}
                <p className="mt-3 text-xs text-amber-700">
                  Cuando una reserva mezcla perros y gatos, la asignación de salas se guarda de
                  forma local porque el backend actual solo admite una sala por reserva.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Estado</label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                handleChange('status', value as ReservationRecord['status'])
              }
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending" disabled={hasActiveCheckIn}>
                  Pendiente
                </SelectItem>
                <SelectItem value="confirmed" disabled={hasActiveCheckIn}>
                  Confirmada
                </SelectItem>
                <SelectItem value="in_progress">En curso</SelectItem>
                <SelectItem value="completed">Finalizada</SelectItem>
                <SelectItem value="cancelled" disabled={hasActiveCheckIn}>
                  Cancelada
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.status && <p className="mt-2 text-sm text-amber-600">{errors.status}</p>}
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <label className="mb-2 block text-sm font-medium text-gray-700">Estado de pago</label>
            <Select
              value={effectivePaymentStatus}
              disabled
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona el estado de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendiente de pago</SelectItem>
                <SelectItem value="paid">Pagada</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-gray-500">
              El estado de pago se gestiona desde Pagos. El check-in solo se permite cuando el pago
              real está registrado.
            </p>
            {errors.paymentStatus && (
              <p className="mt-2 text-sm text-red-600">{errors.paymentStatus}</p>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.9fr)]">
          <div className="space-y-4 rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Servicios adicionales
                </h3>
                <p className="text-sm text-gray-600">
                  Selecciona nuevos servicios o ajusta los ya incluidos en la reserva.
                </p>
              </div>
              <Badge
                className="border-blue-100 bg-blue-50 text-blue-700"
                variant="outline"
              >
                {formData.services.length} servicios
              </Badge>
            </div>

            {isLoadingServices ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                Cargando servicios disponibles...
              </div>
            ) : isServicesError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                No se pudieron cargar los servicios disponibles. Puedes seguir editando los ya
                incluidos.
              </div>
            ) : activeServices.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {activeServices.map((service) => {
                  const selected = isServiceSelected(service);

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => handleToggleService(service)}
                      disabled={isSubmitting}
                      className={`rounded-lg border-2 p-4 text-left transition-all ${
                        selected
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-gray-200 hover:border-teal-200 hover:bg-gray-50'
                      } ${isSubmitting ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-gray-900">{service.name}</p>
                          <p className="mt-1 text-sm font-semibold text-teal-600">
                            {formatAmount(service.price)} por unidad
                          </p>
                          {service.description && (
                            <p className="mt-1 text-xs text-gray-500">{service.description}</p>
                          )}
                        </div>
                        {selected && (
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500">
                            <svg
                              className="h-3 w-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                No hay servicios activos disponibles para añadir.
              </div>
            )}

            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-semibold text-gray-900">Servicios incluidos</h4>
              <p className="mt-1 text-sm text-gray-600">
                Puedes subir o bajar la cantidad del servicio, pero no modificar el precio
                unitario.
              </p>
            </div>

            {formData.services.length > 0 ? (
              <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                {formData.services.map((service) => {
                  const initiallyContractedQuantity = service.maxQuantity ?? service.quantity;

                  return (
                    <div
                      key={service.id}
                      className="rounded-xl border border-gray-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="break-words font-medium text-gray-900">{service.name}</p>
                            <p className="mt-1 text-sm text-gray-600">
                              {formatAmount(service.price)} por unidad
                            </p>
                            <p className="mt-2 text-xs text-gray-500">
                              Contratado inicialmente: {initiallyContractedQuantity}
                            </p>
                          </div>

                          <div className="shrink-0 text-left sm:text-right">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="font-medium text-gray-900">
                              {formatAmount(service.price * service.quantity)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              handleServiceQuantityChange(service.id, service.quantity - 1)
                            }
                            disabled={isSubmitting || service.quantity <= 0}
                            className="h-9 w-9 border-gray-200"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={service.quantity}
                            onChange={(event) =>
                              handleServiceQuantityChange(
                                service.id,
                                Number(event.target.value)
                              )
                            }
                            disabled={isSubmitting}
                            className="h-9 w-20 text-center"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              handleServiceQuantityChange(service.id, service.quantity + 1)
                            }
                            disabled={isSubmitting}
                            className="h-9 w-9 border-gray-200"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                Esta reserva no tiene servicios asociados.
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Resumen economico</h3>
                <p className="text-sm text-gray-600">
                  El descuento se puede editar en porcentaje o en euros.
                </p>
              </div>
              <Badge
                className={
                  formData.paymentStatus === 'paid'
                    ? 'border-green-100 bg-green-50 text-green-700'
                    : 'border-orange-100 bg-orange-50 text-orange-700'
                }
                variant="outline"
              >
                {formData.paymentStatus === 'paid' ? 'Pagada' : 'Pendiente de pago'}
              </Badge>
            </div>

            <div className="space-y-3 rounded-xl bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-gray-600">Hospedaje base</span>
                <span className="font-medium text-gray-900">
                  {formatAmount(formData.lodgingAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-gray-600">Servicios</span>
                <span className="font-medium text-gray-900">{formatAmount(servicesSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-3 text-sm">
                <span className="text-gray-600">Subtotal antes de descuento</span>
                <span className="font-medium text-gray-900">
                  {formatAmount(subtotalBeforeDiscount)}
                </span>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)]">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Percent className="h-4 w-4" />
                  Tipo de descuento
                </label>
                <Select
                  value={discountMode}
                  onValueChange={(value) => setDiscountMode(value as DiscountMode)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentaje</SelectItem>
                    <SelectItem value="amount">Euros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  {discountMode === 'percentage' ? (
                    <Percent className="h-4 w-4" />
                  ) : (
                    <Euro className="h-4 w-4" />
                  )}
                  {discountMode === 'percentage' ? 'Descuento (%)' : 'Descuento (€)'}
                </label>
                <Input
                  type="number"
                  min="0"
                  max={discountMode === 'percentage' ? '100' : subtotalBeforeDiscount.toFixed(2)}
                  step="0.01"
                  value={
                    discountMode === 'percentage'
                      ? discountPercentage.toFixed(2)
                      : effectiveDiscountAmount.toFixed(2)
                  }
                  onChange={(event) => handleDiscountInputChange(event.target.value)}
                  disabled={isSubmitting}
                />
                <p className="mt-2 text-xs text-gray-500">
                  {discountMode === 'percentage'
                    ? `Equivale a ${formatAmount(effectiveDiscountAmount)}`
                    : `Equivale al ${discountPercentage.toFixed(2)} %`}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-green-100 bg-green-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-gray-700">Total final</span>
                <span className="text-xl font-semibold text-gray-900">{formatAmount(totalAmount)}</span>
              </div>
              {effectiveDiscountAmount > 0 && (
                <p className="mt-2 text-xs text-gray-600">
                  Incluye un descuento de {formatAmount(effectiveDiscountAmount)} sobre el subtotal.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Notas del cliente
            </label>
            <Textarea
              value={formData.customerNotes}
              onChange={(event) =>
                setFormData((currentData) => ({
                  ...currentData,
                  customerNotes: event.target.value,
                }))
              }
              disabled={isSubmitting}
              placeholder="Indicaciones visibles para el cliente"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Notas internas
            </label>
            <Textarea
              value={formData.internalNotes}
              onChange={(event) =>
                setFormData((currentData) => ({
                  ...currentData,
                  internalNotes: event.target.value,
                }))
              }
              disabled={isSubmitting}
              placeholder="Contexto operativo interno"
            />
          </div>
        </div>

        {errors.submit && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errors.submit}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
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
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function EditReservationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const navigationState = location.state as EditReservationLocationState | null;
  const currentReservationId = id ?? '';
  const numericReservationId = extractReservationNumericId(currentReservationId);
  const normalizedReservationId = Number.isFinite(numericReservationId)
    ? formatReservationCode(numericReservationId)
    : currentReservationId;
  const localOverride = useLocalReservationOverride<ReservationRecord>(normalizedReservationId);
  const { destination: backDestination, label: backLabel } = getSafeReturnNavigation(
    navigationState,
    `/reservas/${normalizedReservationId}`,
    'Volver a la reserva'
  );

  const {
    data: fetchedReservation,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['reservation-detail', normalizedReservationId],
    queryFn: () => fetchReservationDetail(currentReservationId),
    enabled: Boolean(currentReservationId),
  });
  const reservation =
    localOverride && fetchedReservation
      ? mergeReservationWithLocalOverride(fetchedReservation, localOverride)
      : localOverride ?? fetchedReservation ?? null;
  const canPayReservation =
    reservation != null &&
    reservation.paymentStatus !== 'paid' &&
    reservation.status === 'confirmed';
  const handleGoToPayment = () => {
    if (!reservation) {
      return;
    }

    if (!canPayReservation) {
      toast.info('Pago no disponible', {
        description: 'Solo se pueden pagar reservas confirmadas pendientes de pago.',
      });
      return;
    }

    const paymentReturnPath = `/reservas/${reservation.id}/editar`;
    const paymentState: ReservationPaymentNavigationState = {
      returnTo: paymentReturnPath,
      returnLabel: 'Volver a edición',
      returnState: buildReturnNavigationState(backDestination, backLabel),
    };

    navigate(
      buildReservationPaymentPath(reservation, {
        returnTo: paymentState.returnTo,
        returnLabel: paymentState.returnLabel,
      }),
      { state: paymentState }
    );
  };
  const handleSave = (
    updatedReservation: ReservationRecord,
    saveMode: ReservationSaveMode = 'backend'
  ) => {
    saveLocalReservationOverride(updatedReservation);
    queryClient.setQueryData<ReservationRecord>(
      ['reservation-detail', updatedReservation.id],
      updatedReservation
    );
    queryClient.setQueriesData<ReservationRecord>(
      { queryKey: ['reservation-detail'] },
      (currentReservation) =>
        currentReservation?.id === updatedReservation.id ? updatedReservation : currentReservation
    );
    queryClient.setQueryData<ReservationRecord[]>(['reservations-page'], (currentReservations = []) =>
      currentReservations.length > 0
        ? currentReservations.map((reservationItem) =>
            reservationItem.id === updatedReservation.id ? updatedReservation : reservationItem
          )
        : [updatedReservation]
    );
    queryClient.setQueriesData<ClientDetailCache>(
      { queryKey: ['client-detail'] },
      (currentClientDetail) => {
        if (!currentClientDetail?.reservations) {
          return currentClientDetail;
        }

        return {
          ...currentClientDetail,
          reservations: currentClientDetail.reservations.map((reservationItem) =>
            reservationItem.id === updatedReservation.id
              ? mapReservationToClientDetailCache(updatedReservation)
              : reservationItem
          ),
        };
      }
    );

    if (saveMode === 'localFallback') {
      toast.warning('Reserva actualizada en la pantalla', {
        description:
          'La API no aceptó esta edición. Se guardó localmente para no bloquear la gestión.',
      });
    } else if (saveMode === 'localMixedRoomAssignment') {
      toast.warning('Reserva actualizada con salas separadas', {
        description:
          'La combinación de sala para perros y sala para gatos se ha guardado localmente porque el backend actual solo admite una sala por reserva.',
      });
    } else {
      toast.success('Reserva actualizada', {
        description: 'Se ha editado correctamente.',
      });
    }
    navigate(backDestination);
  };

  if (isLoading && !reservation) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(backDestination)}
          className="text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>
        <Card className="border-0 p-6 shadow-md">
          <p className="text-sm text-gray-600">Cargando reserva...</p>
        </Card>
      </div>
    );
  }

  if ((isError && !reservation) || !reservation) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(backDestination)}
          className="text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>

        <Card className="border-0 p-6 shadow-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              {error instanceof Error
                ? error.message
                : 'No se pudo cargar la reserva para editar.'}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(backDestination)}
          className="text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>

        {canPayReservation && reservation && (
          <Button
            onClick={handleGoToPayment}
            className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
          >
            Pagar reserva
          </Button>
        )}
      </div>

      <ReservationEditForm
        key={reservation.id}
        reservation={reservation}
        onCancel={() => navigate(backDestination)}
        onSave={handleSave}
      />
    </div>
  );
}
