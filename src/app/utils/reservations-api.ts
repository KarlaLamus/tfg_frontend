import { API_BASE_URL, apiFetch } from './api-client';
import { queryClient } from './query-client';

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type ReservationPaymentStatus = 'pending' | 'paid';

export interface ReservationPet {
  id: number;
  name: string;
  species: 'Perro' | 'Gato';
  breed: string;
  age: number;
}

export interface ReservationClient {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export interface ReservationServiceLine {
  id: number;
  name: string;
  price: number;
  quantity: number;
  maxQuantity?: number;
}

export interface ReservationCheckData {
  fechaHora: string;
  empleadoId: number;
  observaciones: string;
}

export interface ReservationCreateInput {
  clientId: number;
  roomId: number;
  petIds: number[];
  checkIn: string;
  checkOut: string;
  requestedAt?: string;
  customerNotes: string;
  internalNotes: string;
  services: ReservationServiceLine[];
  lodgingAmount: number;
  subtotalBeforeDiscount: number;
  discount: number;
  totalAmount: number;
}

export interface ReservationUpdateInput extends ReservationCreateInput {
  status: ReservationStatus;
}

export interface ReservationRecord {
  numericId: number;
  id: string;
  client: ReservationClient;
  pets: ReservationPet[];
  checkIn: string;
  checkOut: string;
  room: string;
  status: ReservationStatus;
  totalAmount: number;
  notes: string;
  customerNotes: string;
  internalNotes: string;
  services: ReservationServiceLine[];
  createdAt: string;
  respondedAt: string;
  duration: number;
  discount: number;
  lodgingAmount?: number;
  paymentStatus?: ReservationPaymentStatus;
  checkinData: ReservationCheckData | null;
  checkoutData: ReservationCheckData | null;
}

type ReservationLifecycleGuardInput = {
  status: ReservationStatus;
  checkinData?: ReservationCheckData | null;
  checkoutData?: ReservationCheckData | null;
};

interface BackendReservationListItem {
  id: number;
  nombreCliente: string;
  mascotas: string[];
  fechaEntrada: string;
  fechaSalida: string;
  nombreSala: string | null;
  estado: string;
  importe: number | null;
}

interface BackendReservationDetail {
  id: number;
  fechaSolicitud: string;
  fechaRespuesta: string | null;
  fechaEntrada: string;
  fechaSalida: string;
  duracion: number | null;
  nombreSala: string | null;
  estado: string;
  notasCliente: string | null;
  notasInternas: string | null;
  importe: number | null;
  descuento: number | null;
  total?: number | null;
  cliente: {
    id: number;
    nombre: string;
    email: string | null;
    telefono: string | null;
  };
  mascotas: Array<{
    id: number;
    nombre: string;
    especie: string;
    raza: string;
    edad: number;
  }>;
  servicios: Array<{
    nombre: string;
    cantidad: number;
    precio: number;
  }>;
}

interface BackendPaymentStatusItem {
  idPago?: number | null;
  idreserva: number;
  fechaPago?: string | null;
  estado: string;
}

export const RESERVATIONS_API_URL = API_BASE_URL;
const RESERVATION_DETAIL_QUERY_KEY = ['reservation-detail'] as const;
const RESERVATION_DETAIL_BATCH_SIZE = 5;

export const hasReservationActiveCheckIn = ({
  status,
  checkinData = null,
  checkoutData = null,
}: ReservationLifecycleGuardInput) =>
  status === 'in_progress' || (Boolean(checkinData) && !checkoutData && status !== 'completed');

export const canCancelReservation = (reservation: ReservationLifecycleGuardInput) =>
  reservation.status !== 'cancelled' &&
  reservation.status !== 'completed' &&
  !hasReservationActiveCheckIn(reservation);

export const canChangeReservationStatusAfterCheckIn = (
  reservation: ReservationLifecycleGuardInput,
  nextStatus: ReservationStatus
) => !hasReservationActiveCheckIn(reservation) || nextStatus === 'in_progress' || nextStatus === 'completed';

export const getReservationCheckOutRequiredMessage = (action: 'cancelar' | 'eliminar' | 'cambiar el estado') =>
  `No puedes ${action} una reserva después del check-in. Primero debes registrar el check-out.`;

const normalizeText = (value?: string | null) => value?.trim() ?? '';

const formatDateTimeForBackend = (value?: string) => {
  if (!value?.trim()) {
    return new Date().toISOString().slice(0, 19);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T00:00:00`;
  }

  return value.replace(/Z$/, '').slice(0, 19);
};

const buildApiErrorMessage = (rawBody: string, status: number, fallbackMessage: string) => {
  if (!rawBody.trim()) {
    return `${fallbackMessage} (HTTP ${status})`;
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
      return `${fallbackMessage}. ${parsedBody.error.trim()} (HTTP ${status})`;
    }
  } catch {
    return rawBody.trim();
  }

  return `${fallbackMessage} (HTTP ${status})`;
};

class ReservationApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ReservationApiRequestError';
    this.status = status;
  }
}

const shouldRetryReservationMutation = (error: unknown) =>
  error instanceof ReservationApiRequestError && ![401, 403].includes(error.status);

const mapReservationServicesToBackend = (services: ReservationServiceLine[]) =>
  services
    .filter((service) => service.quantity > 0)
    .map((service) => ({
      idServicio: service.id,
      cantidad: service.quantity,
    }));

const mapReservationCreateInputToBackend = (reservation: ReservationCreateInput) => ({
  clienteId: reservation.clientId,
  salaId: reservation.roomId,
  fechaEntrada: reservation.checkIn,
  fechaSalida: reservation.checkOut,
  estado: 'PENDIENTE',
  fechaSolicitud: formatDateTimeForBackend(reservation.requestedAt),
  mascotas: reservation.petIds,
  notasCliente: reservation.customerNotes.trim(),
  notasInternas: reservation.internalNotes.trim(),
  servicios: mapReservationServicesToBackend(reservation.services),
  importe: reservation.subtotalBeforeDiscount,
  descuento: reservation.discount,
});

const mapReservationCreateInputToBackendLean = (reservation: ReservationCreateInput) => ({
  clienteId: reservation.clientId,
  salaId: reservation.roomId,
  fechaEntrada: reservation.checkIn,
  fechaSalida: reservation.checkOut,
  mascotas: reservation.petIds,
  notasCliente: reservation.customerNotes.trim(),
  notasInternas: reservation.internalNotes.trim(),
  servicios: mapReservationServicesToBackend(reservation.services),
});

const mapReservationCreateInputToBackendExtended = (reservation: ReservationCreateInput) => ({
  ...mapReservationCreateInputToBackend(reservation),
  idCliente: reservation.clientId,
  idSala: reservation.roomId,
  petIds: reservation.petIds,
  mascotaIds: reservation.petIds,
  mascotasIds: reservation.petIds,
  subtotal: reservation.subtotalBeforeDiscount,
  subtotalAntesDescuento: reservation.subtotalBeforeDiscount,
  total: reservation.totalAmount,
  totalAmount: reservation.totalAmount,
  importeAlojamiento: reservation.lodgingAmount,
  lodgingAmount: reservation.lodgingAmount,
  customerNotes: reservation.customerNotes.trim(),
  internalNotes: reservation.internalNotes.trim(),
  servicios: reservation.services
    .filter((service) => service.quantity > 0)
    .map((service) => ({
      idServicio: service.id,
      servicioId: service.id,
      id: service.id,
      cantidad: service.quantity,
      quantity: service.quantity,
    })),
});

const mapReservationCreateInputToBackendTotalAmount = (reservation: ReservationCreateInput) => ({
  ...mapReservationCreateInputToBackend(reservation),
  importe: reservation.totalAmount,
  total: reservation.totalAmount,
  subtotal: reservation.subtotalBeforeDiscount,
});

const mapReservationStatusToBackend = (status: ReservationStatus) => {
  switch (status) {
    case 'confirmed':
      return 'CONFIRMADA';
    case 'in_progress':
      return 'EN_CURSO';
    case 'completed':
      return 'FINALIZADA';
    case 'cancelled':
      return 'CANCELADA';
    case 'pending':
    default:
      return 'PENDIENTE';
  }
};

const getBackendPaymentStatusTimestamp = (payment: BackendPaymentStatusItem) => {
  if (!payment.fechaPago) {
    return 0;
  }

  const timestamp = new Date(payment.fechaPago).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const isBackendPaymentStatusMoreRecent = (
  candidate: BackendPaymentStatusItem,
  current: BackendPaymentStatusItem
) => {
  const timestampDifference =
    getBackendPaymentStatusTimestamp(candidate) - getBackendPaymentStatusTimestamp(current);

  if (timestampDifference !== 0) {
    return timestampDifference > 0;
  }

  return (candidate.idPago ?? Number.MIN_SAFE_INTEGER) > (current.idPago ?? Number.MIN_SAFE_INTEGER);
};

const isBackendPaymentRegistered = (payment: BackendPaymentStatusItem) =>
  payment.estado?.toUpperCase() === 'PAGADO' && Boolean(payment.fechaPago?.trim());

const mapReservationUpdateInputToBackend = (reservation: ReservationUpdateInput) => ({
  ...mapReservationCreateInputToBackend(reservation),
  estado: mapReservationStatusToBackend(reservation.status),
});

const extractCreatedReservationId = (payload: unknown): number => {
  if (!payload || typeof payload !== 'object') {
    return 0;
  }

  const candidatePayload = payload as Record<string, unknown>;
  const directCandidates = [
    candidatePayload.id,
    candidatePayload.idReserva,
    candidatePayload.reservaId,
    candidatePayload.numericId,
  ];

  for (const candidate of directCandidates) {
    const numericId = extractReservationNumericId(candidate as string | number);

    if (Number.isFinite(numericId) && numericId > 0) {
      return numericId;
    }
  }

  if (candidatePayload.reserva && typeof candidatePayload.reserva === 'object') {
    return extractCreatedReservationId(candidatePayload.reserva);
  }

  if (candidatePayload.data && typeof candidatePayload.data === 'object') {
    return extractCreatedReservationId(candidatePayload.data);
  }

  return 0;
};

const haveSameReservationPets = (
  reservationPets: ReservationRecord['pets'],
  expectedPetIds: number[]
) => {
  if (reservationPets.length !== expectedPetIds.length) {
    return false;
  }

  const reservationPetIds = reservationPets.map((pet) => pet.id).sort((firstId, secondId) => firstId - secondId);
  const sortedExpectedPetIds = [...expectedPetIds].sort((firstId, secondId) => firstId - secondId);

  return reservationPetIds.every((petId, index) => petId === sortedExpectedPetIds[index]);
};

const getReservationTimestamp = (value?: string | null) => {
  if (!value?.trim()) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const findExistingReservationMatch = async (
  reservation: ReservationCreateInput
): Promise<ReservationRecord | null> => {
  let existingReservations: ReservationRecord[] = [];

  try {
    existingReservations = await fetchReservationsPageData();
  } catch {
    return null;
  }

  const matches = existingReservations.filter(
    (currentReservation) =>
      currentReservation.client.id === reservation.clientId &&
      currentReservation.checkIn === reservation.checkIn &&
      currentReservation.checkOut === reservation.checkOut &&
      haveSameReservationPets(currentReservation.pets, reservation.petIds)
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.sort(
    (firstReservation, secondReservation) =>
      getReservationTimestamp(secondReservation.createdAt) -
      getReservationTimestamp(firstReservation.createdAt)
  )[0] ?? null;
};

const performReservationCreateAttempt = async (payload: Record<string, unknown>) => {
  const response = await apiFetch(`${RESERVATIONS_API_URL}/api/reservas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new ReservationApiRequestError(
      response.status,
      buildApiErrorMessage(rawBody, response.status, 'No se pudo crear la reserva')
    );
  }

  if (!rawBody.trim()) {
    return 0;
  }

  try {
    return extractCreatedReservationId(JSON.parse(rawBody));
  } catch {
    return 0;
  }
};

const mapBackendSpeciesToUi = (species: string): ReservationPet['species'] => {
  return species.toUpperCase() === 'GATO' ? 'Gato' : 'Perro';
};

export const mapBackendReservationStatusToUi = (status: string): ReservationStatus => {
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

export const formatReservationCode = (id: number) => `RES-${String(id).padStart(3, '0')}`;

export const extractReservationNumericId = (value: string | number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const numericValue = String(value).match(/(\d+)/g)?.at(-1);
  return numericValue ? Number(numericValue) : NaN;
};

export const buildReservationNotes = (customerNotes: string, internalNotes: string) => {
  const sections = [
    customerNotes ? `Cliente: ${customerNotes}` : '',
    internalNotes ? `Internas: ${internalNotes}` : '',
  ].filter(Boolean);

  return sections.join('\n\n');
};

const calculateReservationDuration = (checkIn: string, checkOut: string) => {
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  return Math.max(Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)), 0);
};

const inferPetSpeciesFromReservation = (
  roomName: string,
  petName: string
): ReservationPet['species'] => {
  const normalizedRoomName = roomName.toLowerCase();
  const normalizedPetName = petName.toLowerCase();

  if (
    ['gato', 'miau', 'felino', 'ronroneo', 'bigote'].some((token) =>
      normalizedRoomName.includes(token)
    )
  ) {
    return 'Gato';
  }

  if (
    ['perro', 'guau', 'canin', 'perrun'].some((token) =>
      normalizedRoomName.includes(token)
    )
  ) {
    return 'Perro';
  }

  if (['michi', 'kitty', 'cat'].some((token) => normalizedPetName.includes(token))) {
    return 'Gato';
  }

  return 'Perro';
};

const mapBackendReservationDetail = (data: BackendReservationDetail): ReservationRecord => {
  const customerNotes = normalizeText(data.notasCliente);
  const internalNotes = normalizeText(data.notasInternas);
  const status = mapBackendReservationStatusToUi(data.estado);
  const services = (data.servicios ?? []).map((service, index) => ({
    id: index + 1,
    name: normalizeText(service.nombre) || `Servicio ${index + 1}`,
    price: Number(service.precio ?? 0),
    quantity: Number(service.cantidad ?? 0),
    maxQuantity: Number(service.cantidad ?? 0),
  }));
  const calculatedServicesTotal = services.reduce(
    (sum, service) => sum + service.price * service.quantity,
    0
  );
  const subtotalBeforeDiscount = Number(data.importe ?? calculatedServicesTotal ?? 0);
  const backendDiscountValue = Number(data.descuento ?? 0);
  const explicitTotal = Number(data.total ?? NaN);
  const normalizedDiscountFromBackend = Number.isFinite(backendDiscountValue)
    ? backendDiscountValue > 0 && backendDiscountValue <= 1
      ? subtotalBeforeDiscount * backendDiscountValue
      : backendDiscountValue
    : 0;
  const clampedBackendDiscount = Math.min(
    Math.max(normalizedDiscountFromBackend, 0),
    Math.max(subtotalBeforeDiscount, 0)
  );
  const explicitDiscount = Number.isFinite(explicitTotal)
    ? subtotalBeforeDiscount - explicitTotal
    : NaN;
  const hasValidExplicitTotal =
    Number.isFinite(explicitTotal) &&
    explicitTotal >= 0 &&
    explicitTotal <= subtotalBeforeDiscount;
  const hasValidExplicitDiscount =
    Number.isFinite(explicitDiscount) &&
    explicitDiscount >= 0 &&
    explicitDiscount <= subtotalBeforeDiscount;
  const discount = hasValidExplicitTotal && hasValidExplicitDiscount
    ? explicitDiscount
    : clampedBackendDiscount;
  const totalAmount = hasValidExplicitTotal
    ? explicitTotal
    : Math.max(subtotalBeforeDiscount - discount, 0);
  const lodgingAmount = Math.max(subtotalBeforeDiscount - calculatedServicesTotal, 0);
  const paymentStatus: ReservationPaymentStatus = 'pending';

  return {
    numericId: data.id,
    id: formatReservationCode(data.id),
    client: {
      id: data.cliente.id,
      name: normalizeText(data.cliente.nombre) || 'Cliente sin nombre',
      email: normalizeText(data.cliente.email),
      phone: normalizeText(data.cliente.telefono),
    },
    pets: (data.mascotas ?? []).map((pet) => ({
      id: pet.id,
      name: normalizeText(pet.nombre) || 'Mascota sin nombre',
      species: mapBackendSpeciesToUi(pet.especie),
      breed: normalizeText(pet.raza) || 'Raza no especificada',
      age: Number(pet.edad ?? 0),
    })),
    checkIn: data.fechaEntrada,
    checkOut: data.fechaSalida,
    room: normalizeText(data.nombreSala) || 'Sin sala asignada',
    status,
    totalAmount,
    notes: buildReservationNotes(customerNotes, internalNotes),
    customerNotes,
    internalNotes,
    services,
    createdAt: data.fechaSolicitud,
    respondedAt: normalizeText(data.fechaRespuesta),
    duration: Number(data.duracion ?? 0),
    discount,
    lodgingAmount,
    paymentStatus,
    checkinData: null,
    checkoutData: null,
  };
};

const mapBackendReservationListItemToFallback = (
  data: BackendReservationListItem
): ReservationRecord => {
  const status = mapBackendReservationStatusToUi(data.estado);
  const room = normalizeText(data.nombreSala) || 'Sin sala asignada';
  const totalAmount = Number(data.importe ?? 0);
  const duration = calculateReservationDuration(data.fechaEntrada, data.fechaSalida);
  const paymentStatus: ReservationPaymentStatus = 'pending';

  return {
    numericId: data.id,
    id: formatReservationCode(data.id),
    client: {
      id: -data.id,
      name: normalizeText(data.nombreCliente) || 'Cliente sin nombre',
      email: '',
      phone: '',
    },
    pets: (data.mascotas ?? []).map((petName, index) => ({
      id: -(data.id * 100 + index + 1),
      name: normalizeText(petName) || `Mascota ${index + 1}`,
      species: inferPetSpeciesFromReservation(room, petName),
      breed: 'Raza no especificada',
      age: 0,
    })),
    checkIn: data.fechaEntrada,
    checkOut: data.fechaSalida,
    room,
    status,
    totalAmount,
    notes: '',
    customerNotes: '',
    internalNotes: '',
    services: [],
    createdAt: '',
    respondedAt: '',
    duration,
    discount: 0,
    lodgingAmount: totalAmount,
    paymentStatus,
    checkinData: null,
    checkoutData: null,
  };
};

const fetchPaymentStatusByReservationId = async () => {
  const response = await apiFetch(`${RESERVATIONS_API_URL}/api/pagos`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.warn('No se pudo cargar el estado real de pagos desde el backend.');
    return new Map<number, ReservationPaymentStatus>();
  }

  const payments = (await response.json()) as BackendPaymentStatusItem[];
  const latestPaymentsByReservationId = new Map<number, BackendPaymentStatusItem>();

  payments.forEach((payment) => {
    const reservationId = Number(payment.idreserva);
    const currentPayment = latestPaymentsByReservationId.get(reservationId);

    if (!currentPayment || isBackendPaymentStatusMoreRecent(payment, currentPayment)) {
      latestPaymentsByReservationId.set(reservationId, payment);
    }
  });

  return new Map<number, ReservationPaymentStatus>(
    Array.from(latestPaymentsByReservationId.entries()).map(([reservationId, payment]) => [
      reservationId,
      isBackendPaymentRegistered(payment) ? 'paid' : 'pending',
    ])
  );
};

const applyBackendPaymentStatus = (
  reservation: ReservationRecord,
  paymentStatusByReservationId: Map<number, ReservationPaymentStatus>
): ReservationRecord => ({
  ...reservation,
  paymentStatus: paymentStatusByReservationId.get(reservation.numericId) ?? 'pending',
});

const getCachedReservationDetail = (reservationId: number) => {
  const formattedReservationId = formatReservationCode(reservationId);

  return (
    queryClient.getQueryData<ReservationRecord>([
      ...RESERVATION_DETAIL_QUERY_KEY,
      formattedReservationId,
    ]) ?? null
  );
};

const fetchReservationDetailsForPage = async (listData: BackendReservationListItem[]) => {
  const detailsByReservationId = new Map<number, ReservationRecord>();
  const failedReservationIds = new Set<number>();

  for (let index = 0; index < listData.length; index += RESERVATION_DETAIL_BATCH_SIZE) {
    const batch = listData.slice(index, index + RESERVATION_DETAIL_BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((reservation) =>
        fetchReservationDetail(reservation.id, { includePaymentStatus: false })
      )
    );

    batchResults.forEach((result, batchIndex) => {
      const reservationId = batch[batchIndex]?.id;

      if (!reservationId) {
        return;
      }

      if (result.status === 'fulfilled') {
        detailsByReservationId.set(reservationId, result.value);
        queryClient.setQueryData<ReservationRecord>(
          [...RESERVATION_DETAIL_QUERY_KEY, result.value.id],
          result.value
        );
        return;
      }

      failedReservationIds.add(reservationId);
    });
  }

  return {
    detailsByReservationId,
    failedReservationIds,
  };
};

export const fetchReservationDetail = async (
  reservationId: string | number,
  options?: { includePaymentStatus?: boolean }
): Promise<ReservationRecord> => {
  const numericReservationId = extractReservationNumericId(reservationId);

  if (!Number.isFinite(numericReservationId)) {
    throw new Error('La reserva solicitada no es valida');
  }

  const response = await apiFetch(`${RESERVATIONS_API_URL}/api/reservas/${numericReservationId}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('No se pudo cargar el detalle de la reserva');
  }

  const rawBody = await response.text();

  if (!rawBody.trim()) {
    throw new Error('La reserva no devolvio datos');
  }

  const data: BackendReservationDetail = JSON.parse(rawBody);
  const reservation = mapBackendReservationDetail(data);

  if (options?.includePaymentStatus === false) {
    return reservation;
  }

  const paymentStatusByReservationId = await fetchPaymentStatusByReservationId();

  return applyBackendPaymentStatus(reservation, paymentStatusByReservationId);
};

export const fetchReservationsPageData = async (): Promise<ReservationRecord[]> => {
  const response = await apiFetch(`${RESERVATIONS_API_URL}/api/reservas`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('No se pudieron cargar las reservas');
  }

  const listData: BackendReservationListItem[] = await response.json();
  const { detailsByReservationId, failedReservationIds } =
    await fetchReservationDetailsForPage(listData);
  const paymentStatusByReservationId = await fetchPaymentStatusByReservationId();

  return listData.map((reservation) => {
    const fetchedDetail = detailsByReservationId.get(reservation.id);

    if (fetchedDetail) {
      return applyBackendPaymentStatus(fetchedDetail, paymentStatusByReservationId);
    }

    const cachedDetail = getCachedReservationDetail(reservation.id);

    if (cachedDetail) {
      return applyBackendPaymentStatus(cachedDetail, paymentStatusByReservationId);
    }

    console.warn(
      `No se pudo cargar el detalle de la reserva ${reservation.id}. Se usará la información básica de la lista.`,
      failedReservationIds.has(reservation.id) ? 'detail-fetch-failed' : undefined
    );

    return applyBackendPaymentStatus(
      mapBackendReservationListItemToFallback(reservation),
      paymentStatusByReservationId
    );
  });
};

export const createReservationRequest = async (
  reservation: ReservationCreateInput
): Promise<number> => {
  const attempts = [
    {
      label: 'payload principal',
      payload: mapReservationCreateInputToBackend(reservation),
    },
    {
      label: 'payload con total',
      payload: mapReservationCreateInputToBackendTotalAmount(reservation),
    },
    {
      label: 'payload reducido',
      payload: mapReservationCreateInputToBackendLean(reservation),
    },
    {
      label: 'payload extendido',
      payload: mapReservationCreateInputToBackendExtended(reservation),
    },
  ];
  const attemptErrors: string[] = [];

  for (const attempt of attempts) {
    try {
      return await performReservationCreateAttempt(attempt.payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error desconocido';
      attemptErrors.push(`${attempt.label}: ${message}`);

      const existingReservation = await findExistingReservationMatch(reservation);
      if (existingReservation) {
        return existingReservation.numericId;
      }

      if (!shouldRetryReservationMutation(error)) {
        throw error;
      }
    }
  }

  throw new Error(`No se pudo crear la reserva. ${attemptErrors.join(' | ')}`);
};

export const updateReservationRequest = async (
  reservationId: string | number,
  reservation: ReservationUpdateInput
): Promise<number> => {
  const numericReservationId = extractReservationNumericId(reservationId);

  if (!Number.isFinite(numericReservationId)) {
    throw new Error('La reserva solicitada no es valida');
  }

  const response = await apiFetch(`${RESERVATIONS_API_URL}/api/reservas/${numericReservationId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(mapReservationUpdateInputToBackend(reservation)),
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(
      buildApiErrorMessage(rawBody, response.status, 'No se pudo actualizar la reserva')
    );
  }

  if (!rawBody.trim()) {
    return numericReservationId;
  }

  try {
    return extractCreatedReservationId(JSON.parse(rawBody)) || numericReservationId;
  } catch {
    return numericReservationId;
  }
};

const getReservationStatusAction = (
  reservationId: number,
  status: ReservationStatus
): {
  endpoint: string;
  method: 'POST' | 'PUT';
  fallbackMessage: string;
} => {
  switch (status) {
    case 'confirmed':
      return {
        endpoint: `${RESERVATIONS_API_URL}/api/reservas/${reservationId}/confirmar`,
        method: 'PUT',
        fallbackMessage: 'No se pudo confirmar la reserva',
      };
    case 'cancelled':
      return {
        endpoint: `${RESERVATIONS_API_URL}/api/reservas/${reservationId}/cancelar`,
        method: 'PUT',
        fallbackMessage: 'No se pudo cancelar la reserva',
      };
    case 'in_progress':
      return {
        endpoint: `${RESERVATIONS_API_URL}/api/reservas/${reservationId}/checkin`,
        method: 'POST',
        fallbackMessage: 'No se pudo registrar el check-in',
      };
    case 'completed':
      return {
        endpoint: `${RESERVATIONS_API_URL}/api/reservas/${reservationId}/checkout`,
        method: 'POST',
        fallbackMessage: 'No se pudo registrar el check-out',
      };
    case 'pending':
    default:
      throw new Error('La API no expone una accion para devolver la reserva a pendiente');
  }
};

export const updateReservationStatusRequest = async (
  reservationId: string | number,
  status: ReservationStatus,
  checkData?: ReservationCheckData | null
): Promise<ReservationRecord | null> => {
  const numericReservationId = extractReservationNumericId(reservationId);

  if (!Number.isFinite(numericReservationId)) {
    throw new Error('La reserva solicitada no es valida');
  }

  const action = getReservationStatusAction(numericReservationId, status);
  const shouldSendCheckData =
    Boolean(checkData) && (status === 'in_progress' || status === 'completed');
  const response = await apiFetch(action.endpoint, {
    method: action.method,
    headers: {
      Accept: 'application/json',
      ...(shouldSendCheckData ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(shouldSendCheckData ? { body: JSON.stringify(checkData) } : {}),
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(rawBody, response.status, action.fallbackMessage));
  }

  if (!rawBody.trim()) {
    return null;
  }

  try {
    const reservation = mapBackendReservationDetail(JSON.parse(rawBody) as BackendReservationDetail);
    const paymentStatusByReservationId = await fetchPaymentStatusByReservationId();

    return applyBackendPaymentStatus(reservation, paymentStatusByReservationId);
  } catch {
    return null;
  }
};

export const deleteReservationRequest = async (reservationId: string | number) => {
  const numericReservationId = extractReservationNumericId(reservationId);

  if (!Number.isFinite(numericReservationId)) {
    throw new Error('La reserva solicitada no es valida');
  }

  const response = await apiFetch(`${RESERVATIONS_API_URL}/api/reservas/${numericReservationId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(
      buildApiErrorMessage(await response.text(), response.status, 'No se pudo eliminar la reserva')
    );
  }

  return numericReservationId;
};
