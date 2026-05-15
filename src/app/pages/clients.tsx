// Hook de React para gestionar estado local y memorizar cálculos.
import { useMemo, useState } from 'react';

// Hooks de React Query para lectura de datos, mutaciones
// y acceso al cliente global de caché.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Icono utilizado en el botón de creación de cliente.
import { Plus } from 'lucide-react';

// Componentes de UI reutilizables dentro de la aplicación.
import { Button } from '../components/ui/button';
import { ClientsFilters, type ClientFilters } from '../components/clients/clients-filters';
import { ClientsTable } from '../components/clients/clients-table';
import {
  AddClientModal,
  type AddedClientSummary,
} from '../components/clients/add-client-modal';
import {
  AddPetModal,
  type AddedPetSummary,
} from '../components/pets/add-pet-modal';
import { DeleteConfirmationModal } from '../components/ui/delete-confirmation-modal';

// Función que permite realizar búsquedas flexibles
// sobre múltiples campos de texto.
import { smartSearch } from '../utils/search';
import {
  isClientLocallyCreated,
  markClientAsLocallyDeleted,
  saveLocalClientOverride,
  useAppliedLocalClientChanges,
  useLocalClientCache,
} from '../utils/client-local-overrides';
import {
  CLIENTS_QUERY_KEY,
  createClientRequest,
  deleteClientRequest,
  fetchClients,
  type ClientUpsertInput,
  type ClientListRecord,
} from '../utils/clients-api';
import { PETS_QUERY_KEY } from '../utils/pets-api';
import {
  RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY,
  RESERVATION_FORM_CLIENT_PETS_QUERY_KEY,
  RESERVATIONS_QUERY_KEY,
  TRACKING_QUERY_KEY,
  syncDeletedClientReferences,
} from '../utils/deletion-sync';
import { PAYMENTS_QUERY_KEY } from '../utils/payments-api';
import { buildClientDeleteModalCopy } from '../utils/client-delete-modal-copy';
type Client = ClientListRecord;

export default function ClientsPage() {
  // Estado booleano que controla la visibilidad del modal de creación de cliente.
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);

  // Estado booleano que controla la visibilidad del modal de creación de mascota.
  const [isAddPetModalOpen, setIsAddPetModalOpen] = useState(false);

  // Estado que almacena temporalmente los datos del cliente recién creado,
  // necesario para asociar una mascota inmediatamente después.
  const [newClientData, setNewClientData] = useState<AddedClientSummary | null>(null);
  const [clientPendingDelete, setClientPendingDelete] = useState<Client | null>(null);

  // Estado local de filtros.
  // Los filtros sí son estado del frontend, no datos del backend.
  const [filters, setFilters] = useState<ClientFilters>({
    searchTerm: '',
    petsFilter: 'all',
    reservationsFilter: 'all',
    sortByDate: 'newest',
  });

  // Acceso al cliente global de React Query.
  // Se usa para invalidar queries cuando los datos cambian.
  const queryClient = useQueryClient();
  const { data: localClientCache } = useLocalClientCache<Client>();

  // useQuery se encarga de:
  // - llamar a la API
  // - guardar el resultado en caché
  // - reutilizarlo mientras siga fresco
  // - exponer estados como isLoading, isError, etc.
  const {
    data: backendClients = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: fetchClients,
  });

  // useMutation se usa para operaciones que modifican datos:
  // create, update, delete, etc.
  const deleteClientMutation = useMutation({
    mutationFn: deleteClientRequest,
  });

  // Lista filtrada calculada a partir de los clientes obtenidos del backend
  // y los filtros actuales del frontend.
  // useMemo evita recalcularla innecesariamente en cada render.
  const clients = useAppliedLocalClientChanges<Client>(backendClients);

  const filteredClients = useMemo(() => {
    // Se crea una copia de la lista original para no modificarla directamente.
    let filtered = [...clients];

    // Si existe texto de búsqueda, se filtra utilizando smartSearch
    // sobre nombre, correo y teléfono.
    if (filters.searchTerm) {
      filtered = filtered.filter((client) =>
        smartSearch(filters.searchTerm, client.name, client.email, client.phone)
      );
    }

    // Si el filtro de mascotas indica "withPets",
    // solo permanecen clientes con al menos una mascota.
    if (filters.petsFilter === 'withPets') {
      filtered = filtered.filter((client) => client.petsCount > 0);
    }

    // Si el filtro de mascotas indica "withoutPets",
    // solo permanecen clientes sin mascotas registradas.
    if (filters.petsFilter === 'withoutPets') {
      filtered = filtered.filter((client) => client.petsCount === 0);
    }

    // Si el filtro de reservas indica "withReservations",
    // solo permanecen clientes con una o más reservas.
    if (filters.reservationsFilter === 'withReservations') {
      filtered = filtered.filter((client) => client.reservationsCount > 0);
    }

    // Si el filtro de reservas indica "withoutReservations",
    // solo permanecen clientes sin reservas registradas.
    if (filters.reservationsFilter === 'withoutReservations') {
      filtered = filtered.filter((client) => client.reservationsCount === 0);
    }

    // Ordenación por fecha de alta, de más reciente a más antiguo.
    if (filters.sortByDate === 'newest') {
      filtered.sort(
        (a, b) =>
          new Date(b.registeredAt).getTime() -
          new Date(a.registeredAt).getTime()
      );
    }

    // Ordenación por fecha de alta, de más antiguo a más reciente.
    if (filters.sortByDate === 'oldest') {
      filtered.sort(
        (a, b) =>
          new Date(a.registeredAt).getTime() -
          new Date(b.registeredAt).getTime()
      );
    }

    return filtered;
  }, [clients, filters]);

  // Función encargada de recibir y guardar los filtros
  // enviados desde el componente de filtros.
  const handleSearch = (newFilters: ClientFilters) => {
    setFilters(newFilters);
  };

  // Abre el modal de creación de cliente.
  const handleNewClient = () => {
    setIsAddClientModalOpen(true);
  };

  const handleCreateClient = async (
    clientData: ClientUpsertInput
  ): Promise<AddedClientSummary> => {
    const createdClient = await createClientRequest(clientData);

    queryClient.setQueryData<Client[]>(CLIENTS_QUERY_KEY, (currentClients = []) => {
      const nextClient: Client = {
        ...createdClient,
      };
      const alreadyExists = currentClients.some((client) => client.id === nextClient.id);

      if (alreadyExists) {
        return currentClients.map((client) =>
          client.id === nextClient.id ? nextClient : client
        );
      }

      return [nextClient, ...currentClients];
    });

    return {
      ...createdClient,
      isLocalOnly: false,
    };
  };

  // Maneja el evento de creación de cliente.
  const handleClientAdded = (
    client: AddedClientSummary,
    shouldAddPet: boolean
  ) => {
    // Si se debe continuar con la creación de mascota...
    if (shouldAddPet) {
      // Se almacenan temporalmente los datos del cliente.
      setNewClientData(client);

      // Se abre el modal de mascota.
      setIsAddPetModalOpen(true);
    }
  };

  // Maneja el evento de creación de mascota.
  const handlePetAdded = (_petId: string, petSummary?: AddedPetSummary) => {
    if (petSummary && newClientData) {
      saveLocalClientOverride({
        ...newClientData,
        petsCount: newClientData.petsCount + 1,
      });
    }

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: PETS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: RESERVATION_FORM_CLIENT_PETS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY }),
    ]);

    // Se cierra el modal.
    setIsAddPetModalOpen(false);

    // Se limpia el estado temporal.
    setNewClientData(null);
  };

  // Cierra manualmente el modal de mascota.
  const handleClosePetModal = () => {
    setIsAddPetModalOpen(false);
    setNewClientData(null);
  };

  // Elimina un cliente utilizando una mutación.
  // El backend sigue siendo la fuente de verdad y
  // la vista se sincroniza a traves del cache de React Query.
  const handleDeleteClient = async (id: number) => {
    const clientToDelete = clients.find((client) => client.id === id);

    if (!clientToDelete) {
      return;
    }

    setClientPendingDelete(clientToDelete);
  };

  const handleConfirmDeleteClient = async () => {
    if (!clientPendingDelete) {
      return;
    }

    if ((clientPendingDelete.petsCount ?? 0) > 0) {
      toast.error('No se puede eliminar el cliente', {
        description: 'Primero elimina sus mascotas registradas.',
      });
      return;
    }

    try {
      if (
        clientPendingDelete.isLocalOnly ||
        isClientLocallyCreated(clientPendingDelete.id, localClientCache)
      ) {
        markClientAsLocallyDeleted(clientPendingDelete.id);
        syncDeletedClientReferences(queryClient, clientPendingDelete.id);
        setClientPendingDelete(null);
        toast.success('Cliente eliminado', {
          description: 'Se ha eliminado correctamente.',
        });
        return;
      }

      await deleteClientMutation.mutateAsync(clientPendingDelete.id);
      markClientAsLocallyDeleted(clientPendingDelete.id);
      syncDeletedClientReferences(queryClient, clientPendingDelete.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY }),
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
      setClientPendingDelete(null);
      toast.success('Cliente eliminado', {
        description: 'Se ha eliminado correctamente.',
      });
    } catch (err) {
      console.error(err);
      toast.error('No se pudo eliminar el cliente', {
        description: 'Inténtalo de nuevo.',
      });
    }
  };

  // Render condicional mientras se están cargando datos.
  if (isLoading) {
    return <div>Cargando clientes...</div>;
  }

  // Render condicional en caso de error.
  if (isError) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">
          {error instanceof Error
            ? error.message
            : 'Ha ocurrido un error al cargar los clientes'}
        </p>

        {/* 
          refetch se usa aquí porque el usuario quiere reintentar manualmente
          la carga de esta query concreta.
        */}
        <Button onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const deleteModalCopy = buildClientDeleteModalCopy(
    clientPendingDelete?.name,
    clientPendingDelete?.petsCount ?? 0
  );

  // Render principal del componente.
  return (
    <div className="space-y-6">
      {/* Cabecera de la página */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-gray-900 mb-2">Gestión de Clientes</h2>
          <p className="text-sm text-gray-600 max-w-2xl">
            Administra los clientes registrados en el sistema y consulta la información de sus mascotas y reservas.
          </p>
        </div>

        {/* Botón de creación usando la variante degradada definida en button.tsx */}
        <Button
          variant="gradient"
          onClick={handleNewClient}
        >
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Filtros */}
      <ClientsFilters onSearch={handleSearch} />

      {/* Tabla */}
      <ClientsTable
        clients={filteredClients}
        onDelete={handleDeleteClient}
        onCreateClient={handleNewClient}
      />

      {/* Modal cliente */}
      <AddClientModal
        isOpen={isAddClientModalOpen}
        onClose={() => setIsAddClientModalOpen(false)}
        onSubmit={handleCreateClient}
        onSuccess={handleClientAdded}
      />

      {/* Modal mascota */}
      {isAddPetModalOpen && (
        <AddPetModal
          key={`client-${newClientData?.id ?? 'none'}`}
          isOpen={isAddPetModalOpen}
          onClose={handleClosePetModal}
          onSuccess={handlePetAdded}
          preselectedClientId={newClientData?.id}
          preselectedClientName={newClientData?.name}
          preselectedClientEmail={newClientData?.email}
          preselectedClientPhone={newClientData?.phone}
        />
      )}

      <DeleteConfirmationModal
        isOpen={Boolean(clientPendingDelete)}
        onClose={() => setClientPendingDelete(null)}
        onConfirm={handleConfirmDeleteClient}
        title="Eliminar cliente"
        entityLabel="cliente"
        itemName={clientPendingDelete?.name}
        question={deleteModalCopy.question}
        description={deleteModalCopy.description}
        isDeleting={deleteClientMutation.isPending}
        warningTitle={deleteModalCopy.warningTitle}
        confirmDisabled={deleteModalCopy.confirmDisabled}
      />
    </div>
  );
}
