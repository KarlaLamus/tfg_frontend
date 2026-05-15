import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../auth/auth-context';
import {
  ArrowLeft,
  Dog,
  Cat,
  Pencil,
  Trash2,
  Calendar,
  Scale,
  Scissors,
  FileText,
  User,
  Phone,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import {
  EditPetModal,
  type EditablePet,
  type EditablePetSubmission,
} from '../components/pets/edit-pet-modal';
import {
  EditPetMedicalModal,
  type EditablePetMedicalInfo,
} from '../components/pets/edit-pet-medical-modal';
import { PetMedicalCard } from '../components/pets/pet-medical-card';
import { ReservationsTable } from '../components/reservations/reservations-table';
import { PetTrackingSection } from '../components/pets/pet-tracking-section';
import { DeleteConfirmationModal } from '../components/ui/delete-confirmation-modal';
import {
  NewTrackingModal,
  type TrackingFormData,
} from '../components/tracking/new-tracking-modal';
import {
  getLocalPetOverride,
  getLocallyCreatedPets,
  isPetLocallyCreated,
  isPetLocallyDeleted,
  markPetAsLocallyDeleted,
  removeLocalPetOverride,
  saveLocalPetOverride,
  useLocalPetCache,
} from '../utils/pet-local-overrides';
import { useAppliedLocalClientChanges } from '../utils/client-local-overrides';
import { CLIENTS_QUERY_KEY, fetchClients, type ClientListRecord } from '../utils/clients-api';
import { EMPLOYEES_QUERY_KEY, fetchEmployeesPageData } from '../utils/employees-api';
import {
  deletePetRequest,
  extractPetPhotoUrl,
  fetchPetsPageData,
  mapEditablePetToPetInput,
  PETS_QUERY_KEY,
  PetMedicalBackendUnsupportedError,
  updatePetMedicalInfoRequest,
  updatePetRequest,
} from '../utils/pets-api';
import { PAYMENTS_QUERY_KEY } from '../utils/payments-api';
import {
  fetchReservationsPageData,
  type ReservationRecord,
  updateReservationStatusRequest,
} from '../utils/reservations-api';
import {
  createTrackingRequest,
  TRACKING_QUERY_KEY as TRACKING_PAGE_QUERY_KEY,
  type TrackingCreateInput,
} from '../utils/tracking-api';
import {
  saveLocalReservationOverride,
  useAppliedLocalReservationOverrides,
} from '../utils/reservation-local-overrides';
import {
  RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY,
  RESERVATION_FORM_CLIENT_PETS_QUERY_KEY,
  RESERVATIONS_QUERY_KEY,
  syncDeletedPetReferences,
} from '../utils/deletion-sync';
import {
  buildReturnNavigationState,
  getSafeReturnNavigation,
  type ReturnNavigationState,
} from '../utils/return-navigation';
import { API_BASE_URL, apiFetch } from '../utils/api-client';
import { ImageWithFallback } from '../components/noImg/ImageWithFallback';
import { buildPetDeleteModalCopy } from '../utils/pet-delete-modal-copy';

type PetReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

interface PetReservation {
  id: string;
  checkIn: string;
  checkOut: string;
  status: PetReservationStatus;
  room: string;
}

interface PetMedicalInfo {
  allergies?: string;
  medication?: string;
  specialNeeds?: string;
  vetName?: string;
  vetPhone?: string;
}

interface PetTrackingRecord {
  id: number;
  date: string;
  time: string;
  feeding: string;
  medication: string;
  behavior: string;
  incidents: string;
  staff: string;
}

interface PetDetailOwner {
  id: number;
  name: string;
  phone: string;
  email: string;
}

interface PetDetail {
  id: number;
  name: string;
  species: 'Perro' | 'Gato';
  breed: string;
  birthDate: string;
  weight: number;
  sex: 'Macho' | 'Hembra';
  neutered: boolean;
  color: string;
  observations: string;
  isHosted: boolean;
  currentRoom: string | null;
  microchipNumber: string;
  photoUrl: string;
  owner: PetDetailOwner;
}

interface PetDetailQueryData {
  pet: PetDetail;
  medicalInfo: PetMedicalInfo | null;
  reservations: PetReservation[];
  tracking: PetTrackingRecord[];
}

interface PetDetailLocationState extends ReturnNavigationState {
  focusSection?: 'history';
}

interface BackendPetOwner {
  clienteId: number;
  nombreDueno: string;
  telefonoDueno: string | null;
  emailDueno: string | null;
}

interface BackendPetMedicalInfo {
  idFichaMedica: number;
  alergias: string | null;
  medicacionHabitual: string | null;
  necesidadesEspeciales: string | null;
  veterinario: string | null;
  telefono: string | null;
}

interface BackendPetTrackingRecord {
  idSeguimiento: number;
  nombreEmpleado: string | null;
  alimentacion: string | null;
  medicacionAdministrada: string | null;
  comportamiento: string | null;
  incidencias: string | null;
  fechaSeguimiento: string;
}

interface BackendPetReservation {
  idReserva: number;
  fechaEntrada: string;
  fechaSalida: string;
  estado: string;
  nombreSala: string | null;
}

interface BackendPetDetail {
  idMascota: number;
  nombre: string;
  especie: string;
  raza: string;
  fechaNacimiento: string;
  edad: number;
  peso: number;
  sexo: string;
  esterilizado: boolean;
  numeroMicrochip?: string | null;
  microchipNumber?: string | null;
  microchip?: string | null;
  color: string | null;
  observaciones: string | null;
  dueno: BackendPetOwner;
  fichaMedica: BackendPetMedicalInfo | null;
  seguimientos: BackendPetTrackingRecord[];
  reservas: BackendPetReservation[];
  salaActual: string | null;
}

const PETS_API_URL = API_BASE_URL;

const looksLikeEmail = (value?: string | null) =>
  typeof value === 'string' && value.trim().length > 0 && value.includes('@');

const normalizeText = (value?: string | null) => {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return '';
  }

  const normalizedKey = normalizedValue.toLowerCase();

  if (
    normalizedKey === 'ninguna' ||
    normalizedKey === 'ninguno' ||
    normalizedKey === 'no aplica' ||
    normalizedKey === 'null'
  ) {
    return '';
  }

  return normalizedValue;
};

const normalizeIncidents = (value?: string | null) => {
  const normalizedValue = value?.trim();

  if (!normalizedValue || normalizedValue.toLowerCase().startsWith('sin incidencias')) {
    return 'Ninguna';
  }

  return normalizedValue;
};

const normalizeComparableText = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const mapBackendSpeciesToUi = (species: string): PetDetail['species'] => {
  return species.toUpperCase() === 'GATO' ? 'Gato' : 'Perro';
};

const mapBackendSexToUi = (sex: string): PetDetail['sex'] => {
  return sex.toUpperCase() === 'HEMBRA' ? 'Hembra' : 'Macho';
};

const mapBackendReservationStatusToUi = (status: string): PetReservationStatus => {
  switch (status.toUpperCase()) {
    case 'CONFIRMADA':
      return 'confirmed';
    case 'EN_CURSO':
      return 'in_progress';
    case 'FINALIZADA':
    case 'COMPLETADA':
      return 'completed';
    case 'CANCELADA':
      return 'cancelled';
    case 'PENDIENTE':
    default:
      return 'pending';
  }
};

const formatReservationCode = (id: number) => `RES-${String(id).padStart(3, '0')}`;

const getReservationPaymentStatus = (
  status: ReservationRecord['status']
): ReservationRecord['paymentStatus'] => {
  void status;
  return 'pending';
};

const getReservationDuration = (checkIn: string, checkOut: string) => {
  const start = new Date(`${checkIn}T00:00:00`).getTime();
  const end = new Date(`${checkOut}T00:00:00`).getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0;
  }

  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
};

const getReservationRecencyTimestamp = (reservation: ReservationRecord) => {
  const checkInTimestamp = new Date(`${reservation.checkIn}T00:00:00`).getTime();

  if (!Number.isNaN(checkInTimestamp)) {
    return checkInTimestamp;
  }

  const createdAtTimestamp = new Date(reservation.createdAt).getTime();

  if (!Number.isNaN(createdAtTimestamp)) {
    return createdAtTimestamp;
  }

  return reservation.numericId;
};

const normalizeOwnerContact = (owner: BackendPetOwner) => {
  const possiblePhone = [owner.telefonoDueno, owner.emailDueno].find(
    (value) => value && !looksLikeEmail(value)
  );
  const possibleEmail = [owner.emailDueno, owner.telefonoDueno].find((value) =>
    looksLikeEmail(value)
  );

  return {
    phone: possiblePhone?.trim() ?? '',
    email: possibleEmail?.trim() ?? '',
  };
};

const mapPetReservationToReservationRecord = (
  reservation: PetReservation,
  pet: PetDetail
): ReservationRecord => {
  const numericId = Number(reservation.id.replace(/\D+/g, '')) || 0;
  const status = reservation.status;

  return {
    numericId,
    id: reservation.id,
    client: {
      id: pet.owner.id,
      name: pet.owner.name,
      email: pet.owner.email,
      phone: pet.owner.phone,
    },
    pets: [
      {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        age: calculateAge(pet.birthDate),
      },
    ],
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    room: reservation.room || 'Sin sala asignada',
    status,
    totalAmount: 0,
    notes: '',
    customerNotes: '',
    internalNotes: '',
    services: [],
    createdAt: reservation.checkIn,
    respondedAt: '',
    duration: getReservationDuration(reservation.checkIn, reservation.checkOut),
    discount: 0,
    lodgingAmount: 0,
    paymentStatus: getReservationPaymentStatus(status),
    checkinData: null,
    checkoutData: null,
  };
};

const mapMedicalInfo = (
  medicalInfo: BackendPetMedicalInfo | null
): PetMedicalInfo | null => {
  if (!medicalInfo) {
    return null;
  }

  const mappedMedicalInfo = {
    allergies: normalizeText(medicalInfo.alergias),
    medication: normalizeText(medicalInfo.medicacionHabitual),
    specialNeeds: normalizeText(medicalInfo.necesidadesEspeciales),
    vetName: normalizeText(medicalInfo.veterinario),
    vetPhone: normalizeText(medicalInfo.telefono),
  };

  return Object.values(mappedMedicalInfo).some(Boolean) ? mappedMedicalInfo : null;
};

const mapTrackingRecords = (
  trackingRecords: BackendPetTrackingRecord[] | null | undefined
): PetTrackingRecord[] => {
  return (trackingRecords ?? []).map((record) => {
    const [datePart = '', timePart = '00:00:00'] = record.fechaSeguimiento.split('T');

    return {
      id: record.idSeguimiento,
      date: datePart,
      time: timePart.slice(0, 5),
      feeding: normalizeText(record.alimentacion) || 'Sin registro',
      medication: normalizeText(record.medicacionAdministrada) || 'Ninguna',
      behavior: normalizeText(record.comportamiento) || 'Sin observaciones',
      incidents: normalizeIncidents(record.incidencias),
      staff: normalizeText(record.nombreEmpleado) || 'Sin asignar',
    };
  });
};

const fetchPetDetail = async (petId: string): Promise<PetDetailQueryData> => {
  const response = await apiFetch(`${PETS_API_URL}/api/mascotas/${petId}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('No se pudo cargar el detalle de la mascota');
  }

  const rawBody = await response.text();

  if (!rawBody.trim()) {
    throw new Error('La mascota no existe o no devolvio datos');
  }

  const data: BackendPetDetail = JSON.parse(rawBody);
  const ownerContact = normalizeOwnerContact(data.dueno);

  return {
    pet: {
      id: data.idMascota,
      name: data.nombre,
      species: mapBackendSpeciesToUi(data.especie),
      breed: data.raza,
      birthDate: data.fechaNacimiento,
      weight: data.peso ?? 0,
      sex: mapBackendSexToUi(data.sexo),
      neutered: Boolean(data.esterilizado),
      color: normalizeText(data.color) || 'No especificado',
      observations: normalizeText(data.observaciones),
      isHosted: Boolean(data.salaActual),
      currentRoom: data.salaActual ?? null,
      microchipNumber:
        normalizeText(data.numeroMicrochip) ||
        normalizeText(data.microchipNumber) ||
        normalizeText(data.microchip) ||
        '',
      photoUrl: extractPetPhotoUrl(data),
      owner: {
        id: data.dueno.clienteId,
        name: data.dueno.nombreDueno,
        phone: ownerContact.phone,
        email: ownerContact.email,
      },
    },
    medicalInfo: mapMedicalInfo(data.fichaMedica),
    reservations: (data.reservas ?? []).map((reservation) => ({
      id: formatReservationCode(reservation.idReserva),
      checkIn: reservation.fechaEntrada,
      checkOut: reservation.fechaSalida,
      status: mapBackendReservationStatusToUi(reservation.estado),
      room: normalizeText(reservation.nombreSala) || 'Sin sala asignada',
    })),
    tracking: mapTrackingRecords(data.seguimientos),
  };
};

const applyEditablePetOverride = (
  pet: PetDetail,
  editablePet?: EditablePet | null
): PetDetail => {
  if (!editablePet) {
    return pet;
  }

  const parsedWeight = editablePet.weight ? Number(editablePet.weight) : NaN;

  return {
    ...pet,
    name: editablePet.name.trim() || pet.name,
    species: editablePet.species ?? pet.species,
    breed: editablePet.breed.trim() || pet.breed,
    birthDate: editablePet.birthDate || pet.birthDate,
    weight: Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : pet.weight,
    sex: editablePet.sex === 'Macho' || editablePet.sex === 'Hembra' ? editablePet.sex : pet.sex,
    neutered: editablePet.neutered ? editablePet.neutered === 'Si' : pet.neutered,
    observations: editablePet.observations?.trim() || '',
    microchipNumber: editablePet.microchipNumber?.trim() ?? '',
    photoUrl: editablePet.photoUrl ?? '',
    isHosted: editablePet.isHosted,
    currentRoom: editablePet.room,
    owner: {
      ...pet.owner,
      id: editablePet.ownerId ?? pet.owner.id,
      name: editablePet.owner || pet.owner.name,
    },
  };
};

const formatLongDate = (dateString: string) => {
  if (!dateString) {
    return 'No disponible';
  }

  const parsedDate = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return dateString;
  }

  return parsedDate.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatWeight = (weight: number) => {
  if (!Number.isFinite(weight)) {
    return 'No disponible';
  }

  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1);
};

const calculateAge = (birthDate: string) => {
  if (!birthDate) {
    return 0;
  }

  const today = new Date();
  const birth = new Date(`${birthDate}T00:00:00`);

  if (Number.isNaN(birth.getTime())) {
    return 0;
  }

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

const mapPetDetailToEditablePet = (pet: PetDetail, age: number): EditablePet => ({
  id: pet.id,
  name: pet.name,
  species: pet.species,
  breed: pet.breed,
  age,
  microchipNumber: pet.microchipNumber,
  birthDate: pet.birthDate,
  weight: Number.isFinite(pet.weight) ? String(pet.weight) : '',
  sex: pet.sex,
  neutered: pet.neutered ? 'Si' : 'No',
  observations: pet.observations,
  photoUrl: pet.photoUrl,
  owner: pet.owner.name,
  ownerId: pet.owner.id,
  isHosted: pet.isHosted,
  room: pet.currentRoom,
});

const buildFallbackPetDetailData = (
  editablePet: EditablePet,
  clients: ClientListRecord[]
): PetDetailQueryData => {
  const matchingOwner =
    (editablePet.ownerId
      ? clients.find((client) => client.id === editablePet.ownerId)
      : null) ??
    clients.find(
      (client) => normalizeComparableText(client.name) === normalizeComparableText(editablePet.owner)
    ) ??
    null;
  const parsedWeight = editablePet.weight?.trim()
    ? Number(editablePet.weight.trim().replace(',', '.'))
    : Number.NaN;

  return {
    pet: {
      id: editablePet.id,
      name: editablePet.name,
      species: editablePet.species,
      breed: editablePet.breed.trim() || 'Raza sin especificar',
      birthDate: editablePet.birthDate ?? '',
      weight: Number.isFinite(parsedWeight) ? parsedWeight : Number.NaN,
      sex:
        editablePet.sex === 'Macho' || editablePet.sex === 'Hembra'
          ? editablePet.sex
          : 'Macho',
      neutered: editablePet.neutered === 'Si',
      color: 'No especificado',
      observations: editablePet.observations?.trim() ?? '',
      isHosted: editablePet.isHosted,
      currentRoom: editablePet.room,
      microchipNumber: editablePet.microchipNumber?.trim() ?? '',
      photoUrl: editablePet.photoUrl ?? '',
      owner: {
        id: matchingOwner?.id ?? editablePet.ownerId ?? 0,
        name: matchingOwner?.name ?? editablePet.owner,
        phone: matchingOwner?.phone ?? '',
        email: matchingOwner?.email ?? '',
      },
    },
    medicalInfo: null,
    reservations: [],
    tracking: [],
  };
};

export default function PetDetailPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: petId } = useParams();
  const currentPetId = petId ?? '';
  const numericPetId = Number(petId) || 0;
  const navigationState = location.state as PetDetailLocationState | null;
  const { destination: backDestination, label: backLabel } = getSafeReturnNavigation(
    navigationState,
    '/mascotas',
    'Volver a mascotas'
  );
  const [editedPetDraft, setEditedPetDraft] = useState<EditablePet | null>(null);
  const [editedMedicalInfo, setEditedMedicalInfo] = useState<{
    petId: number;
    value: EditablePetMedicalInfo | null;
  } | null>(null);
  const [isEditPetModalOpen, setIsEditPetModalOpen] = useState(false);
  const [isEditMedicalModalOpen, setIsEditMedicalModalOpen] = useState(false);
  const [isNewTrackingModalOpen, setIsNewTrackingModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingPet, setIsDeletingPet] = useState(false);
  const { data: localPetCache } = useLocalPetCache();
  const persistedEditedPet =
    petId ? getLocalPetOverride(numericPetId, localPetCache) ?? null : null;
  const localCreatedPet =
    petId
      ? getLocallyCreatedPets(localPetCache).find((createdPet) => createdPet.id === numericPetId) ??
        null
      : null;
  const editedPet =
    editedPetDraft?.id === numericPetId ? editedPetDraft : persistedEditedPet;

  useEffect(() => {
    if (petId && isPetLocallyDeleted(numericPetId, localPetCache)) {
      navigate(backDestination, { replace: true });
    }
  }, [backDestination, localPetCache, navigate, numericPetId, petId]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['pet-detail', currentPetId],
    queryFn: () => fetchPetDetail(currentPetId),
    enabled: Boolean(petId),
  });
  const { data: petsPageData = [] } = useQuery({
    queryKey: PETS_QUERY_KEY,
    queryFn: fetchPetsPageData,
  });
  const { data: backendClients = [] } = useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: fetchClients,
  });
  const { data: reservationsPageData = [] } = useQuery({
    queryKey: RESERVATIONS_QUERY_KEY,
    queryFn: fetchReservationsPageData,
  });
  const { data: employees = [] } = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: fetchEmployeesPageData,
  });
  const clients = useAppliedLocalClientChanges<ClientListRecord>(backendClients);
  const allReservations = useAppliedLocalReservationOverrides<ReservationRecord>(
    reservationsPageData
  );
  const fallbackCachedPet =
    petId ? petsPageData.find((currentPet) => currentPet.id === numericPetId) ?? null : null;
  const fallbackPetSource = localCreatedPet ?? persistedEditedPet ?? fallbackCachedPet;

  const localPetData: PetDetailQueryData | null = fallbackPetSource
    ? buildFallbackPetDetailData(fallbackPetSource, clients)
    : null;

  const pet = data
    ? applyEditablePetOverride(data.pet, editedPet)
    : localPetData
      ? applyEditablePetOverride(localPetData.pet, editedPet)
      : null;
  const medicalInfo =
    editedMedicalInfo?.petId === numericPetId
      ? editedMedicalInfo.value
      : data?.medicalInfo ?? localPetData?.medicalInfo ?? null;
  const petReservations = data?.reservations ?? localPetData?.reservations ?? [];
  const tracking = data?.tracking ?? localPetData?.tracking ?? [];
  const fallbackAge = fallbackPetSource?.age ?? 0;
  const age = pet ? (pet.birthDate ? calculateAge(pet.birthDate) : fallbackAge) : fallbackAge;
  const matchedOwnerClient = pet
    ? clients.find((client) => {
        if (pet.owner.id > 0 && client.id === pet.owner.id) {
          return true;
        }

        if (
          pet.owner.email &&
          normalizeComparableText(client.email) === normalizeComparableText(pet.owner.email)
        ) {
          return true;
        }

        if (
          pet.owner.phone &&
          normalizeComparableText(client.phone) === normalizeComparableText(pet.owner.phone)
        ) {
          return true;
        }

        return normalizeComparableText(client.name) === normalizeComparableText(pet.owner.name);
      }) ?? null
    : null;
  const resolvedOwnerId =
    matchedOwnerClient?.id ?? (pet?.owner.id && pet.owner.id > 0 ? pet.owner.id : 0);
  const currentEmployee = useMemo(() => {
    if (!user) {
      return null;
    }

    return (
      employees.find((employee) => normalizeComparableText(employee.email) === normalizeComparableText(user.email)) ??
      employees.find((employee) => normalizeComparableText(employee.name) === normalizeComparableText(user.name)) ??
      null
    );
  }, [employees, user]);
  const editablePet = pet ? mapPetDetailToEditablePet(pet, age) : null;
  const reservations = useMemo(() => {
    if (!pet) {
      return [] as ReservationRecord[];
    }

    const reservationsById = new Map<string, ReservationRecord>();

    allReservations
      .filter((reservation) => reservation.pets.some((reservationPet) => reservationPet.id === pet.id))
      .forEach((reservation) => {
        reservationsById.set(reservation.id, reservation);
      });

    petReservations.forEach((reservation) => {
      if (!reservationsById.has(reservation.id)) {
        reservationsById.set(
          reservation.id,
          mapPetReservationToReservationRecord(reservation, pet)
        );
      }
    });

    return Array.from(reservationsById.values()).sort((leftReservation, rightReservation) => {
      const recencyDifference =
        getReservationRecencyTimestamp(rightReservation) -
        getReservationRecencyTimestamp(leftReservation);

      if (recencyDifference !== 0) {
        return recencyDifference;
      }

      return rightReservation.numericId - leftReservation.numericId;
    });
  }, [allReservations, pet, petReservations]);
  const activeReservation =
    reservations.find((reservation) => reservation.status === 'in_progress') ?? null;
  const deleteModalCopy = buildPetDeleteModalCopy(pet?.name, reservations.length);

  const handleBack = () => {
    navigate(backDestination);
  };

  useEffect(() => {
    if (!data || navigationState?.focusSection !== 'history') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      document
        .getElementById('pet-history-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [data, navigationState?.focusSection]);

  const handleEdit = () => {
    if (!editablePet) {
      return;
    }

    setIsEditPetModalOpen(true);
  };

  const handleEditMedical = () => {
    setIsEditMedicalModalOpen(true);
  };

  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pet) {
      return;
    }

    if (reservations.length > 0) {
      toast.error('No se puede eliminar la mascota', {
        description: 'Esta mascota tiene reservas asociadas.',
      });
      return;
    }

    setIsDeletingPet(true);

    try {
      if (localCreatedPet || isPetLocallyCreated(pet.id, localPetCache)) {
        markPetAsLocallyDeleted(pet.id);
      } else {
        await deletePetRequest(pet.id);
      }

      syncDeletedPetReferences(queryClient, pet.id, resolvedOwnerId || pet.owner.id);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PETS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['client-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['reservation-detail'] }),
        queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: TRACKING_PAGE_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RESERVATION_FORM_CLIENT_PETS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY }),
      ]);

      toast.success('Mascota eliminada', {
        description: 'Se ha eliminado correctamente.',
      });
      setIsDeleteModalOpen(false);
      navigate(backDestination, { replace: true });
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la mascota';
      toast.error('No se pudo eliminar la mascota', {
        description: message,
      });
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeletingPet(false);
    }
  };

  const handleNewReservation = () => {
    if (!pet || !resolvedOwnerId) {
      toast.error('Cliente no disponible', {
        description: 'No se pudo identificar al dueño para crear la reserva.',
      });
      return;
    }

    const reservationSearchParams = new URLSearchParams({
      clienteId: String(resolvedOwnerId),
      mascotaId: String(pet.id),
      returnTo: `/mascotas/${pet.id}`,
      returnLabel: 'Volver a mascota',
    });

    navigate(`/reservas/nueva?${reservationSearchParams.toString()}`);
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
    queryClient.setQueryData<ReservationRecord[]>(RESERVATIONS_QUERY_KEY, (currentReservations = []) =>
      currentReservations.map((reservation) =>
        reservation.id === nextReservation.id ? nextReservation : reservation
      )
    );
    queryClient.setQueryData<ReservationRecord>(
      ['reservation-detail', nextReservation.id],
      nextReservation
    );
    void queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['reservation-detail', nextReservation.id] });
    void queryClient.invalidateQueries({ queryKey: ['pet-detail', currentPetId] });
    if (resolvedOwnerId) {
      void queryClient.invalidateQueries({ queryKey: ['client-detail', String(resolvedOwnerId)] });
    }
  };

  const handleOpenOwnerProfile = () => {
    if (!pet || !resolvedOwnerId) {
      toast.error('Ficha del dueño no disponible', {
        description: 'No se pudo identificar al cliente asociado a esta mascota.',
      });
      return;
    }

    navigate(`/clientes/${resolvedOwnerId}`, {
      state: buildReturnNavigationState(`/mascotas/${pet.id}`, 'Volver a mascota'),
    });
  };

  const handleSaveEditedPet = async (updatedPet: EditablePetSubmission) => {
    const ownerId = updatedPet.ownerId ?? resolvedOwnerId;

    if (!ownerId) {
      throw new Error('No se pudo identificar al dueño de la mascota');
    }

    const { photoFile = null, ...persistedPet } = updatedPet;
    const petToPersist = {
      ...persistedPet,
      ownerId,
    };

    const updateResult = await updatePetRequest(petToPersist.id, mapEditablePetToPetInput(petToPersist), {
      photoFile,
    });

    if (updateResult.photoSavedToBackend && !petToPersist.photoUrl) {
      removeLocalPetOverride(updatedPet.id);
    } else {
      saveLocalPetOverride(petToPersist);
    }

    setEditedPetDraft(null);
    queryClient.setQueryData<EditablePet[]>(['pets-page'], (currentPets = []) =>
      currentPets.map((currentPet) =>
        currentPet.id === petToPersist.id ? petToPersist : currentPet
      )
    );
    queryClient.setQueryData<PetDetailQueryData>(
      ['pet-detail', String(petToPersist.id)],
      (currentData) =>
        currentData
          ? {
              ...currentData,
              pet: applyEditablePetOverride(currentData.pet, petToPersist),
            }
          : currentData
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: PETS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['pet-detail', currentPetId] }),
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['client-detail', String(ownerId)] }),
      queryClient.invalidateQueries({ queryKey: RESERVATION_FORM_CLIENT_PETS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY }),
    ]);
  };

  const handleSaveMedicalInfo = async (medicalInfoToSave: EditablePetMedicalInfo) => {
    if (!pet) {
      throw new Error('No se pudo identificar la mascota');
    }

    const normalizedMedicalInfo = Object.values(medicalInfoToSave).some((value) => value.trim())
      ? {
          allergies: medicalInfoToSave.allergies.trim(),
          medication: medicalInfoToSave.medication.trim(),
          specialNeeds: medicalInfoToSave.specialNeeds.trim(),
          vetName: medicalInfoToSave.vetName.trim(),
          vetPhone: medicalInfoToSave.vetPhone.trim(),
        }
      : null;

    try {
      await updatePetMedicalInfoRequest(pet.id, {
        allergies: normalizedMedicalInfo?.allergies ?? '',
        medication: normalizedMedicalInfo?.medication ?? '',
        specialNeeds: normalizedMedicalInfo?.specialNeeds ?? '',
        vetName: normalizedMedicalInfo?.vetName ?? '',
        vetPhone: normalizedMedicalInfo?.vetPhone ?? '',
      });
    } catch (saveError) {
      if (!(saveError instanceof PetMedicalBackendUnsupportedError)) {
        throw saveError;
      }

      setEditedMedicalInfo({
        petId: numericPetId,
        value: normalizedMedicalInfo,
      });
      queryClient.setQueryData<PetDetailQueryData>(
        ['pet-detail', currentPetId],
        (currentData) =>
          currentData
            ? {
                ...currentData,
                medicalInfo: normalizedMedicalInfo,
              }
            : currentData
      );
      toast.warning('Ficha médica guardada solo en la app', {
        description:
          'La API no permite crear la primera ficha médica de esta mascota. La información se ha guardado localmente en esta sesión.',
      });
      setIsEditMedicalModalOpen(false);
      return;
    }

    setEditedMedicalInfo({
      petId: numericPetId,
      value: normalizedMedicalInfo,
    });
    queryClient.setQueryData<PetDetailQueryData>(
      ['pet-detail', currentPetId],
      (currentData) =>
        currentData
          ? {
              ...currentData,
              medicalInfo: normalizedMedicalInfo,
            }
          : currentData
    );

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['pet-detail', currentPetId] }),
      queryClient.invalidateQueries({ queryKey: TRACKING_PAGE_QUERY_KEY }),
    ]);

    toast.success('Ficha médica actualizada', {
      description: 'Se ha guardado correctamente en la base de datos.',
    });
  };

  const handleOpenNewTracking = () => {
    setIsNewTrackingModalOpen(true);
  };

  const handleTrackingSubmit = async (trackingData: TrackingFormData) => {
    if (!pet) {
      return;
    }

    const activeReservationRecord =
      reservations.find((reservation) => reservation.status === 'in_progress') ?? null;
    const trackingInput: TrackingCreateInput = {
      petId: pet.id,
      reservationId: activeReservationRecord?.numericId ?? trackingData.reservaId,
      employeeId: currentEmployee?.id ?? (trackingData.empleadoId > 0 ? trackingData.empleadoId : null),
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
    };

    try {
      await createTrackingRequest(trackingInput);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: TRACKING_PAGE_QUERY_KEY }),
      ]);

      toast.success('Seguimiento registrado correctamente', {
        description: 'Se ha guardado correctamente en la base de datos.',
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

  if (!petId) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-gray-600 hover:text-gray-900 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {backLabel}
        </Button>

        <Card className="border-0 p-6 shadow-md">
          <p className="text-sm text-gray-600">No se ha indicado ninguna mascota.</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-gray-600 hover:text-gray-900 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {backLabel}
        </Button>

        <Card className="border-0 p-6 shadow-md">
          <p className="text-sm text-gray-600">Cargando datos de la mascota...</p>
        </Card>
      </div>
    );
  }

  if ((isError && !localPetData) || !pet) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'No se pudo cargar la ficha de la mascota';

    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="text-gray-600 hover:text-gray-900 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {backLabel}
        </Button>

        <Card className="space-y-4 border-0 p-6 shadow-md">
          <div className="space-y-2">
            <h2 className="text-gray-900">No se pudo cargar la mascota</h2>
            <p className="text-sm text-gray-600">{errorMessage}</p>
          </div>

          <Button variant="outline" onClick={() => refetch()} className="border-gray-200">
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={handleBack}
        className="text-gray-600 hover:text-gray-900 -ml-2"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {backLabel}
      </Button>

      <Card className="gap-0 border-0 shadow-md">
        <div className="px-6 pt-6 pb-4">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              {pet.photoUrl ? (
                <ImageWithFallback
                  src={pet.photoUrl}
                  alt={`Foto de ${pet.name}`}
                  className="h-16 w-16 shrink-0 overflow-hidden rounded-full object-cover"
                />
              ) : (
                <div
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${
                    pet.species === 'Perro'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-purple-100 text-purple-600'
                  }`}
                >
                  {pet.species === 'Perro' ? (
                    <Dog className="h-8 w-8" />
                  ) : (
                    <Cat className="h-8 w-8" />
                  )}
                </div>
              )}

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-gray-900">{pet.name}</h2>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                    {pet.species}
                  </span>
                  <span className="text-xs text-gray-500">ID {pet.id}</span>
                  {pet.isHosted && (
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-700">
                      Hospedado
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">
                    Dueño:{' '}
                    <button
                      onClick={handleOpenOwnerProfile}
                      className="text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {pet.owner.name}
                    </button>
                  </p>
                  {pet.isHosted && (
                    <p className="text-sm text-gray-600">
                      Sala actual: <span className="text-gray-900">{pet.currentRoom}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleEdit}
                className="border-gray-200 hover:bg-gray-50"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Editar mascota
              </Button>
              <Button
                variant="outline"
                onClick={handleDeleteClick}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
              <Button
                onClick={handleNewReservation}
                className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Crear reserva
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 px-6 pt-3 pb-5">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h3 className="mb-4 text-gray-900">Información general</h3>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-gray-500">Nombre</label>
                  <p className="text-gray-900">{pet.name}</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-500">Especie</label>
                  <p className="text-gray-900">{pet.species}</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-500">Raza</label>
                  <p className="text-gray-900">{pet.breed}</p>
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="h-4 w-4" />
                    Fecha de nacimiento
                  </label>
                  <p className="text-gray-900">
                    {formatLongDate(pet.birthDate)}
                    {pet.birthDate || age > 0
                      ? ` (${age} ${age === 1 ? 'año' : 'años'})`
                      : ''}
                  </p>
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                    <Scale className="h-4 w-4" />
                    Peso (kg)
                  </label>
                  <p className="text-gray-900">
                    {Number.isFinite(pet.weight) ? `${formatWeight(pet.weight)} kg` : 'No disponible'}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-500">Sexo</label>
                  <p className="text-gray-900">{pet.sex}</p>
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                    <Scissors className="h-4 w-4" />
                    Esterilizado
                  </label>
                  <p className="text-gray-900">{pet.neutered ? 'Sí' : 'No'}</p>
                </div>

                {pet.microchipNumber && (
                  <div>
                    <label className="mb-1 block text-sm text-gray-500">Numero de microchip</label>
                    <p className="text-gray-900">{pet.microchipNumber}</p>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm text-gray-500">Color</label>
                  <p className="text-gray-900">{pet.color}</p>
                </div>

                {pet.observations && (
                  <div className="sm:col-span-2 xl:col-span-3">
                    <label className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                      <FileText className="h-4 w-4" />
                      Observaciones
                    </label>
                    <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                      {pet.observations}
                    </p>
                  </div>
                )}

                <div className="sm:col-span-2 xl:col-span-3 pt-2">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-500">
                      <User className="h-4 w-4" />
                      Información del dueño
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenOwnerProfile}
                      className="border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Ver ficha
                    </Button>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm text-gray-500">Nombre completo</label>
                        <p className="text-gray-900">{pet.owner.name}</p>
                      </div>

                      <div>
                        <label className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                          <Phone className="h-4 w-4" />
                          Teléfono
                        </label>
                        {pet.owner.phone ? (
                          <a
                            href={`tel:${pet.owner.phone}`}
                            className="text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {pet.owner.phone}
                          </a>
                        ) : (
                          <p className="text-sm text-gray-400">No disponible</p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                          <Mail className="h-4 w-4" />
                          Correo electrónico
                        </label>
                        {pet.owner.email ? (
                          <a
                            href={`mailto:${pet.owner.email}`}
                            className="break-all text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {pet.owner.email}
                          </a>
                        ) : (
                          <p className="text-sm text-gray-400">No disponible</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <PetMedicalCard medicalInfo={medicalInfo} onEdit={handleEditMedical} />
            </div>
          </div>
        </div>
      </Card>

      <div id="pet-history-section" className="space-y-6">
        <div className="space-y-6">
          <h3 className="text-gray-900">Historial de estancias</h3>

          {reservations.length > 0 ? (
            <ReservationsTable
              reservations={reservations}
              onUpdateReservation={handleUpdateReservation}
              showClientColumn={false}
              returnNavigationState={{
                returnTo: `/mascotas/${pet.id}`,
                returnLabel: 'Volver a mascota',
                focusSection: 'history',
              }}
            />
          ) : (
            <Card className="border-0 p-8 text-center shadow-md">
              <div className="mx-auto max-w-sm">
                <p className="text-sm text-gray-600">
                  Esta mascota aún no tiene reservas registradas
                </p>
              </div>
            </Card>
          )}

          {pet.isHosted && (
            <PetTrackingSection
              tracking={tracking}
              onCreateTracking={handleOpenNewTracking}
              maxRecords={3}
            />
          )}
        </div>
      </div>

      {isEditPetModalOpen && editablePet && (
        <EditPetModal
          key={`${pet.id}-${pet.name}-${pet.birthDate}`}
          isOpen={isEditPetModalOpen}
          onClose={() => setIsEditPetModalOpen(false)}
          onSave={handleSaveEditedPet}
          pet={editablePet}
        />
      )}
      <EditPetMedicalModal
        key={`${pet.id}-${medicalInfo?.allergies ?? ''}-${medicalInfo?.vetName ?? ''}`}
        isOpen={isEditMedicalModalOpen}
        onClose={() => setIsEditMedicalModalOpen(false)}
        onSave={handleSaveMedicalInfo}
        medicalInfo={{
          allergies: medicalInfo?.allergies ?? '',
          medication: medicalInfo?.medication ?? '',
          specialNeeds: medicalInfo?.specialNeeds ?? '',
          vetName: medicalInfo?.vetName ?? '',
          vetPhone: medicalInfo?.vetPhone ?? '',
        }}
      />
      {pet && activeReservation && (
        <NewTrackingModal
          isOpen={isNewTrackingModalOpen}
          onClose={() => setIsNewTrackingModalOpen(false)}
          onSubmit={handleTrackingSubmit}
          petName={pet.name}
          reservationId={activeReservation.numericId}
          reservationCode={activeReservation.id}
          employeeId={currentEmployee?.id ?? 0}
          employeeName={currentEmployee?.name ?? user?.name ?? 'Sin asignar'}
        />
      )}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar mascota"
        entityLabel="mascota"
        itemName={pet.name}
        question={deleteModalCopy.question}
        description={deleteModalCopy.description}
        isDeleting={isDeletingPet}
        warningTitle={deleteModalCopy.warningTitle}
        confirmDisabled={deleteModalCopy.confirmDisabled}
      />
    </div>
  );
}
