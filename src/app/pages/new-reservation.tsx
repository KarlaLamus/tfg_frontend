import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  User,
  PawPrint,
  Calendar,
  DoorOpen,
  Euro,
  Minus,
  Percent,
  Plus,
  FileText,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import {
  AddPetModal,
  type AddedPetSummary,
} from '../components/pets/add-pet-modal';
import type { EditablePet } from '../components/pets/edit-pet-modal';
import DashboardPage from './dashboard';
import ClientsPage from './clients';
import PetsPage from './pets';
import ReservationsPage from './reservations';
import ServicesPage from './services';
import TrackingPage from './tracking';
import PaymentsPage from './payments';
import RoomsPage from './rooms';
import {
  createReservationRequest,
  fetchReservationsPageData,
  formatReservationCode,
  type ReservationRecord,
} from '../utils/reservations-api';
import { useAppliedLocalReservationOverrides } from '../utils/reservation-local-overrides';
import { useAppliedLocalClientChanges } from '../utils/client-local-overrides';
import { applyLocalPetChanges } from '../utils/pet-local-overrides';
import { useAppliedLocalServiceChanges } from '../utils/service-local-overrides';
import {
  type ReturnNavigationState,
  getSafeReturnNavigation,
} from '../utils/return-navigation';
import {
  formatRoomTypeLabel,
  formatSpeciesGroupLabel,
  getPetsSpeciesGroup,
  getRoomAvailabilityForReservation,
  type ReservationAvailabilityRoom,
} from '../utils/reservation-room-availability';
import { getPetReservationOverlaps } from '../utils/reservation-overlaps';
import { fetchRoomsPageData } from '../utils/rooms-api';
import { API_BASE_URL, apiFetch } from '../utils/api-client';
interface ClientPet {
  id: number;
  name: string;
  species: string;
  breed: string;
}

interface ReservationFormClient {
  id: number;
  name: string;
  email: string;
  phone: string;
  petsCount: number;
  reservationsCount: number;
  registeredAt: string;
}

interface BackendClientListItem {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  numMascotas: number;
  numReservas: number;
  fechaCreacion: string;
}

interface BackendClientDetail {
  mascotas?: Array<{
    id: number;
    nombre: string;
    especie: string;
    raza: string;
    edad: number;
  }>;
}

interface ReservationFormService {
  id: number;
  name: string;
  description: string;
  price: number;
  status: 'active' | 'inactive';
  isLocalOnly?: boolean;
}

interface BackendServiceListItem {
  idServicio: number;
  nombre: string;
  descripcion: string;
  precio: number;
  estado: boolean;
}

const API_URL = API_BASE_URL;
const CLIENTS_QUERY_KEY = ['clients'];
const SERVICES_QUERY_KEY = ['services-page'];
const RESERVATION_FORM_ROOMS_QUERY_KEY = ['reservation-form-rooms'];
type DiscountMode = 'percentage' | 'amount';

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
const getServicesSubtotal = (services: ReservationRecord['services']) =>
  services.reduce((sum, service) => sum + service.price * service.quantity, 0);
const hasConfiguredRoomPrice = (pricePerDay: number | null | undefined) =>
  pricePerDay != null && Number.isFinite(pricePerDay) && pricePerDay >= 0;

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

function ReservationModalBackground({ location }: { location: string }) {
  const pathname = location.split('?')[0] || '/reservas';

  let background: ReactNode;

  if (pathname === '/') {
    background = <DashboardPage />;
  } else if (pathname.startsWith('/clientes')) {
    background = <ClientsPage />;
  } else if (pathname.startsWith('/mascotas')) {
    background = <PetsPage />;
  } else if (pathname.startsWith('/servicios')) {
    background = <ServicesPage />;
  } else if (pathname.startsWith('/seguimiento')) {
    background = <TrackingPage />;
  } else if (pathname.startsWith('/pagos')) {
    background = <PaymentsPage />;
  } else if (pathname.startsWith('/salas')) {
    background = <RoomsPage />;
  } else {
    background = <ReservationsPage />;
  }

  return <div aria-hidden="true">{background}</div>;
}
const RESERVATIONS_QUERY_KEY = ['reservations-page'];

const mapSpeciesToUi = (species: string) =>
  species.toUpperCase() === 'GATO' ? 'Gato' : 'Perro';

const fetchClientsForReservationForm = async (): Promise<ReservationFormClient[]> => {
  const response = await apiFetch(`${API_URL}/api/clientes`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('No se pudieron cargar los clientes');
  }

  const data: BackendClientListItem[] = await response.json();

  return data.map((client) => ({
    id: client.id,
    name: client.nombre,
    email: client.email,
    phone: client.telefono,
    petsCount: client.numMascotas ?? 0,
    reservationsCount: client.numReservas ?? 0,
    registeredAt: client.fechaCreacion,
  }));
};

const fetchClientPetsForReservationForm = async (clientId: number): Promise<ClientPet[]> => {
  const response = await apiFetch(`${API_URL}/api/clientes/${clientId}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('No se pudieron cargar las mascotas del cliente');
  }

  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return [];
  }

  const data: BackendClientDetail = JSON.parse(rawBody);

  const backendPets: EditablePet[] = (data.mascotas ?? []).map((pet) => ({
    id: pet.id,
    name: pet.nombre,
    species: mapSpeciesToUi(pet.especie),
    breed: pet.raza,
    age: 0,
    microchipNumber: '',
    birthDate: '',
    weight: '',
    sex: '',
    neutered: '',
    observations: '',
    photoUrl: '',
    owner: '',
    ownerId: clientId,
    isHosted: false,
    room: null,
  }));

  return applyLocalPetChanges(backendPets)
    .filter((pet) => pet.ownerId === clientId)
    .map((pet) => ({
      id: pet.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
    }));
};

const fetchServicesForReservationForm = async (): Promise<ReservationFormService[]> => {
  const response = await apiFetch(`${API_URL}/api/servicios`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('No se pudieron cargar los servicios');
  }

  const data: BackendServiceListItem[] = await response.json();

  return data.map((service) => ({
    id: service.idServicio,
    name: service.nombre,
    description: service.descripcion,
    price: Number(service.precio ?? 0),
    status: service.estado ? 'active' : 'inactive',
    isLocalOnly: false,
  }));
};

export default function NewReservationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedPetId = searchParams.get('mascotaId');
  const queryReturnTo = searchParams.get('returnTo');
  const queryReturnLabel = searchParams.get('returnLabel');
  const queryReturnState: ReturnNavigationState | null =
    queryReturnTo?.startsWith('/')
      ? { returnTo: queryReturnTo, returnLabel: queryReturnLabel ?? undefined }
      : null;
  const { destination: safeReturnTo } = getSafeReturnNavigation(
    (location.state as ReturnNavigationState | null) ?? queryReturnState,
    '/reservas',
    'Volver a reservas'
  );

  const {
    data: backendClients = [],
    isLoading: isLoadingClients,
    isError: isClientsError,
  } = useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: fetchClientsForReservationForm,
  });
  const {
    data: backendServices = [],
    isLoading: isLoadingServices,
    isError: isServicesError,
  } = useQuery({
    queryKey: SERVICES_QUERY_KEY,
    queryFn: fetchServicesForReservationForm,
  });
  const {
    data: rooms = [],
    isLoading: isLoadingRooms,
    isError: isRoomsError,
  } = useQuery({
    queryKey: RESERVATION_FORM_ROOMS_QUERY_KEY,
    queryFn: fetchRoomsPageData,
  });
  const { data: backendReservations = [], isLoading: isLoadingReservations } = useQuery({
    queryKey: RESERVATIONS_QUERY_KEY,
    queryFn: fetchReservationsPageData,
  });
  const clients = useAppliedLocalClientChanges<ReservationFormClient>(backendClients);
  const services = useAppliedLocalServiceChanges<ReservationFormService>(backendServices);

  const [selectedClient, setSelectedClient] = useState<ReservationFormClient | null>(null);
  const [searchClient, setSearchClient] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [isAddPetModalOpen, setIsAddPetModalOpen] = useState(false);
  const [selectedPets, setSelectedPets] = useState<number[]>([]);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [selectedServices, setSelectedServices] = useState<ReservationRecord['services']>([]);
  const [customerNotes, setCustomerNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [discountMode, setDiscountMode] = useState<DiscountMode>('percentage');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeServices = useMemo(
    () => services.filter((service) => service.status === 'active'),
    [services]
  );
  const reservations = useAppliedLocalReservationOverrides<ReservationRecord>(backendReservations);
  const {
    data: availablePets = [],
    isLoading: isLoadingPets,
    isError: isPetsError,
  } = useQuery({
    queryKey: ['reservation-form-client-pets', selectedClient?.id],
    queryFn: () => fetchClientPetsForReservationForm(selectedClient!.id),
    enabled: Boolean(selectedClient?.id),
  });
  const selectedPetsData = useMemo(
    () => availablePets.filter((pet) => selectedPets.includes(pet.id)),
    [availablePets, selectedPets]
  );
  const selectedPetsSpeciesGroup = useMemo(
    () => getPetsSpeciesGroup(selectedPetsData),
    [selectedPetsData]
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
        pets: selectedPetsData,
        checkIn: checkInDate,
        checkOut: checkOutDate,
      }),
    [availabilityRooms, checkInDate, checkOutDate, reservations, selectedPetsData]
  );
  const compatibleRooms = useMemo(
    () => roomAvailability.filter((room) => room.isSelectable),
    [roomAvailability]
  );
  const selectedRoomAvailability = useMemo(
    () => roomAvailability.find((room) => room.roomId === selectedRoom) ?? null,
    [roomAvailability, selectedRoom]
  );
  const roomAvailabilityReady = !isLoadingRooms && !isLoadingReservations;
  const calculateStayDays = () => {
    if (!checkInDate || !checkOutDate) {
      return 0;
    }

    return Math.ceil(
      (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );
  };
  const stayDays = calculateStayDays();
  const selectedRoomRecord = rooms.find((room) => room.id === selectedRoom) ?? null;
  const selectedRoomPricePerDay = selectedRoomRecord?.pricePerDay ?? null;
  const servicesSubtotal = getServicesSubtotal(selectedServices);
  const lodgingAmount =
    selectedRoomRecord &&
    selectedPetsData.length > 0 &&
    selectedRoomPricePerDay != null &&
    Number.isFinite(selectedRoomPricePerDay) &&
    selectedRoomPricePerDay >= 0
      ? selectedRoomPricePerDay * selectedPetsData.length * stayDays
      : 0;
  const subtotalBeforeDiscount = lodgingAmount + servicesSubtotal;
  const effectiveDiscountAmount = clamp(discountAmount, 0, subtotalBeforeDiscount);
  const totalAmount = Math.max(subtotalBeforeDiscount - effectiveDiscountAmount, 0);
  const discountPercentage =
    subtotalBeforeDiscount > 0 ? (effectiveDiscountAmount / subtotalBeforeDiscount) * 100 : 0;
  const todayDateInputValue = getTodayDateInputValue();
  const minCheckOutDate = checkInDate
    ? getNextDateInputValue(checkInDate)
    : todayDateInputValue;

  useEffect(() => {
    const clientId = searchParams.get('clienteId');
    if (!clientId || clients.length === 0) {
      return;
    }

    const client = clients.find((item) => item.id === Number(clientId));
    if (client) {
      setSelectedClient(client);
    }
  }, [clients, searchParams]);

  const handleBack = () => {
    navigate(safeReturnTo);
  };

  const handlePetAdded = (petId: string, petSummary?: AddedPetSummary) => {
    const resolvedPetId = petSummary?.id ?? Number(petId);

    setIsAddPetModalOpen(false);

    if (!Number.isFinite(resolvedPetId) || resolvedPetId <= 0) {
      return;
    }

    if (petSummary && selectedClient) {
      queryClient.setQueryData<ClientPet[]>(
        ['reservation-form-client-pets', selectedClient.id],
        (currentPets = []) => {
          if (currentPets.some((pet) => pet.id === petSummary.id)) {
            return currentPets;
          }

          return [
            ...currentPets,
            {
              id: petSummary.id,
              name: petSummary.name,
              species: petSummary.species,
              breed: petSummary.breed,
            },
          ];
        }
      );
    }

    setSelectedPets((currentPets) =>
      currentPets.includes(resolvedPetId) ? currentPets : [...currentPets, resolvedPetId]
    );
    setSelectedRoom(null);

    if (errors.pets || errors.room) {
      setErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors.pets;
        delete nextErrors.room;
        return nextErrors;
      });
    }
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchClient.toLowerCase()) ||
    client.email.toLowerCase().includes(searchClient.toLowerCase())
  );

  useEffect(() => {
    if (!selectedClient || !preselectedPetId) {
      return;
    }

    const parsedPetId = Number(preselectedPetId);

    if (!availablePets.some((pet) => pet.id === parsedPetId)) {
      return;
    }

    setSelectedPets((currentPets) =>
      currentPets.includes(parsedPetId) ? currentPets : [parsedPetId]
    );
  }, [availablePets, preselectedPetId, selectedClient]);

  useEffect(() => {
    setSelectedServices((currentServices) =>
      currentServices
        .filter((service) => activeServices.some((activeService) => activeService.id === service.id))
        .map((service) => {
          const activeService = activeServices.find((item) => item.id === service.id);

          return activeService
            ? {
                ...service,
                name: activeService.name,
                price: activeService.price,
              }
            : service;
        })
    );
  }, [activeServices]);

  useEffect(() => {
    setDiscountAmount((currentAmount) => clamp(currentAmount, 0, subtotalBeforeDiscount));
  }, [subtotalBeforeDiscount]);

  useEffect(() => {
    if (stayDays <= 0) {
      return;
    }

    setSelectedServices((currentServices) =>
      currentServices.map((service) => {
        const previousSuggestedQuantity = service.maxQuantity ?? service.quantity;
        const shouldSyncQuantity = service.quantity === previousSuggestedQuantity;

        return {
          ...service,
          quantity: shouldSyncQuantity ? stayDays : service.quantity,
          maxQuantity: stayDays,
        };
      })
    );
  }, [stayDays]);

  useEffect(() => {
    if (
      selectedRoom === null ||
      !roomAvailabilityReady ||
      selectedPetsData.length === 0 ||
      !checkInDate ||
      !checkOutDate ||
      selectedPetsSpeciesGroup === 'mixed'
    ) {
      return;
    }

    if (!selectedRoomAvailability?.isSelectable) {
      setSelectedRoom(null);
    }
  }, [
    checkInDate,
    checkOutDate,
    roomAvailabilityReady,
    selectedRoom,
    selectedPetsData.length,
    selectedPetsSpeciesGroup,
    selectedRoomAvailability,
  ]);

  const togglePet = (petId: number) => {
    setSelectedPets((prev) =>
      prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]
    );
    setSelectedRoom(null);
    if (errors.pets || errors.room) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.pets;
        delete newErrors.room;
        return newErrors;
      });
    }
  };

  const toggleService = (service: ReservationFormService) => {
    setSelectedServices((currentServices) => {
      const serviceAlreadySelected = currentServices.some((item) => item.id === service.id);

      if (serviceAlreadySelected) {
        return currentServices.filter((item) => item.id !== service.id);
      }

      const suggestedQuantity = Math.max(stayDays, 1);

      return [
        ...currentServices,
        {
          id: service.id,
          name: service.name,
          price: service.price,
          quantity: suggestedQuantity,
          maxQuantity: suggestedQuantity,
        },
      ];
    });
  };

  const handleServiceQuantityChange = (serviceId: number, nextQuantity: number) => {
    setSelectedServices((currentServices) =>
      currentServices.map((service) =>
        service.id === serviceId
          ? {
              ...service,
              quantity: Math.max(Math.round(nextQuantity), 0),
            }
          : service
      )
    );
  };

  const handleDiscountInputChange = (value: string) => {
    const normalizedValue = Number(value);
    const safeNumericValue = Number.isFinite(normalizedValue) ? Math.max(normalizedValue, 0) : 0;

    if (discountMode === 'percentage') {
      setDiscountAmount(
        clamp((subtotalBeforeDiscount * safeNumericValue) / 100, 0, subtotalBeforeDiscount)
      );
      return;
    }

    setDiscountAmount(clamp(safeNumericValue, 0, subtotalBeforeDiscount));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedClient) {
      newErrors.client = 'Debes seleccionar un cliente';
    }

    if (selectedPets.length === 0) {
      newErrors.pets = 'Debes seleccionar al menos una mascota';
    }

    if (selectedPetsSpeciesGroup === 'mixed') {
      newErrors.pets =
        'No puedes mezclar perros y gatos en la misma reserva porque las salas están separadas por especie.';
    }

    if (!checkInDate) {
      newErrors.checkIn = 'La fecha de entrada es obligatoria';
    } else if (checkInDate < todayDateInputValue) {
      newErrors.checkIn = 'La fecha de entrada no puede ser anterior al dia actual';
    }

    if (!checkOutDate) {
      newErrors.checkOut = 'La fecha de salida es obligatoria';
    }

    if (checkInDate && checkOutDate && new Date(checkInDate) >= new Date(checkOutDate)) {
      newErrors.checkOut = 'La fecha de salida debe ser posterior a la de entrada';
    }

    const petReservationOverlaps = getPetReservationOverlaps({
      reservations,
      petIds: selectedPets,
      checkIn: checkInDate,
      checkOut: checkOutDate,
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

      newErrors.pets = hasSingleOverlap
        ? `La mascota ya tiene una reserva en esas fechas: ${overlapMessages[0]}.`
        : hasMoreOverlaps
          ? `Ya hay mascotas con reservas en esas fechas. Conflictos: ${overlapMessages.join(', ')} y más.`
          : `Ya hay mascotas con reservas en esas fechas. Conflictos: ${overlapMessages.join(', ')}.`;
    }

    if (!selectedRoom) {
      newErrors.room = 'Debes seleccionar una sala';
    } else if (!hasConfiguredRoomPrice(selectedRoomPricePerDay)) {
      newErrors.room = 'La sala seleccionada no tiene precio diario configurado en base de datos.';
    } else if (!selectedRoomAvailability?.isSelectable) {
      newErrors.room =
        'La sala seleccionada no es compatible con las mascotas elegidas o no tiene plazas libres en esas fechas.';
    }

    return newErrors;
  };

  const canEvaluateRoomAvailability =
    roomAvailabilityReady &&
    selectedPetsData.length > 0 &&
    Boolean(checkInDate) &&
    Boolean(checkOutDate) &&
    selectedPetsSpeciesGroup !== 'mixed';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!selectedClient || !selectedRoomRecord) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const createdReservationId = await createReservationRequest({
        clientId: selectedClient.id,
        roomId: selectedRoomRecord.id,
        petIds: selectedPets,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        customerNotes,
        internalNotes,
        services: selectedServices,
        lodgingAmount,
        subtotalBeforeDiscount,
        discount: effectiveDiscountAmount,
        totalAmount,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['client-detail', String(selectedClient.id)] }),
        queryClient.invalidateQueries({ queryKey: ['reservation-detail'] }),
        queryClient.invalidateQueries({ queryKey: RESERVATION_FORM_ROOMS_QUERY_KEY }),
      ]);

      toast.success('Reserva creada', {
        description: 'La reserva se ha enviado al backend correctamente.',
      });

      navigate(
        createdReservationId > 0
          ? `/reservas/${formatReservationCode(createdReservationId)}`
          : '/reservas',
        {
          state: {
            returnTo: safeReturnTo,
            returnLabel: 'Volver',
          },
        }
      );
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'No se pudo crear la reserva';

      setErrors({ submit: message });
      toast.error('No se pudo crear la reserva', {
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ReservationModalBackground location={safeReturnTo} />

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="mb-1 text-xl text-gray-900">Registrar nueva reserva</h3>
                <p className="text-sm text-gray-600">
                  Añade una nueva estancia al sistema y asigna cliente, mascotas, sala y servicios.
                </p>
              </div>

              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                aria-label="Cerrar modal"
                className="p-1 text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <form id="new-reservation-form" onSubmit={handleSubmit}>
              <div className="mb-6">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-900">
                <User className="h-4 w-4 text-blue-600" />
                Cliente asociado
              </h4>

              {selectedClient ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="mb-1 text-gray-900">{selectedClient.name}</p>
                      <p className="mb-0.5 text-sm text-gray-600">{selectedClient.email}</p>
                      <p className="text-sm text-gray-600">{selectedClient.phone}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(null);
                        setSelectedPets([]);
                        setSelectedRoom(null);
                      }}
                      className="text-gray-600"
                    >
                      Cambiar
                    </Button>
                  </div>
                </div>
              ) : isLoadingClients ? (
                <div className="rounded-lg bg-gray-50 px-4 py-6 text-sm text-gray-600">
                  Cargando clientes disponibles...
                </div>
              ) : isClientsError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
                  No se pudieron cargar los clientes.
                </div>
              ) : (
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Buscar cliente por nombre, teléfono o email"
                    value={searchClient}
                    onChange={(e) => {
                      setSearchClient(e.target.value);
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    className={errors.client ? 'border-red-500' : ''}
                  />

                  {showClientDropdown && searchClient && (
                    <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {filteredClients.length > 0 ? (
                        filteredClients.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              setSelectedClient(client);
                              setSelectedPets([]);
                              setSelectedRoom(null);
                              setSearchClient('');
                              setShowClientDropdown(false);
                              if (errors.client) {
                                setErrors((prev) => {
                                  const newErrors = { ...prev };
                                  delete newErrors.client;
                                  return newErrors;
                                });
                              }
                            }}
                            className="w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 last:border-0"
                          >
                            <p className="mb-0.5 text-sm text-gray-900">{client.name}</p>
                            <p className="text-xs text-gray-600">
                              {client.email} · {client.phone}
                            </p>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-600">
                          No se encontraron clientes
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {errors.client && <p className="mt-1 text-sm text-red-600">{errors.client}</p>}
            </div>

            <div className="mb-6">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-900">
                <PawPrint className="h-4 w-4 text-green-600" />
                Mascotas que se alojarán
              </h4>

              {selectedClient ? (
                isLoadingPets ? (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-6 text-sm text-gray-600">
                    Cargando mascotas del cliente...
                  </div>
                ) : isPetsError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
                    No se pudieron cargar las mascotas del cliente.
                  </div>
                ) : availablePets.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {availablePets.map((pet) => (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => togglePet(pet.id)}
                        className={`rounded-lg border-2 p-4 text-left transition-all ${
                          selectedPets.includes(pet.id)
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-green-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-gray-900">{pet.name}</p>
                            <p className="mt-1 text-sm text-gray-600">
                              {pet.species} · {pet.breed}
                            </p>
                          </div>
                          {selectedPets.includes(pet.id) && (
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                              <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
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
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-white py-8 text-center">
                    <PawPrint className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                    <p className="mb-3 text-gray-600">Este cliente no tiene mascotas registradas</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddPetModalOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Registrar mascota
                    </Button>
                  </div>
                )
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-white py-8 text-center">
                  <p className="text-gray-600">Primero selecciona un cliente</p>
                </div>
              )}
              {errors.pets && <p className="mt-2 text-sm text-red-600">{errors.pets}</p>}
            </div>

            <div className="mb-6">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-900">
                <Calendar className="h-4 w-4 text-purple-600" />
                Fechas de estancia
              </h4>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="checkIn" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Fecha de entrada <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="checkIn"
                      type="date"
                      value={checkInDate}
                      onChange={(e) => {
                        setCheckInDate(e.target.value);
                        setSelectedRoom(null);
                        if (errors.checkIn || errors.checkOut || errors.room || errors.pets) {
                          setErrors((prev) => {
                            const newErrors = { ...prev };
                            delete newErrors.checkIn;
                            delete newErrors.checkOut;
                            delete newErrors.room;
                            delete newErrors.pets;
                            return newErrors;
                          });
                        }
                      }}
                      className={`pl-10 ${errors.checkIn ? 'border-red-500' : ''}`}
                      min={todayDateInputValue}
                    />
                  </div>
                  {errors.checkIn && <p className="mt-1 text-sm text-red-600">{errors.checkIn}</p>}
                </div>

                <div>
                  <label htmlFor="checkOut" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Fecha de salida <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="checkOut"
                      type="date"
                      value={checkOutDate}
                      onChange={(e) => {
                        setCheckOutDate(e.target.value);
                        setSelectedRoom(null);
                        if (errors.checkOut || errors.room || errors.pets) {
                          setErrors((prev) => {
                            const newErrors = { ...prev };
                            delete newErrors.checkOut;
                            delete newErrors.room;
                            delete newErrors.pets;
                            return newErrors;
                          });
                        }
                      }}
                      className={`pl-10 ${errors.checkOut ? 'border-red-500' : ''}`}
                      min={minCheckOutDate}
                    />
                  </div>
                  {errors.checkOut && <p className="mt-1 text-sm text-red-600">{errors.checkOut}</p>}
                </div>
              </div>

              {stayDays > 0 && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-800">
                    Duración prevista: <strong>{stayDays} día{stayDays > 1 ? 's' : ''}</strong>
                  </p>
                </div>
              )}
            </div>

            <div className="mb-6">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-900">
                <DoorOpen className="h-4 w-4 text-orange-600" />
                Sala de alojamiento
              </h4>

              <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm">
                {selectedPets.length === 0 ? (
                  <p className="text-gray-600">
                    Selecciona al menos una mascota para ver las salas compatibles.
                  </p>
                ) : selectedPetsSpeciesGroup === 'mixed' ? (
                  <p className="text-amber-700">
                    No puedes alojar perros y gatos en la misma reserva. Selecciona mascotas de una
                    sola especie para asignar sala.
                  </p>
                ) : !checkInDate || !checkOutDate ? (
                  <p className="text-gray-600">
                    Selecciona las fechas para comprobar si hay espacio en salas de{' '}
                    {formatSpeciesGroupLabel(selectedPetsSpeciesGroup)}.
                  </p>
                ) : !roomAvailabilityReady ? (
                  <p className="text-gray-600">Comprobando disponibilidad real de salas...</p>
                ) : compatibleRooms.length > 0 ? (
                  <p className="text-green-700">
                    Hay espacio en {compatibleRooms.length} sala
                    {compatibleRooms.length > 1 ? 's' : ''} de{' '}
                    {formatSpeciesGroupLabel(selectedPetsSpeciesGroup)}: {' '}
                    {compatibleRooms.map((room) => room.roomLabel).join(', ')}.
                  </p>
                ) : (
                  <p className="text-red-700">
                    No hay salas operativas con hueco para {selectedPetsData.length} mascota
                    {selectedPetsData.length > 1 ? 's' : ''} de{' '}
                    {formatSpeciesGroupLabel(selectedPetsSpeciesGroup)} en esas fechas.
                  </p>
                )}
              </div>

              {isLoadingRooms ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-6 text-sm text-gray-600">
                  Cargando salas disponibles...
                </div>
              ) : isRoomsError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
                  No se pudieron cargar las salas.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {rooms.map((room) => {
                    const availability = roomAvailability.find(
                      (availabilityOption) => availabilityOption.roomId === room.id
                    );
                    const isOperational = room.status === 'operational';
                    const isCompatibleSpecies =
                      selectedPetsSpeciesGroup === 'unknown' ||
                      selectedPetsSpeciesGroup === 'mixed'
                        ? false
                        : room.type === selectedPetsSpeciesGroup;
                    const hasRoomPrice = hasConfiguredRoomPrice(room.pricePerDay);
                    const canSelectRoom =
                      canEvaluateRoomAvailability &&
                      Boolean(availability?.isSelectable) &&
                      hasRoomPrice;
                    let helperText = `Sala de ${formatRoomTypeLabel(room.type)} · Tamaño ${room.size} · Capacidad ${room.capacity}`;

                    if (!isOperational) {
                      helperText = 'Sala en mantenimiento';
                    } else if (!hasRoomPrice) {
                      helperText = 'La sala no tiene precio diario configurado en base de datos';
                    } else if (selectedPetsSpeciesGroup === 'mixed') {
                      helperText = 'Las reservas mixtas de perros y gatos no se pueden asignar';
                    } else if (selectedPets.length === 0) {
                      helperText = 'Selecciona mascotas para comprobar compatibilidad';
                    } else if (!checkInDate || !checkOutDate) {
                      helperText = 'Selecciona fechas para comprobar disponibilidad';
                    } else if (!roomAvailabilityReady) {
                      helperText = 'Comprobando disponibilidad real de la sala';
                    } else if (!isCompatibleSpecies) {
                      helperText = `Solo admite ${formatSpeciesGroupLabel(
                        room.type === 'cat' ? 'cat' : 'dog'
                      )}`;
                    } else if (availability && !availability.hasEnoughSpace) {
                      helperText = `Sin hueco suficiente. Libres: ${availability.freeSlots}`;
                    } else if (availability) {
                      helperText = `Plazas libres: ${availability.freeSlots} de ${availability.capacity}`;
                    }

                    return (
                      <button
                        key={room.id}
                        type="button"
                        disabled={!canSelectRoom}
                        onClick={() => {
                          if (!canSelectRoom) {
                            return;
                          }

                          setSelectedRoom(room.id);
                          if (errors.room) {
                            setErrors((prev) => {
                              const newErrors = { ...prev };
                              delete newErrors.room;
                              return newErrors;
                            });
                          }
                        }}
                        className={`rounded-lg border-2 p-4 text-left transition-all ${
                          selectedRoom === room.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-orange-200 hover:bg-gray-50'
                        } ${
                          !canSelectRoom
                            ? 'cursor-not-allowed opacity-60 hover:border-gray-200 hover:bg-white'
                            : ''
                        }`}
                      >
                        <p className="text-gray-900">{room.code}</p>
                        <p className="mb-2 mt-1 text-xs text-gray-500">{helperText}</p>
                        <p className="text-sm font-semibold text-orange-600">
                          {hasRoomPrice
                            ? `${formatAmount(room.pricePerDay ?? 0)}/día`
                            : 'Precio diario no disponible'}
                        </p>
                        {!isOperational && (
                          <p className="mt-2 text-xs font-medium text-red-600">En mantenimiento</p>
                        )}
                        {isOperational && canEvaluateRoomAvailability && availability?.isSelectable && (
                          <p className="mt-2 text-xs font-medium text-green-600">
                            Compatible y con hueco disponible
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {errors.room && <p className="mt-2 text-sm text-red-600">{errors.room}</p>}
            </div>

            <div className="mb-6">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-900">
                <Plus className="h-4 w-4 text-teal-600" />
                Servicios adicionales (opcional)
              </h4>

              {isLoadingServices ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-6 text-sm text-gray-600">
                  Cargando servicios disponibles...
                </div>
              ) : isServicesError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
                  No se pudieron cargar los servicios.
                </div>
              ) : (
                <>
                  {activeServices.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {activeServices.map((service) => {
                        const isSelected = selectedServices.some((item) => item.id === service.id);

                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => toggleService(service)}
                            className={`rounded-lg border-2 p-4 text-left transition-all ${
                              isSelected
                                ? 'border-teal-500 bg-teal-50'
                                : 'border-gray-200 hover:border-teal-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-gray-900">{service.name}</p>
                                <p className="mt-1 text-sm font-semibold text-teal-600">
                                  {formatAmount(service.price)} por unidad
                                </p>
                                {service.description && (
                                  <p className="mt-1 text-xs text-gray-500">
                                    {service.description}
                                  </p>
                                )}
                              </div>
                              {isSelected && (
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500">
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
                    <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-6 text-sm text-gray-600">
                      No hay servicios activos disponibles.
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.9fr)]">
                    <div className="space-y-4 rounded-xl border border-gray-200 p-5">
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900">Servicios incluidos</h5>
                        <p className="mt-1 text-sm text-gray-600">
                          Puedes subir o bajar la cantidad de cada servicio antes de guardar la
                          reserva.
                        </p>
                      </div>

                      {selectedServices.length > 0 ? (
                        <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                          {selectedServices.map((service) => {
                            const suggestedQuantity = service.maxQuantity ?? service.quantity;

                            return (
                              <div
                                key={service.id}
                                className="rounded-xl border border-gray-200 bg-white p-4"
                              >
                                <div className="flex flex-col gap-4">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                      <p className="break-words font-medium text-gray-900">
                                        {service.name}
                                      </p>
                                      <p className="mt-1 text-sm text-gray-600">
                                        {formatAmount(service.price)} por unidad
                                      </p>
                                      <p className="mt-2 text-xs text-gray-500">
                                        Sugerido al añadir: {suggestedQuantity}
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
                                        handleServiceQuantityChange(
                                          service.id,
                                          service.quantity - 1
                                        )
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
                                        handleServiceQuantityChange(
                                          service.id,
                                          service.quantity + 1
                                        )
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
                        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-600">
                          Esta reserva no tiene servicios asociados.
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 rounded-xl border border-gray-200 p-5">
                      <div>
                        <h5 className="text-sm font-semibold text-gray-900">Resumen economico</h5>
                        <p className="mt-1 text-sm text-gray-600">
                          El descuento se puede editar en porcentaje o en euros.
                        </p>
                      </div>

                      <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <span className="text-gray-600">Hospedaje base</span>
                          <span className="font-medium text-gray-900">
                            {formatAmount(lodgingAmount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <span className="text-gray-600">Servicios</span>
                          <span className="font-medium text-gray-900">
                            {formatAmount(servicesSubtotal)}
                          </span>
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
                            {discountMode === 'percentage'
                              ? 'Descuento (%)'
                              : 'Descuento (€)'}
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max={
                              discountMode === 'percentage'
                                ? '100'
                                : subtotalBeforeDiscount.toFixed(2)
                            }
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
                          <span className="text-xl font-semibold text-gray-900">
                            {formatAmount(totalAmount)}
                          </span>
                        </div>
                        {effectiveDiscountAmount > 0 && (
                          <p className="mt-2 text-xs text-gray-600">
                            Incluye un descuento de {formatAmount(effectiveDiscountAmount)} sobre
                            el subtotal.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mb-6">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-900">
                <FileText className="h-4 w-4 text-amber-600" />
                Notas de la reserva
              </h4>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Notas del cliente
                  </label>
                  <Textarea
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Instrucciones o comentarios visibles para el cliente..."
                    rows={4}
                    className="min-h-28 resize-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Notas internas
                  </label>
                  <Textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Contexto operativo interno antes del check-in..."
                    rows={4}
                    className="min-h-28 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-800">
                {subtotalBeforeDiscount > 0
                  ? `Total estimado: ${formatAmount(totalAmount)}. `
                  : ''}
                La reserva quedará registrada en el sistema y podrás gestionarla desde reservas,
                pagos, salas y seguimiento.
              </p>
            </div>

            {errors.submit && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">{errors.submit}</p>
              </div>
            )}

            </form>
          </div>

          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
                className="sm:order-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="new-reservation-form"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600 sm:order-2"
              >
                {isSubmitting ? 'Creando reserva...' : 'Guardar reserva'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {isAddPetModalOpen && selectedClient && (
        <AddPetModal
          key={`reservation-client-${selectedClient.id}`}
          isOpen={isAddPetModalOpen}
          onClose={() => setIsAddPetModalOpen(false)}
          onSuccess={handlePetAdded}
          preselectedClientId={selectedClient.id}
          preselectedClientName={selectedClient.name}
          preselectedClientEmail={selectedClient.email}
          preselectedClientPhone={selectedClient.phone}
        />
      )}
    </>
  );
}
