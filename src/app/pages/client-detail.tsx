import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Mail, Phone, Pencil, Trash2, Calendar, FileText, MapPin } from 'lucide-react';
import { Button } from '../components/ui/button.tsx';
import { Card } from '../components/ui/card.tsx';
import { ClientPetsSection } from '../components/clients/client-pets-section.tsx';
import { ReservationsTable } from '../components/reservations/reservations-table.tsx';
import { EditClientModal } from '../components/clients/edit-client-modal.tsx';
import {
  AddPetModal,
  type AddedPetSummary,
} from '../components/pets/add-pet-modal.tsx';
import { DeleteConfirmationModal } from '../components/ui/delete-confirmation-modal.tsx';
import {
  isClientLocallyCreated,
  markClientAsLocallyDeleted,
  saveLocalClientOverride,
  useLocalClientCache,
  useLocalClientSnapshot,
} from '../utils/client-local-overrides';
import { useLocalPetCache } from '../utils/pet-local-overrides';
import {
  getSafeReturnNavigation,
  type ReturnNavigationState,
} from '../utils/return-navigation.ts';
import {
  CLIENTS_QUERY_KEY as CLIENTS_LIST_QUERY_KEY,
  deleteClientRequest,
  updateClientRequest,
  type ClientUpsertInput,
} from '../utils/clients-api';
import {
  extractPetPhotoUrl,
  fetchPetsPageData,
  PETS_QUERY_KEY,
} from '../utils/pets-api';
import {
  fetchReservationsPageData,
  type ReservationRecord,
  updateReservationStatusRequest,
} from '../utils/reservations-api';
import {
  saveLocalReservationOverride,
  useAppliedLocalReservationOverrides,
} from '../utils/reservation-local-overrides';
import {
  PAYMENTS_QUERY_KEY,
} from '../utils/payments-api';
import {
  RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY,
  RESERVATION_FORM_CLIENT_PETS_QUERY_KEY,
  RESERVATIONS_QUERY_KEY,
  TRACKING_QUERY_KEY,
  syncDeletedClientReferences,
} from '../utils/deletion-sync';
import { API_BASE_URL, apiFetch } from '../utils/api-client';
import { buildClientDeleteModalCopy } from '../utils/client-delete-modal-copy';

interface ClientRecord {
  id: number;
  name: string;
  email: string;
  phone: string;
  registeredAt: string;
  status: 'active' | 'inactive';
  observations: string;
  initials: string;
  address?: string;
  postalCode?: string;
  city?: string;
}

type EditableClient = Pick<ClientRecord, 'id' | 'name' | 'email' | 'phone'> &
  Partial<Pick<ClientRecord, 'address' | 'postalCode' | 'city' | 'observations'>>;

interface ClientPet {
  id: number;
  name: string;
  species: string;
  breed: string;
  age: number;
  weight: number;
  color: string;
  photoUrl?: string;
  observations?: string;
  isLocalOnly?: boolean;
}

interface ClientReservation {
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

interface BackendClientDetail {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  fechaCreacion: string;
  ciudad?: string | null;
  codigoPostal?: string | null;
  direccion?: string | null;
  observaciones: string | null;
  mascotas: BackendPet[];
  reservas: BackendReservation[];
}

interface BackendPet {
  id: number;
  nombre: string;
  especie: string;
  raza: string;
  color: string;
  edad: number;
  peso: number;
  notas: string | null;
  photoUrl?: unknown;
  imageUrl?: unknown;
  imagenUrl?: unknown;
  fotoUrl?: unknown;
  urlImagen?: unknown;
  urlFoto?: unknown;
  imagen?: unknown;
  foto?: unknown;
}

interface BackendReservation {
  id: number;
  mascotas: string[];
  fechaEntrada: string;
  fechaSalida: string;
  nombreSala: string;
  estado: string;
  importe: number;
}

interface ClientDetailData {
  client: ClientRecord;
  pets: ClientPet[];
  reservations: ClientReservation[];
}

type LocalClientSnapshot = ClientRecord & {
  petsCount?: number;
  reservationsCount?: number;
  isLocalOnly?: boolean;
};

const CLIENTS_URL = API_BASE_URL;
const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const formatReservationCode = (id: number) => `RES-${String(id).padStart(3, '0')}`;

const mapBackendSpeciesToUi = (species: string) => {
  switch (species.toUpperCase()) {
    case 'PERRO':
      return 'Perro';
    case 'GATO':
      return 'Gato';
    default:
      return species.charAt(0).toUpperCase() + species.slice(1).toLowerCase();
  }
};

const mapBackendReservationStatusToUi = (
  status: string
): ClientReservation['status'] => {
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

const mapClientReservationToReservationRecord = (
  reservation: ClientReservation,
  client: ClientRecord,
  pets: ClientPet[]
): ReservationRecord => {
  const numericId = Number(reservation.id.replace(/\D+/g, '')) || 0;
  const status = reservation.status;

  return {
    numericId,
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
        id: matchingPet?.id ?? -(numericId * 100 + index + 1),
        name: petName,
        species: matchingPet?.species === 'Gato' ? 'Gato' : 'Perro',
        breed: matchingPet?.breed ?? 'Raza no especificada',
        age: matchingPet?.age ?? 0,
      };
    }),
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    room: reservation.room || 'Sin sala asignada',
    status,
    totalAmount: reservation.amount,
    notes: '',
    customerNotes: '',
    internalNotes: '',
    services: [],
    createdAt: reservation.checkIn,
    respondedAt: '',
    duration: getReservationDuration(reservation.checkIn, reservation.checkOut),
    discount: 0,
    lodgingAmount: reservation.amount,
    paymentStatus: getReservationPaymentStatus(status),
    checkinData: null,
    checkoutData: null,
  };
};

const fetchClientDetail = async (clientId: string): Promise<ClientDetailData> => {
  const response = await apiFetch(`${CLIENTS_URL}/api/clientes/${clientId}`);

  if (!response.ok) {
    throw new Error('No se pudo cargar el detalle del cliente');
  }

  const rawBody = await response.text();

  if (!rawBody.trim()) {
    throw new Error('El cliente no existe o no devolvio datos');
  }

  const data: BackendClientDetail = JSON.parse(rawBody);

  return {
    client: {
      id: data.id,
      name: data.nombre,
      email: data.email,
      phone: data.telefono,
      registeredAt: data.fechaCreacion,
      status: 'active',
      address: data.direccion ?? '',
      postalCode: data.codigoPostal ?? '',
      city: data.ciudad ?? '',
      observations: data.observaciones ?? '',
      initials: getInitials(data.nombre),
    },
    pets: (data.mascotas ?? []).map((pet) => ({
      id: pet.id,
      name: pet.nombre,
      species: mapBackendSpeciesToUi(pet.especie),
      breed: pet.raza,
      age: pet.edad,
      weight: pet.peso,
      color: pet.color,
      photoUrl: extractPetPhotoUrl(pet),
      observations: pet.notas ?? '',
    })),
    reservations: (data.reservas ?? []).map((reservation) => ({
      id: formatReservationCode(reservation.id),
      pets: reservation.mascotas ?? [],
      checkIn: reservation.fechaEntrada,
      checkOut: reservation.fechaSalida,
      status: mapBackendReservationStatusToUi(reservation.estado),
      amount: reservation.importe ?? 0,
      room: reservation.nombreSala,
    })),
  };
};

export default function ClientDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: clientId } = useParams();
  const numericClientId = Number(clientId) || 0;
  const navigationState = location.state as ReturnNavigationState | null;
  const { destination: backDestination, label: backLabel } = getSafeReturnNavigation(
    navigationState,
    '/clientes',
    'Volver a clientes'
  );
  const [editedClient, setEditedClient] = useState<EditableClient | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddPetModalOpen, setIsAddPetModalOpen] = useState(false);
  const [localPets, setLocalPets] = useState<ClientPet[]>([]);
  const { data: localClientCache } = useLocalClientCache<LocalClientSnapshot>();
  const { data: localPetCache } = useLocalPetCache();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['client-detail', clientId],
    queryFn: () => fetchClientDetail(clientId ?? ''),
    enabled: Boolean(clientId),
  });
  const { data: petsPageData = [] } = useQuery({
    queryKey: PETS_QUERY_KEY,
    queryFn: fetchPetsPageData,
  });
  const { data: reservationsPageData = [] } = useQuery({
    queryKey: RESERVATIONS_QUERY_KEY,
    queryFn: fetchReservationsPageData,
  });
  const updateClientMutation = useMutation({
    mutationFn: (updatedClient: ClientUpsertInput) =>
      updateClientRequest(numericClientId, updatedClient),
  });
  const allReservations = useAppliedLocalReservationOverrides<ReservationRecord>(
    reservationsPageData
  );

  const localClientSnapshot = useLocalClientSnapshot<LocalClientSnapshot>(numericClientId);

  const baseClient =
    data?.client ??
    (localClientSnapshot
      ? {
          id: localClientSnapshot.id,
          name: localClientSnapshot.name,
          email: localClientSnapshot.email,
          phone: localClientSnapshot.phone,
          registeredAt: localClientSnapshot.registeredAt,
          status: localClientSnapshot.status ?? 'active',
          observations: localClientSnapshot.observations ?? '',
          initials: getInitials(localClientSnapshot.name),
          address: localClientSnapshot.address ?? '',
          postalCode: localClientSnapshot.postalCode ?? '',
          city: localClientSnapshot.city ?? '',
        }
      : null);

  const client = baseClient
    ? {
        ...baseClient,
        ...editedClient,
        initials: getInitials(editedClient?.name ?? baseClient.name),
      }
    : null;

  const localCachedPets = useMemo(
    () =>
      [...Object.values(localPetCache?.overrides ?? {}), ...(localPetCache?.created ?? [])]
        .filter((pet) => pet.ownerId === numericClientId)
        .map((pet) => ({
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          age: pet.age,
          weight: Number(pet.weight ?? 0),
          color: 'No especificado',
          photoUrl: pet.photoUrl,
          observations: pet.observations ?? '',
          isLocalOnly: false,
        })),
    [localPetCache, numericClientId]
  );
  const photoUrlByPetId = useMemo(() => {
    const photoEntries = [
      ...petsPageData,
      ...Object.values(localPetCache?.overrides ?? {}),
      ...(localPetCache?.created ?? []),
    ];

    return photoEntries.reduce((photosById, pet) => {
      if (pet.photoUrl) {
        photosById.set(pet.id, pet.photoUrl);
      }

      return photosById;
    }, new Map<number, string>());
  }, [localPetCache, petsPageData]);

  const pets = Array.from(
    [...(data?.pets ?? []), ...localPets, ...localCachedPets].reduce((petsById, pet) => {
      const existingPet = petsById.get(pet.id);
      const resolvedPhotoUrl =
        pet.photoUrl || existingPet?.photoUrl || photoUrlByPetId.get(pet.id) || '';

      petsById.set(
        pet.id,
        existingPet
          ? {
              ...existingPet,
              ...pet,
              photoUrl: resolvedPhotoUrl,
            }
          : {
              ...pet,
              photoUrl: resolvedPhotoUrl,
            }
      );

      return petsById;
    }, new Map<number, ClientPet>()).values()
  );
  const reservations = useMemo(() => {
    if (!client) {
      return [] as ReservationRecord[];
    }

    const reservationsById = new Map<string, ReservationRecord>();

    allReservations
      .filter((reservation) => reservation.client.id === numericClientId)
      .forEach((reservation) => {
        reservationsById.set(reservation.id, reservation);
      });

    (data?.reservations ?? []).forEach((reservation) => {
      if (!reservationsById.has(reservation.id)) {
        reservationsById.set(
          reservation.id,
          mapClientReservationToReservationRecord(reservation, client, pets)
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
  }, [allReservations, client, data?.reservations, numericClientId, pets]);

  const handleBack = () => {
    navigate(backDestination);
  };

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = async (updatedClient: ClientUpsertInput) => {
    if (!client) {
      throw new Error('No se pudo identificar el cliente');
    }

    const savedClient = await updateClientMutation.mutateAsync(updatedClient);
    const nextClient = {
      ...client,
      id: savedClient.id,
      name: savedClient.name,
      email: savedClient.email,
      phone: savedClient.phone,
      address: savedClient.address,
      postalCode: savedClient.postalCode,
      city: savedClient.city,
      observations: savedClient.observations,
      registeredAt: savedClient.registeredAt,
      initials: getInitials(savedClient.name),
      petsCount: pets.length,
      reservationsCount: reservations.length,
      isLocalOnly: localClientSnapshot?.isLocalOnly ?? false,
    };

    saveLocalClientOverride(nextClient);
    setEditedClient({
      id: nextClient.id,
      name: nextClient.name,
      email: nextClient.email,
      phone: nextClient.phone,
      address: nextClient.address,
      postalCode: nextClient.postalCode,
      city: nextClient.city,
      observations: nextClient.observations,
    });
    queryClient.setQueryData<ClientDetailData>(['client-detail', clientId], (currentData) =>
      currentData
        ? {
            ...currentData,
            client: {
              ...currentData.client,
              id: nextClient.id,
              name: nextClient.name,
              email: nextClient.email,
              phone: nextClient.phone,
              registeredAt: nextClient.registeredAt,
              address: nextClient.address,
              postalCode: nextClient.postalCode,
              city: nextClient.city,
              observations: nextClient.observations,
              initials: nextClient.initials,
            },
          }
        : currentData
    );
    queryClient.setQueryData<
      Array<{
        id: number;
        name: string;
        email: string;
        phone: string;
        petsCount: number;
        reservationsCount: number;
        registeredAt: string;
      }>
    >(CLIENTS_LIST_QUERY_KEY, (currentClients = []) =>
      currentClients.map((currentClient) =>
        currentClient.id === nextClient.id
          ? {
              ...currentClient,
              name: nextClient.name,
              email: nextClient.email,
              phone: nextClient.phone,
              petsCount: nextClient.petsCount,
              reservationsCount: nextClient.reservationsCount,
              registeredAt: nextClient.registeredAt,
            }
          : currentClient
      )
    );

    return {
      id: nextClient.id,
      name: nextClient.name,
      email: nextClient.email,
      phone: nextClient.phone,
      address: nextClient.address,
      postalCode: nextClient.postalCode,
      city: nextClient.city,
      observations: nextClient.observations,
    };
  };

  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const handleOpenAddPet = () => {
    setIsAddPetModalOpen(true);
  };

  const handlePetAdded = (_petId: string, petSummary?: AddedPetSummary) => {
    if (!petSummary) {
      return;
    }

    setLocalPets((currentPets) => [...currentPets, petSummary]);

    if (client) {
      saveLocalClientOverride({
        ...client,
        petsCount: pets.length + 1,
        reservationsCount: reservations.length,
        isLocalOnly: localClientSnapshot?.isLocalOnly ?? false,
      });
    }

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['client-detail', String(numericClientId)] }),
      queryClient.invalidateQueries({ queryKey: CLIENTS_LIST_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PETS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: RESERVATION_FORM_CLIENT_PETS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY }),
    ]);
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
    void queryClient.invalidateQueries({ queryKey: ['client-detail', String(numericClientId)] });
  };

  const handleDeleteConfirm = async () => {
    if (!client) {
      return;
    }

    if (pets.length > 0) {
      toast.error('No se puede eliminar el cliente', {
        description: 'Primero elimina sus mascotas registradas.',
      });
      return;
    }

    setIsDeleting(true);

    try {
      if (
        localClientSnapshot?.isLocalOnly ||
        isClientLocallyCreated(client.id, localClientCache)
      ) {
        markClientAsLocallyDeleted(client.id);
        syncDeletedClientReferences(queryClient, client.id);
        toast.success('Cliente eliminado', {
          description: 'Se ha eliminado correctamente.',
        });
        navigate('/clientes');
        return;
      }

      await deleteClientRequest(client.id);
      markClientAsLocallyDeleted(client.id);
      syncDeletedClientReferences(queryClient, client.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CLIENTS_LIST_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: PETS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['client-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['pet-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['reservation-detail'] }),
        queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: TRACKING_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RESERVATION_FORM_CLIENT_PETS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY }),
      ]);
      toast.success('Cliente eliminado', {
        description: 'Se ha eliminado correctamente.',
      });
      navigate('/clientes');
    } catch (deleteError) {
      console.error('Error al eliminar cliente:', deleteError);
      toast.error('No se pudo eliminar el cliente', {
        description: 'Inténtalo de nuevo.',
      });
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleNewReservation = () => {
    if (!client) {
      return;
    }

    const reservationSearchParams = new URLSearchParams({
      clienteId: String(client.id),
      returnTo: `/clientes/${client.id}`,
      returnLabel: 'Volver a cliente',
    });

    navigate(`/reservas/nueva?${reservationSearchParams.toString()}`);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  if (!clientId) {
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
          <p className="text-sm text-gray-600">No se ha indicado ningun cliente.</p>
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
          <p className="text-sm text-gray-600">Cargando datos del cliente...</p>
        </Card>
      </div>
    );
  }

  if ((isError && !localClientSnapshot) || !client) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'No se pudo cargar la ficha del cliente';

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
            <h2 className="text-gray-900">No se pudo cargar el cliente</h2>
            <p className="text-sm text-gray-600">{errorMessage}</p>
          </div>

          <Button variant="outline" onClick={() => refetch()} className="border-gray-200">
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }

  const deleteModalCopy = buildClientDeleteModalCopy(client.name, pets.length);

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="gap-0 border-0 shadow-md">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-gray-900">Datos del cliente</h2>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleEdit}
                className="border-gray-200 hover:bg-gray-50"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Editar cliente
              </Button>
              <Button
                variant="outline"
                onClick={handleDeleteClick}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar cliente
              </Button>
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-green-500 text-xl text-white">
                {client.initials}
              </div>

              <div>
                <div className="mb-2 flex items-center gap-3">
                  <h2 className="text-gray-900">{client.name}</h2>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-700">
                    Activo
                  </span>
                  <span className="text-xs text-gray-500">ID {client.id}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    {client.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    {client.phone}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="h-4 w-4" />
                    Registrado el {formatDate(client.registeredAt)}
                  </div>
                  {(client.address || client.postalCode || client.city) && (
                    <div className="flex items-start gap-2 text-sm text-gray-500">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {client.address}
                        {client.address && (client.postalCode || client.city) ? ' · ' : ''}
                        {[client.postalCode, client.city].filter(Boolean).join(' ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {client.observations && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm text-gray-500">
                    <FileText className="h-4 w-4" />
                    Observaciones
                  </p>
                  <p className="text-sm leading-6 text-gray-700">{client.observations}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <ClientPetsSection
          pets={pets}
          clientId={client.id}
          onCreatePet={handleOpenAddPet}
        />
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-gray-900">Reservas del cliente</h3>

          <Button
            onClick={handleNewReservation}
            className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Crear reserva
          </Button>
        </div>

        {reservations.length > 0 ? (
          <ReservationsTable
            reservations={reservations}
            onUpdateReservation={handleUpdateReservation}
            showClientColumn={false}
            returnNavigationState={{
              returnTo: `/clientes/${client.id}`,
              returnLabel: 'Volver a cliente',
            }}
          />
        ) : (
          <Card className="border-0 p-8 text-center shadow-md">
            <div className="mx-auto max-w-sm">
              <p className="text-sm text-gray-600">
                Este cliente aún no tiene reservas registradas
              </p>
            </div>
          </Card>
        )}
      </div>

      <EditClientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        client={client}
        onSubmit={handleEditSuccess}
      />
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar cliente"
        entityLabel="cliente"
        itemName={client.name}
        question={deleteModalCopy.question}
        description={deleteModalCopy.description}
        isDeleting={isDeleting}
        warningTitle={deleteModalCopy.warningTitle}
        confirmDisabled={deleteModalCopy.confirmDisabled}
      />
      {isAddPetModalOpen && (
        <AddPetModal
          key={`client-detail-${client.id}`}
          isOpen={isAddPetModalOpen}
          onClose={() => setIsAddPetModalOpen(false)}
          onSuccess={handlePetAdded}
          preselectedClientId={client.id}
          preselectedClientName={client.name}
          preselectedClientEmail={client.email}
          preselectedClientPhone={client.phone}
        />
      )}
    </div>
  );
}
