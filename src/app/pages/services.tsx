import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { DeleteConfirmationModal } from '../components/ui/delete-confirmation-modal';
import { ServicesFilters } from '../components/services/service-filters';
import { ServicesTable } from '../components/services/services-table';
import {
  ServiceFormModal,
  type EditableService,
} from '../components/services/service-form-modal';
import { ViewServiceModal } from '../components/services/view-service-modal';
import {
  SERVICES_QUERY_KEY,
  createServiceRequest,
  deleteServiceRequest,
  fetchServicesPageData,
  updateServiceRequest,
  type ServiceRecord,
} from '../utils/services-api';

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [isCreateServiceModalOpen, setIsCreateServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<EditableService | null>(null);
  const [viewingService, setViewingService] = useState<EditableService | null>(null);
  const [servicePendingDelete, setServicePendingDelete] = useState<EditableService | null>(null);
  const [isDeletingService, setIsDeletingService] = useState(false);

  const {
    data: backendServices = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: SERVICES_QUERY_KEY,
    queryFn: fetchServicesPageData,
  });

  const services = backendServices;

  const filteredServices = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const nextServices = services.filter((service) => {
      const matchesSearch =
        !normalizedSearchTerm ||
        service.name.toLowerCase().includes(normalizedSearchTerm) ||
        service.description.toLowerCase().includes(normalizedSearchTerm);
      const matchesStatus = statusFilter === 'all' || service.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return [...nextServices].sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        case 'status':
          return a.status.localeCompare(b.status);
        case 'name':
        default:
          return a.name.localeCompare(b.name, 'es');
      }
    });
  }, [searchTerm, services, sortBy, statusFilter]);

  const totalServices = services.length;
  const activeServices = services.filter((service) => service.status === 'active').length;
  const inactiveServices = services.filter((service) => service.status === 'inactive').length;
  const averagePrice =
    services.length > 0
      ? services.reduce((sum, service) => sum + service.price, 0) / services.length
      : 0;

  const handleNewService = () => {
    setIsCreateServiceModalOpen(true);
  };

  const handleSaveNewService = async (service: EditableService) => {
    try {
      const createdService = await createServiceRequest({
        name: service.name,
        description: service.description,
        price: service.price,
        status: service.status,
      });

      queryClient.setQueryData<ServiceRecord[]>(SERVICES_QUERY_KEY, (currentServices = []) => [
        createdService,
        ...currentServices,
      ]);
      setIsCreateServiceModalOpen(false);
      toast.success('Servicio creado', {
        description: 'Se ha creado correctamente.',
      });
    } catch (error) {
      toast.error('No se pudo crear el servicio', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      });
      throw error;
    }
  };

  const handleSaveEditedService = async (service: EditableService) => {
    if (!editingService) {
      return;
    }

    try {
      const updatedService = await updateServiceRequest(editingService.id, {
        name: service.name,
        description: service.description,
        price: service.price,
        status: service.status,
      });

      queryClient.setQueryData<ServiceRecord[]>(SERVICES_QUERY_KEY, (currentServices = []) =>
        currentServices.map((currentService) =>
          currentService.id === updatedService.id ? updatedService : currentService
        )
      );
      setEditingService(null);
      toast.success('Servicio actualizado', {
        description: 'Se ha editado correctamente.',
      });
    } catch (error) {
      toast.error('No se pudo actualizar el servicio', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      });
      throw error;
    }
  };

  const handleToggleStatus = async (service: EditableService) => {
    const nextStatus = service.status === 'active' ? 'inactive' : 'active';

    try {
      const updatedService = await updateServiceRequest(service.id, {
        name: service.name,
        description: service.description,
        price: service.price,
        status: nextStatus,
      });

      queryClient.setQueryData<ServiceRecord[]>(SERVICES_QUERY_KEY, (currentServices = []) =>
        currentServices.map((currentService) =>
          currentService.id === updatedService.id ? updatedService : currentService
        )
      );
      toast.success(
        nextStatus === 'active' ? 'Servicio activado' : 'Servicio desactivado',
        {
          description: 'Se ha actualizado correctamente.',
        }
      );
    } catch (error) {
      toast.error('No se pudo actualizar el estado del servicio', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      });
    }
  };

  const handleDeleteService = async () => {
    if (!servicePendingDelete) {
      return;
    }

    setIsDeletingService(true);

    try {
      await deleteServiceRequest(servicePendingDelete.id);

      queryClient.setQueryData<ServiceRecord[]>(SERVICES_QUERY_KEY, (currentServices = []) =>
        currentServices.filter((service) => service.id !== servicePendingDelete.id)
      );
      setServicePendingDelete(null);
      toast.success('Servicio eliminado', {
        description: 'Se ha eliminado correctamente.',
      });
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : 'No se pudo eliminar el servicio';
      toast.error('No se pudo eliminar el servicio', {
        description: message,
      });
    } finally {
      setIsDeletingService(false);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortBy('name');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="mb-1 text-gray-900">Gestion de servicios</h2>
            <p className="text-sm text-gray-600">Cargando servicios del sistema...</p>
          </div>
        </div>
        <Card className="border-0 p-8 shadow-md">
          <p className="text-sm text-gray-600">Cargando listado de servicios...</p>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-1 text-gray-900">Gestion de servicios</h2>
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-1 text-gray-900">Gestion de servicios</h2>
          <p className="text-sm text-gray-600">
            Administra los servicios adicionales que pueden contratarse durante la estancia.
          </p>
        </div>
        <Button
          onClick={handleNewService}
          className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo servicio
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-gray-600">Servicios registrados</p>
              <p className="text-2xl font-bold text-gray-900">{totalServices}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-gray-600">Servicios activos</p>
              <p className="text-2xl font-bold text-green-600">{activeServices}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-6 w-6">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-gray-600">Servicios inactivos</p>
              <p className="text-2xl font-bold text-gray-500">{inactiveServices}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 text-white">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-6 w-6">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-gray-600">Precio medio</p>
              <p className="text-2xl font-bold text-blue-600">{averagePrice.toFixed(2)} €</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-6 w-6">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      <ServicesFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onClearFilters={handleClearFilters}
      />

      {filteredServices.length > 0 ? (
        <ServicesTable
          services={filteredServices}
          onViewService={setViewingService}
          onEditService={setEditingService}
          onToggleStatus={handleToggleStatus}
          onDeleteService={setServicePendingDelete}
        />
      ) : (
        <Card className="border-0 p-12 text-center shadow-md">
          <div className="mx-auto max-w-md">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Plus className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-gray-900">No se encontraron servicios</h3>
            <p className="mb-6 text-sm text-gray-600">
              {searchTerm || statusFilter !== 'all'
                ? 'Intenta ajustar los filtros de búsqueda.'
                : 'Comienza creando el primer servicio en el sistema.'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button
                onClick={handleNewService}
                className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo servicio
              </Button>
            )}
          </div>
        </Card>
      )}

      <ServiceFormModal
        key={isCreateServiceModalOpen ? 'create-service' : 'create-service-closed'}
        isOpen={isCreateServiceModalOpen}
        mode="create"
        onClose={() => setIsCreateServiceModalOpen(false)}
        onSave={handleSaveNewService}
      />

      <ServiceFormModal
        key={editingService ? `edit-service-${editingService.id}` : 'edit-service-closed'}
        isOpen={Boolean(editingService)}
        mode="edit"
        service={editingService}
        onClose={() => setEditingService(null)}
        onSave={handleSaveEditedService}
      />

      <ViewServiceModal
        isOpen={Boolean(viewingService)}
        service={viewingService}
        onClose={() => setViewingService(null)}
      />

      <DeleteConfirmationModal
        isOpen={Boolean(servicePendingDelete)}
        onClose={() => setServicePendingDelete(null)}
        onConfirm={handleDeleteService}
        title="Eliminar servicio"
        entityLabel="servicio"
        itemName={servicePendingDelete?.name}
        isDeleting={isDeletingService}
      />
    </div>
  );
}
