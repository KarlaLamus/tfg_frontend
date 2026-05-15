import { API_BASE_URL, apiFetch } from './api-client';
import { extractPetPhotoUrl } from './pets-api';

export type TrackingReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface TrackingEmployee {
  id: number;
  name: string;
}

export interface TrackingRecord {
  id: string;
  date: string;
  createdAt: string;
  employee: TrackingEmployee;
  feeding: string;
  medication: string;
  behavior: string;
  incidents: string | null;
  photoUrl: string | null;
}

export interface TrackingCreateInput {
  petId: number;
  reservationId: number;
  employeeId?: number | null;
  employeeName?: string;
  date: string;
  createdAt: string;
  feeding: string;
  medication: string;
  behavior: string;
  incidents?: string | null;
  photoUrl?: string | null;
  photoFile?: File | null;
}

export interface TrackingUpdateInput {
  trackingId: number;
  petId: number;
  reservationId?: number | null;
  employeeId?: number | null;
  employeeName?: string;
  date?: string;
  createdAt?: string;
  feeding: string;
  medication: string;
  behavior: string;
  incidents?: string | null;
  photoUrl?: string | null;
  photoFile?: File | null;
}

export interface TrackingHostedPet {
  id: number;
  name: string;
  species: string;
  breed: string;
  sex: string;
  neutered: boolean;
  photoUrl?: string;
  observations?: string;
  allergies?: string;
  medication?: string;
  specialNeeds?: string;
  vet: string;
  vetPhone: string;
  reservation: {
    id: string;
    numericId: number;
    checkIn: string;
    checkOut: string;
    status: TrackingReservationStatus;
    room: string;
  };
  client: {
    id: number;
    name: string;
    phone: string;
  };
  lastTracking?: {
    date: string;
    hasIncidents: boolean;
  };
  trackingCount: number;
  incidentsCount: number;
}

export interface TrackingPageData {
  pets: TrackingHostedPet[];
  trackingByPetId: Record<number, TrackingRecord[]>;
}

export const TRACKING_QUERY_KEY = ['tracking-page'] as const;

interface BackendTrackingListItem {
  nombreDueno: string;
  ultimaFechaSeguimiento: string | null;
  numSeguimientos: number | null;
  nombreSala: string | null;
  idReserva: number;
  mascota: {
    idMascota: number;
    nombre: string;
    especie: string;
    sexo: string;
    raza: string;
  };
}

interface BackendTrackingMedicalInfo {
  alergias: string | null;
  medicacionHabitual: string | null;
  necesidadesEspeciales: string | null;
  veterinario: string | null;
  telefono: string | null;
}

interface BackendTrackingDetail {
  idMascota: number;
  nombreMascota: string;
  especie: string;
  raza: string;
  fechaNacimiento: string | null;
  edad: number | null;
  peso: number | null;
  sexo: string;
  esterilizado: boolean;
  color: string | null;
  observaciones: string | null;
  estancia: {
    idReserva: number;
    fechaEntrada: string;
    fechaSalida: string;
    estado: string;
    nombreSala: string | null;
  };
  dueno: {
    clienteId: number;
    nombreDueno: string;
    telefonoDueno: string | null;
    emailDueno: string | null;
  };
  fichaMedica: BackendTrackingMedicalInfo | null;
  seguimientos: Array<{
    idSeguimiento: number;
    empleadoId?: number | null;
    idEmpleado?: number | null;
    nombreEmpleado: string | null;
    alimentacion: string | null;
    medicacionAdministrada: string | null;
    comportamiento: string | null;
    incidencias: string | null;
    fechaSeguimiento: string;
    fotoUrl?: string | null;
    photoUrl?: string | null;
    imagenUrl?: string | null;
    urlFoto?: string | null;
    urlImagen?: string | null;
  }>;
}

const TRACKING_API_URL = API_BASE_URL;

class TrackingApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TrackingApiRequestError';
    this.status = status;
  }
}

const buildTrackingApiErrorMessage = (
  rawBody: string,
  status: number,
  fallbackMessage: string
) => {
  if (!rawBody.trim()) {
    return `${fallbackMessage} (HTTP ${status})`;
  }

  try {
    const parsedBody = JSON.parse(rawBody) as {
      message?: string;
      detalle?: string;
      details?: string;
      error?: string;
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

const appendTrackingFormDataValue = (
  formData: FormData,
  key: string,
  value: unknown
) => {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === 'boolean') {
    formData.append(key, value ? 'true' : 'false');
    return;
  }

  formData.append(key, String(value));
};

const appendTrackingSearchParamValue = (
  searchParams: URLSearchParams,
  key: string,
  value: unknown
) => {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === 'boolean') {
    searchParams.append(key, value ? 'true' : 'false');
    return;
  }

  searchParams.append(key, String(value));
};

const fixMojibake = (value?: string | null) => {
  const normalizedValue = value?.trim() ?? '';

  if (!normalizedValue || !/[ÃÂ]/.test(normalizedValue)) {
    return normalizedValue;
  }

  try {
    const bytes = Uint8Array.from(
      normalizedValue.split('').map((character) => character.charCodeAt(0))
    );
    return new TextDecoder('utf-8').decode(bytes).trim();
  } catch {
    return normalizedValue;
  }
};

const normalizeText = (value?: string | null) => {
  const normalizedValue = fixMojibake(value);

  if (!normalizedValue) {
    return '';
  }

  const normalizedKey = normalizedValue.toLowerCase();

  if (
    normalizedKey === 'ninguna' ||
    normalizedKey === 'ninguno' ||
    normalizedKey === 'no aplica' ||
    normalizedKey === 'null' ||
    normalizedKey === '-'
  ) {
    return '';
  }

  return normalizedValue;
};

const normalizeIncidentText = (value?: string | null) => {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue || normalizedValue.toLowerCase().startsWith('sin incidencias')) {
    return null;
  }

  return normalizedValue;
};

const extractTrackingNumericId = (value: string | number | null | undefined) => {
  const directNumericId = Number(value);

  if (Number.isFinite(directNumericId) && directNumericId > 0) {
    return directNumericId;
  }

  if (typeof value === 'string') {
    const fallbackNumericId = Number(value.replace(/\D+/g, ''));

    if (Number.isFinite(fallbackNumericId) && fallbackNumericId > 0) {
      return fallbackNumericId;
    }
  }

  return 0;
};

const extractOptionalTrackingId = (payload: unknown): number => {
  if (!payload || typeof payload !== 'object') {
    return 0;
  }

  const candidatePayload = payload as Record<string, unknown>;

  for (const candidate of [
    candidatePayload.idSeguimiento,
    candidatePayload.seguimientoId,
    candidatePayload.id,
  ]) {
    const numericId = Number(candidate);

    if (Number.isFinite(numericId) && numericId > 0) {
      return numericId;
    }
  }

  if (candidatePayload.seguimiento && typeof candidatePayload.seguimiento === 'object') {
    return extractOptionalTrackingId(candidatePayload.seguimiento);
  }

  if (candidatePayload.data && typeof candidatePayload.data === 'object') {
    return extractOptionalTrackingId(candidatePayload.data);
  }

  return 0;
};

const toNullableTrackingText = (value?: string | null) => {
  const normalizedValue = value?.trim() ?? '';
  return normalizedValue ? normalizedValue : null;
};

const padTrackingDateSegment = (value: number) => String(value).padStart(2, '0');

const formatTrackingLocalDate = (date: Date) =>
  `${date.getFullYear()}-${padTrackingDateSegment(date.getMonth() + 1)}-${padTrackingDateSegment(date.getDate())}`;

const formatTrackingLocalDateTime = (date: Date) =>
  `${formatTrackingLocalDate(date)}T${padTrackingDateSegment(date.getHours())}:${padTrackingDateSegment(date.getMinutes())}:${padTrackingDateSegment(date.getSeconds())}`;

const normalizeTrackingCreatedAt = (value?: string | null) => {
  const normalizedValue = value?.trim() ?? '';

  if (!normalizedValue) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return `${normalizedValue}T12:00:00`;
  }

  const parsedDate = new Date(normalizedValue);

  if (!Number.isNaN(parsedDate.getTime())) {
    return formatTrackingLocalDateTime(parsedDate);
  }

  return normalizedValue.replace(/\.\d+/, '').replace(/Z$/, '');
};

const buildTrackingMutationPayload = (
  input: TrackingCreateInput | TrackingUpdateInput
): Record<string, unknown> => {
  const trackingId = 'trackingId' in input ? input.trackingId : null;
  const normalizedCreatedAt = normalizeTrackingCreatedAt(input.createdAt);
  const normalizedInputDate =
    normalizedCreatedAt.split('T')[0] || input.date?.trim() || '';
  const normalizedEmployeeId =
    typeof input.employeeId === 'number' && Number.isFinite(input.employeeId) && input.employeeId > 0
      ? input.employeeId
      : null;
  const normalizedEmployeeName = toNullableTrackingText(input.employeeName);
  const createdAt = normalizedCreatedAt || `${normalizedInputDate}T12:00:00`;
  const normalizedDate = normalizedInputDate || createdAt.split('T')[0] || '';

  return {
    idSeguimiento: trackingId,
    seguimientoId: trackingId,
    idMascota: input.petId,
    mascotaId: input.petId,
    petId: input.petId,
    idReserva: input.reservationId ?? null,
    reservaId: input.reservationId ?? null,
    bookingId: input.reservationId ?? null,
    empleadoId: normalizedEmployeeId,
    idEmpleado: normalizedEmployeeId,
    nombreEmpleado: normalizedEmployeeName,
    empleadoNombre: normalizedEmployeeName,
    fechaSeguimiento: createdAt,
    fecha: normalizedDate,
    alimentacion: toNullableTrackingText(input.feeding),
    medicacionAdministrada: toNullableTrackingText(input.medication),
    comportamiento: toNullableTrackingText(input.behavior),
    incidencias: toNullableTrackingText(input.incidents),
    fotoUrl: toNullableTrackingText(input.photoUrl),
    photoUrl: toNullableTrackingText(input.photoUrl),
  };
};

const buildTrackingUrlEncodedBody = (payload: Record<string, unknown>) => {
  const searchParams = new URLSearchParams();

  Object.entries(payload).forEach(([key, value]) => {
    appendTrackingSearchParamValue(searchParams, key, value);
  });

  return searchParams;
};

const mapBackendSpeciesToUi = (species: string) => {
  return species.toUpperCase() === 'GATO' ? 'Gato' : 'Perro';
};

const mapBackendSexToUi = (sex: string) => {
  return sex.toUpperCase() === 'HEMBRA' ? 'Hembra' : 'Macho';
};

const mapBackendReservationStatusToUi = (
  status: string
): TrackingHostedPet['reservation']['status'] => {
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

const getTrackingTimestamp = (value?: string | null) => {
  if (!value) {
    return 0;
  }

  const parsedTimestamp = new Date(value).getTime();

  return Number.isNaN(parsedTimestamp) ? 0 : parsedTimestamp;
};

const shouldReplaceTrackingListItem = (
  currentItem: BackendTrackingListItem,
  nextItem: BackendTrackingListItem
) => {
  const currentTimestamp = getTrackingTimestamp(currentItem.ultimaFechaSeguimiento);
  const nextTimestamp = getTrackingTimestamp(nextItem.ultimaFechaSeguimiento);

  if (currentTimestamp !== nextTimestamp) {
    return nextTimestamp > currentTimestamp;
  }

  const currentTrackingCount = Number(currentItem.numSeguimientos ?? 0);
  const nextTrackingCount = Number(nextItem.numSeguimientos ?? 0);

  if (currentTrackingCount !== nextTrackingCount) {
    return nextTrackingCount > currentTrackingCount;
  }

  return nextItem.idReserva > currentItem.idReserva;
};

const mapTrackingRecords = (
  trackingRecords: BackendTrackingDetail['seguimientos']
): TrackingRecord[] => {
  const employeeIds = new Map<string, number>();
  let nextEmployeeId = 1;

  return [...(trackingRecords ?? [])]
    .sort(
      (recordA, recordB) =>
        new Date(recordB.fechaSeguimiento).getTime() - new Date(recordA.fechaSeguimiento).getTime()
    )
    .map((record) => {
      const employeeName = normalizeText(record.nombreEmpleado) || 'Sin asignar';
      const explicitEmployeeId = Number(record.empleadoId ?? record.idEmpleado ?? NaN);

      if (!employeeIds.has(employeeName) && !Number.isFinite(explicitEmployeeId)) {
        employeeIds.set(employeeName, nextEmployeeId);
        nextEmployeeId += 1;
      }

      const [datePart = ''] = record.fechaSeguimiento.split('T');

      return {
        id: String(record.idSeguimiento),
        date: datePart,
        createdAt: record.fechaSeguimiento,
        employee: {
          id:
            Number.isFinite(explicitEmployeeId) && explicitEmployeeId > 0
              ? explicitEmployeeId
              : employeeIds.get(employeeName) ?? 0,
          name: employeeName,
        },
        feeding: normalizeText(record.alimentacion) || 'Sin registro',
        medication: normalizeText(record.medicacionAdministrada) || 'Ninguna',
        behavior: normalizeText(record.comportamiento) || 'Sin observaciones',
        incidents: normalizeIncidentText(record.incidencias),
        photoUrl: extractPetPhotoUrl(record) || null,
      };
    });
};

const fetchTrackingDetail = async (petId: number): Promise<BackendTrackingDetail> => {
  const response = await apiFetch(`${TRACKING_API_URL}/api/seguimientos/${petId}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo cargar el detalle de seguimiento para la mascota ${petId}`);
  }

  const rawBody = await response.text();

  if (!rawBody.trim()) {
    throw new Error(`El detalle de seguimiento de la mascota ${petId} no devolvio datos`);
  }

  return JSON.parse(rawBody) as BackendTrackingDetail;
};

const buildPetSummary = (
  listItem: BackendTrackingListItem,
  detail: BackendTrackingDetail | undefined,
  trackingRecords: TrackingRecord[]
): TrackingHostedPet => {
  const latestTrackingRecord = trackingRecords[0];
  const medicalInfo = detail?.fichaMedica;

  return {
    id: listItem.mascota.idMascota,
    name: normalizeText(detail?.nombreMascota ?? listItem.mascota.nombre) || 'Mascota sin nombre',
    species: mapBackendSpeciesToUi(detail?.especie ?? listItem.mascota.especie),
    breed: normalizeText(detail?.raza ?? listItem.mascota.raza) || 'Raza no especificada',
    sex: mapBackendSexToUi(detail?.sexo ?? listItem.mascota.sexo),
    neutered: detail?.esterilizado ?? false,
    photoUrl: extractPetPhotoUrl(detail) || extractPetPhotoUrl(listItem) || '',
    observations: normalizeText(detail?.observaciones),
    allergies: normalizeText(medicalInfo?.alergias),
    medication: normalizeText(medicalInfo?.medicacionHabitual),
    specialNeeds: normalizeText(medicalInfo?.necesidadesEspeciales),
    vet: normalizeText(medicalInfo?.veterinario),
    vetPhone: normalizeText(medicalInfo?.telefono),
    reservation: {
      id: formatReservationCode(detail?.estancia.idReserva ?? listItem.idReserva),
      numericId: detail?.estancia.idReserva ?? listItem.idReserva,
      checkIn: detail?.estancia.fechaEntrada ?? '',
      checkOut: detail?.estancia.fechaSalida ?? '',
      status: mapBackendReservationStatusToUi(detail?.estancia.estado ?? 'CONFIRMADA'),
      room:
        normalizeText(detail?.estancia.nombreSala ?? listItem.nombreSala) || 'Sin sala asignada',
    },
    client: {
      id: detail?.dueno.clienteId ?? 0,
      name:
        normalizeText(detail?.dueno.nombreDueno ?? listItem.nombreDueno) || 'Dueño sin nombre',
      phone: normalizeText(detail?.dueno.telefonoDueno),
    },
    lastTracking:
      latestTrackingRecord || listItem.ultimaFechaSeguimiento
        ? {
            date: latestTrackingRecord?.date ?? listItem.ultimaFechaSeguimiento ?? '',
            hasIncidents: latestTrackingRecord?.incidents !== null,
          }
        : undefined,
    trackingCount: trackingRecords.length || Number(listItem.numSeguimientos ?? 0),
    incidentsCount: trackingRecords.filter((record) => record.incidents !== null).length,
  };
};

type TrackingRequestEncoding = 'json' | 'urlencoded' | 'multipart' | 'none';
const TRACKING_MULTIPART_FILE_PART_NAMES = ['foto', 'imagen'] as const;

const buildTrackingFormDataBody = (
  payload: Record<string, unknown>,
  photoFile?: File | null,
  photoFieldName?: (typeof TRACKING_MULTIPART_FILE_PART_NAMES)[number]
) => {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (photoFile && (key === 'fotoUrl' || key === 'photoUrl')) {
      return;
    }

    appendTrackingFormDataValue(formData, key, value);
  });

  if (photoFile && photoFieldName) {
    formData.append(photoFieldName, photoFile);
  }

  return formData;
};

const performTrackingMutationRequest = async (
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  payload: Record<string, unknown> | null,
  fallbackMessage: string,
  encoding: TrackingRequestEncoding,
  photoFile?: File | null,
  photoFieldName?: (typeof TRACKING_MULTIPART_FILE_PART_NAMES)[number]
) => {
  const init: RequestInit = {
    method,
  };

  if (encoding === 'json' && payload) {
    init.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    init.body = JSON.stringify(payload);
  } else if (encoding === 'urlencoded' && payload) {
    init.headers = {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Accept: 'application/json',
    };
    init.body = buildTrackingUrlEncodedBody(payload);
  } else if (encoding === 'multipart' && payload) {
    init.headers = {
      Accept: 'application/json',
    };
    init.body = buildTrackingFormDataBody(payload, photoFile, photoFieldName);
  }

  const response = await apiFetch(`${TRACKING_API_URL}${path}`, init);
  const rawBody = await response.text();

  if (!response.ok) {
    throw new TrackingApiRequestError(
      buildTrackingApiErrorMessage(rawBody, response.status, fallbackMessage),
      response.status
    );
  }

  if (!rawBody.trim()) {
    return 0;
  }

  try {
    return extractOptionalTrackingId(JSON.parse(rawBody));
  } catch {
    return 0;
  }
};

const shouldRetryTrackingMutation = (error: unknown) =>
  error instanceof TrackingApiRequestError && ![401, 403].includes(error.status);

const executeTrackingMutationAttempts = async (
  attempts: Array<{
    path: string;
    method: 'POST' | 'PUT' | 'DELETE';
    encoding: TrackingRequestEncoding;
    payload: Record<string, unknown> | null;
    label: string;
    photoFile?: File | null;
    photoFieldName?: (typeof TRACKING_MULTIPART_FILE_PART_NAMES)[number];
  }>,
  fallbackMessage: string
) => {
  const attemptErrors: string[] = [];

  for (const attempt of attempts) {
    try {
      return await performTrackingMutationRequest(
        attempt.path,
        attempt.method,
        attempt.payload,
        fallbackMessage,
        attempt.encoding,
        attempt.photoFile,
        attempt.photoFieldName
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error desconocido';
      attemptErrors.push(`${attempt.label}: ${message}`);

      if (!shouldRetryTrackingMutation(error)) {
        throw error;
      }
    }
  }

  throw new Error(`${fallbackMessage}. ${attemptErrors.join(' | ')}`);
};

export const createTrackingRequest = async (input: TrackingCreateInput) => {
  const payload = buildTrackingMutationPayload(input);
  const photoFile = input.photoFile ?? null;
  const bodyEncodings: TrackingRequestEncoding[] = photoFile
    ? ['multipart', 'json', 'urlencoded']
    : ['json', 'urlencoded', 'multipart'];
  const basePaths = [
    '/api/seguimientos',
    `/api/seguimientos/${input.petId}`,
    `/api/seguimientos?mascotaId=${input.petId}&reservaId=${input.reservationId}`,
    `/api/seguimientos/${input.petId}?reservaId=${input.reservationId}`,
  ];

  return executeTrackingMutationAttempts(
    basePaths.flatMap((path) =>
      bodyEncodings.flatMap((encoding) =>
        encoding === 'multipart' && photoFile
          ? TRACKING_MULTIPART_FILE_PART_NAMES.map((photoFieldName) => ({
              path,
              method: 'POST' as const,
              encoding,
              payload,
              photoFile,
              photoFieldName,
              label: `POST ${path} (${encoding}:${photoFieldName})`,
            }))
          : [
              {
                path,
                method: 'POST' as const,
                encoding,
                payload,
                label: `POST ${path} (${encoding})`,
              },
            ]
      )
    ),
    'No se pudo crear el seguimiento'
  );
};

export const updateTrackingRequest = async (input: TrackingUpdateInput) => {
  const payload = buildTrackingMutationPayload(input);
  const photoFile = input.photoFile ?? null;
  const bodyEncodings: TrackingRequestEncoding[] = photoFile
    ? ['multipart', 'json', 'urlencoded']
    : ['json', 'urlencoded', 'multipart'];
  const basePaths = [
    `/api/seguimientos/${input.trackingId}`,
    '/api/seguimientos',
    `/api/seguimientos/${input.petId}/${input.trackingId}`,
    `/api/seguimientos?seguimientoId=${input.trackingId}&mascotaId=${input.petId}`,
    `/api/seguimientos/${input.petId}?seguimientoId=${input.trackingId}`,
  ];

  return executeTrackingMutationAttempts(
    basePaths.flatMap((path) =>
      bodyEncodings.flatMap((encoding) =>
        encoding === 'multipart' && photoFile
          ? TRACKING_MULTIPART_FILE_PART_NAMES.map((photoFieldName) => ({
              path,
              method: 'PUT' as const,
              encoding,
              payload,
              photoFile,
              photoFieldName,
              label: `PUT ${path} (${encoding}:${photoFieldName})`,
            }))
          : [
              {
                path,
                method: 'PUT' as const,
                encoding,
                payload,
                label: `PUT ${path} (${encoding})`,
              },
            ]
      )
    ),
    'No se pudo actualizar el seguimiento'
  );
};

export const deleteTrackingRequest = async (
  trackingId: string | number,
  petId?: number | null
) => {
  const numericTrackingId = extractTrackingNumericId(trackingId);

  if (!numericTrackingId) {
    throw new Error('No se pudo identificar el seguimiento a eliminar');
  }

  const basePaths = [
    `/api/seguimientos/${numericTrackingId}`,
    ...(petId ? [`/api/seguimientos/${petId}/${numericTrackingId}`] : []),
    ...(petId ? [`/api/seguimientos?seguimientoId=${numericTrackingId}&mascotaId=${petId}`] : []),
    ...(petId ? [`/api/seguimientos/${petId}?seguimientoId=${numericTrackingId}`] : []),
  ];

  return executeTrackingMutationAttempts(
    basePaths.map((path) => ({
      path,
      method: 'DELETE' as const,
      encoding: 'none' as const,
      payload: null,
      label: `DELETE ${path}`,
    })),
    'No se pudo eliminar el seguimiento'
  );
};

export const fetchTrackingPageData = async (): Promise<TrackingPageData> => {
  const response = await apiFetch(`${TRACKING_API_URL}/api/seguimientos`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('No se pudo cargar el listado de seguimientos');
  }

  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return {
      pets: [],
      trackingByPetId: {},
    };
  }

  const rawListItems = JSON.parse(rawBody) as BackendTrackingListItem[];
  const listItemByPetId = rawListItems.reduce<Map<number, BackendTrackingListItem>>(
    (accumulator, listItem) => {
      const petId = listItem.mascota.idMascota;
      const currentItem = accumulator.get(petId);

      if (!currentItem || shouldReplaceTrackingListItem(currentItem, listItem)) {
        accumulator.set(petId, listItem);
      }

      return accumulator;
    },
    new Map()
  );
  const listItems = Array.from(listItemByPetId.values());
  const uniquePetIds = Array.from(listItemByPetId.keys());

  const detailResults = await Promise.allSettled(
    uniquePetIds.map(async (petId) => [petId, await fetchTrackingDetail(petId)] as const)
  );

  const detailByPetId = detailResults.reduce<Record<number, BackendTrackingDetail>>(
    (accumulator, result) => {
      if (result.status === 'fulfilled') {
        const [petId, detail] = result.value;
        accumulator[petId] = detail;
      }

      return accumulator;
    },
    {}
  );

  const trackingByPetId = Object.fromEntries(
    uniquePetIds.map((petId) => [
      petId,
      detailByPetId[petId] ? mapTrackingRecords(detailByPetId[petId].seguimientos) : [],
    ])
  ) as Record<number, TrackingRecord[]>;

  const pets = listItems
    .map((item) =>
      buildPetSummary(
        item,
        detailByPetId[item.mascota.idMascota],
        trackingByPetId[item.mascota.idMascota] ?? []
      )
    )
    .sort((petA, petB) => {
      const lastTrackingDifference =
        getTrackingTimestamp(petB.lastTracking?.date) - getTrackingTimestamp(petA.lastTracking?.date);

      if (lastTrackingDifference !== 0) {
        return lastTrackingDifference;
      }

      return petA.name.localeCompare(petB.name, 'es', { sensitivity: 'base' });
    });

  return {
    pets,
    trackingByPetId,
  };
};
