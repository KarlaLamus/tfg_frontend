import { API_BASE_URL, apiFetch } from './api-client';

export interface ServiceRecord {
  id: number;
  name: string;
  description: string;
  price: number;
  status: 'active' | 'inactive';
  isLocalOnly?: boolean;
}

export interface ServiceUpsertInput {
  name: string;
  description: string;
  price: number;
  status: 'active' | 'inactive';
}

interface BackendServiceItem {
  idServicio?: number;
  nombre: string;
  descripcion: string;
  precio: number;
  estado?: boolean;
  activo?: boolean;
}

export const SERVICES_API_URL = API_BASE_URL;
export const SERVICES_QUERY_KEY = ['services-page'] as const;

const mapBackendServiceToRecord = (service: BackendServiceItem): ServiceRecord => ({
  id: Number(service.idServicio ?? 0),
  name: service.nombre,
  description: service.descripcion,
  price: Number(service.precio ?? 0),
  status: (service.activo ?? service.estado) ? 'active' : 'inactive',
});

const mapServiceInputToBackend = (service: ServiceUpsertInput) => ({
  nombre: service.name.trim(),
  descripcion: service.description.trim(),
  precio: Number(service.price),
  activo: service.status === 'active',
});

const parseServiceMutationResponse = async (
  response: Response,
  fallbackInput: ServiceUpsertInput
): Promise<ServiceRecord> => {
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return {
      id: 0,
      name: fallbackInput.name.trim(),
      description: fallbackInput.description.trim(),
      price: Number(fallbackInput.price),
      status: fallbackInput.status,
    };
  }

  return mapBackendServiceToRecord(JSON.parse(rawBody) as BackendServiceItem);
};

export const fetchServicesPageData = async (): Promise<ServiceRecord[]> => {
  const response = await apiFetch(`${SERVICES_API_URL}/api/servicios`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('No se pudieron cargar los servicios');
  }

  const data: BackendServiceItem[] = await response.json();
  return data.map(mapBackendServiceToRecord);
};

export const createServiceRequest = async (
  service: ServiceUpsertInput
): Promise<ServiceRecord> => {
  const response = await apiFetch(`${SERVICES_API_URL}/api/servicios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(mapServiceInputToBackend(service)),
  });

  if (!response.ok) {
    throw new Error('No se pudo crear el servicio');
  }

  return parseServiceMutationResponse(response, service);
};

export const updateServiceRequest = async (
  serviceId: number,
  service: ServiceUpsertInput
): Promise<ServiceRecord> => {
  const response = await apiFetch(`${SERVICES_API_URL}/api/servicios/${serviceId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(mapServiceInputToBackend(service)),
  });

  if (!response.ok) {
    throw new Error('No se pudo actualizar el servicio');
  }

  const updatedService = await parseServiceMutationResponse(response, service);

  return {
    ...updatedService,
    id: updatedService.id || serviceId,
  };
};

export const deleteServiceRequest = async (serviceId: number) => {
  const response = await apiFetch(`${SERVICES_API_URL}/api/servicios/${serviceId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('No se pudo eliminar el servicio');
  }

  return serviceId;
};
