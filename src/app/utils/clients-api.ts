export interface ClientListRecord {
  id: number;
  name: string;
  email: string;
  phone: string;
  petsCount: number;
  reservationsCount: number;
  registeredAt: string;
  isLocalOnly?: boolean;
}

export interface ClientUpsertInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  observations: string;
}

export interface ClientDetailSnapshot extends ClientListRecord {
  address: string;
  postalCode: string;
  city: string;
  observations: string;
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

interface BackendClientDetailItem {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  fechaCreacion: string;
  ciudad?: string | null;
  codigoPostal?: string | null;
  direccion?: string | null;
  observaciones?: string | null;
  mascotas?: Array<unknown>;
  reservas?: Array<unknown>;
}

export const CLIENTS_API_URL = API_BASE_URL;
export const CLIENTS_QUERY_KEY = ['clients'];

const buildApiErrorMessage = async (response: Response, fallbackMessage: string) => {
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return `${fallbackMessage} (HTTP ${response.status})`;
  }

  try {
    const parsedBody = JSON.parse(rawBody) as {
      message?: string;
      error?: string;
      detalle?: string;
      details?: string;
      path?: string;
      status?: number;
    };

    const detailedMessage =
      parsedBody.message?.trim() ||
      parsedBody.detalle?.trim() ||
      parsedBody.details?.trim() ||
      '';

    if (detailedMessage) {
      return detailedMessage;
    }

    if (parsedBody.error?.trim()) {
      return `${fallbackMessage}. ${parsedBody.error.trim()} (HTTP ${response.status})`;
    }
  } catch {
    return rawBody.trim();
  }

  return `${fallbackMessage} (HTTP ${response.status})`;
};

export const mapBackendClientToClient = (
  client: BackendClientListItem
): ClientListRecord => ({
  id: client.id,
  name: client.nombre,
  email: client.email,
  phone: client.telefono,
  petsCount: client.numMascotas ?? 0,
  reservationsCount: client.numReservas ?? 0,
  registeredAt: client.fechaCreacion,
});

export const mapBackendClientDetailToSnapshot = (
  client: BackendClientDetailItem
): ClientDetailSnapshot => ({
  id: client.id,
  name: client.nombre,
  email: client.email,
  phone: client.telefono,
  petsCount: client.mascotas?.length ?? 0,
  reservationsCount: client.reservas?.length ?? 0,
  registeredAt: client.fechaCreacion,
  address: client.direccion?.trim() ?? '',
  postalCode: client.codigoPostal?.trim() ?? '',
  city: client.ciudad?.trim() ?? '',
  observations: client.observaciones?.trim() ?? '',
});

const mapClientInputToBackend = (client: ClientUpsertInput) => ({
  nombre: client.name.trim(),
  email: client.email.trim(),
  telefono: client.phone.trim(),
  direccion: client.address.trim(),
  codigoPostal: client.postalCode.trim(),
  ciudad: client.city.trim(),
  observaciones: client.observations.trim(),
});

const parseClientMutationResponse = async (
  response: Response,
  fallbackInput: ClientUpsertInput
): Promise<ClientDetailSnapshot> => {
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return {
      id: 0,
      name: fallbackInput.name.trim(),
      email: fallbackInput.email.trim(),
      phone: fallbackInput.phone.trim(),
      address: fallbackInput.address.trim(),
      postalCode: fallbackInput.postalCode.trim(),
      city: fallbackInput.city.trim(),
      observations: fallbackInput.observations.trim(),
      petsCount: 0,
      reservationsCount: 0,
      registeredAt: new Date().toISOString(),
    };
  }

  return mapBackendClientDetailToSnapshot(JSON.parse(rawBody) as BackendClientDetailItem);
};

export const fetchClients = async (): Promise<ClientListRecord[]> => {
  const response = await apiFetch(`${CLIENTS_API_URL}/api/clientes`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('No se pudieron cargar los clientes');
  }

  const data: BackendClientListItem[] = await response.json();
  return data.map(mapBackendClientToClient);
};

export const createClientRequest = async (
  client: ClientUpsertInput
): Promise<ClientDetailSnapshot> => {
  const response = await apiFetch(`${CLIENTS_API_URL}/api/clientes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(mapClientInputToBackend(client)),
  });

  if (!response.ok) {
    throw new Error(await buildApiErrorMessage(response, 'No se pudo crear el cliente'));
  }

  return parseClientMutationResponse(response, client);
};

export const updateClientRequest = async (
  clientId: number,
  client: ClientUpsertInput
): Promise<ClientDetailSnapshot> => {
  const response = await apiFetch(`${CLIENTS_API_URL}/api/clientes/${clientId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(mapClientInputToBackend(client)),
  });

  if (!response.ok) {
    throw new Error(await buildApiErrorMessage(response, 'No se pudo actualizar el cliente'));
  }

  const updatedClient = await parseClientMutationResponse(response, client);

  return {
    ...updatedClient,
    id: updatedClient.id || clientId,
  };
};

export const deleteClientRequest = async (clientId: number) => {
  const response = await apiFetch(`${CLIENTS_API_URL}/api/clientes/${clientId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await buildApiErrorMessage(response, 'No se pudo eliminar el cliente'));
  }

  return clientId;
};
import { API_BASE_URL, apiFetch } from './api-client';
