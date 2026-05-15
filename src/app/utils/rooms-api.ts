import { API_BASE_URL, apiFetch } from './api-client';

export type RoomType = 'dog' | 'cat';
export type RoomSize = 'S' | 'M' | 'L';
export type RoomStatus = 'operational' | 'maintenance';

export interface RoomGuest {
  petName: string;
  ownerName: string;
  reservationCode: string;
}

export interface RoomReservationSummary {
  id: number;
  reservationCode: string;
  client: string;
  pet: string;
  species: 'Perro' | 'Gato';
  checkIn: string;
  checkOut: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
}

export interface RoomRecord {
  id: number;
  code: string;
  type: RoomType;
  size: RoomSize;
  capacity: number;
  pricePerDay: number | null;
  status: RoomStatus;
  occupied: boolean;
  currentOccupancy: number;
  currentGuests: RoomGuest[];
  upcomingReservations: RoomReservationSummary[];
  occupancyHistory: RoomReservationSummary[];
  isLocalOnly?: boolean;
}

export interface RoomUpsertInput {
  code: string;
  type: RoomType;
  size: RoomSize;
  capacity: number;
  pricePerDay: number;
  status: RoomStatus;
}

interface BackendRoomListItem {
  idSala: number;
  nombre: string;
  tipo: string;
  tamano: string;
  estado: string;
  ocupacion: number;
  capacidad: number;
  precio?: unknown;
  precioDia?: unknown;
  precioPorDia?: unknown;
  precioDiario?: unknown;
  tarifa?: unknown;
  tarifaDia?: unknown;
  tarifaDiaria?: unknown;
  dailyRate?: unknown;
  pricePerDay?: unknown;
}

interface BackendRoomMutationItem {
  salaId?: number;
  idSala?: number;
  nombre: string;
  tipo: string;
  tamano: string;
  estado: string;
  capacidad: number;
  ocupacion?: number | null;
  precio?: unknown;
  precioDia?: unknown;
  precioPorDia?: unknown;
  precioDiario?: unknown;
  tarifa?: unknown;
  tarifaDia?: unknown;
  tarifaDiaria?: unknown;
  dailyRate?: unknown;
  pricePerDay?: unknown;
}

export const ROOMS_API_URL = API_BASE_URL;
export const ROOMS_QUERY_KEY = ['rooms-page'];

const mapBackendRoomTypeToUi = (roomType: string): RoomType =>
  roomType.toUpperCase() === 'GATO' ? 'cat' : 'dog';

const mapBackendRoomStatusToUi = (status: string): RoomStatus =>
  status.toUpperCase() === 'MANTENIMIENTO' ? 'maintenance' : 'operational';

const mapUiRoomTypeToBackend = (roomType: RoomType) =>
  roomType === 'cat' ? 'GATO' : 'PERRO';

const mapUiRoomStatusToBackend = (status: RoomStatus) =>
  status === 'maintenance' ? 'MANTENIMIENTO' : 'OPERATIVA';

const parseOptionalNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim().replace(',', '.');

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const getRoomPricePerDay = (room: BackendRoomListItem | BackendRoomMutationItem) => {
  for (const candidate of [
    room.precio,
    room.precioDia,
    room.precioPorDia,
    room.precioDiario,
    room.tarifa,
    room.tarifaDia,
    room.tarifaDiaria,
    room.dailyRate,
    room.pricePerDay,
  ]) {
    const parsedValue = parseOptionalNumber(candidate);

    if (parsedValue !== null) {
      return parsedValue;
    }
  }

  return null;
};

const mapBackendRoomToRecord = (
  room: BackendRoomListItem | BackendRoomMutationItem
): RoomRecord => ({
  id: Number('idSala' in room ? room.idSala : room.salaId ?? room.idSala ?? 0),
  code: room.nombre,
  type: mapBackendRoomTypeToUi(room.tipo),
  size: room.tamano.toUpperCase() as RoomSize,
  capacity: Number(room.capacidad ?? 0),
  pricePerDay: getRoomPricePerDay(room),
  status: mapBackendRoomStatusToUi(room.estado),
  occupied: Number(room.ocupacion ?? 0) > 0,
  currentOccupancy: Number(room.ocupacion ?? 0),
  currentGuests: [],
  upcomingReservations: [],
  occupancyHistory: [],
});

const mapRoomInputToBackend = (room: RoomUpsertInput) => ({
  nombre: room.code.trim(),
  tipo: mapUiRoomTypeToBackend(room.type),
  tamano: room.size,
  estado: mapUiRoomStatusToBackend(room.status),
  capacidad: Number(room.capacity),
  precio: Number(room.pricePerDay),
});

const parseRoomMutationResponse = async (
  response: Response,
  fallbackInput: RoomUpsertInput
): Promise<RoomRecord> => {
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return {
      id: 0,
      code: fallbackInput.code.trim(),
      type: fallbackInput.type,
      size: fallbackInput.size,
      capacity: Number(fallbackInput.capacity),
      pricePerDay: Number(fallbackInput.pricePerDay),
      status: fallbackInput.status,
      occupied: false,
      currentOccupancy: 0,
      currentGuests: [],
      upcomingReservations: [],
      occupancyHistory: [],
    };
  }

  return mapBackendRoomToRecord(JSON.parse(rawBody) as BackendRoomMutationItem);
};

export const fetchRoomsPageData = async (): Promise<RoomRecord[]> => {
  const response = await apiFetch(`${ROOMS_API_URL}/api/salas`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('No se pudieron cargar las salas');
  }

  const data: BackendRoomListItem[] = await response.json();

  return data.map(mapBackendRoomToRecord);
};

export const createRoomRequest = async (room: RoomUpsertInput): Promise<RoomRecord> => {
  const response = await apiFetch(`${ROOMS_API_URL}/api/salas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(mapRoomInputToBackend(room)),
  });

  if (!response.ok) {
    throw new Error('No se pudo crear la sala');
  }

  return parseRoomMutationResponse(response, room);
};

export const updateRoomRequest = async (
  roomId: number,
  room: RoomUpsertInput
): Promise<RoomRecord> => {
  const response = await apiFetch(`${ROOMS_API_URL}/api/salas/${roomId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(mapRoomInputToBackend(room)),
  });

  if (!response.ok) {
    throw new Error('No se pudo actualizar la sala');
  }

  const updatedRoom = await parseRoomMutationResponse(response, room);

  return {
    ...updatedRoom,
    id: updatedRoom.id || roomId,
  };
};

export const deleteRoomRequest = async (roomId: number) => {
  const response = await apiFetch(`${ROOMS_API_URL}/api/salas/${roomId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('No se pudo eliminar la sala');
  }
};
