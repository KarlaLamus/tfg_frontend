import type { EditablePet } from '../components/pets/edit-pet-modal';
import { API_BASE_URL, apiFetch, buildApiUrl } from './api-client';

export interface PetCreateInput {
  ownerId: number;
  name: string;
  species: 'Perro' | 'Gato';
  breed: string;
  microchipNumber: string;
  birthDate: string;
  weight: string;
  sex: 'Macho' | 'Hembra' | '';
  neutered: 'Sí' | 'No';
  observations: string;
}

export type PetUpdateInput = PetCreateInput;

export interface PetImageUploadInput {
  photoFile?: File | null;
}

export interface PetUpdateResult {
  petId: number;
  photoSavedToBackend: boolean;
}

export interface PetMedicalInfoInput {
  allergies: string;
  medication: string;
  specialNeeds: string;
  vetName: string;
  vetPhone: string;
}

export class PetMedicalBackendUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PetMedicalBackendUnsupportedError';
  }
}

class PetApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PetApiRequestError';
    this.status = status;
  }
}

interface BackendPetImageFields {
  photoUrl?: unknown;
  imageUrl?: unknown;
  imagenUrl?: unknown;
  fotoUrl?: unknown;
  urlImagen?: unknown;
  urlFoto?: unknown;
  imagen?: unknown;
  foto?: unknown;
}

interface BackendPetListItem extends BackendPetImageFields {
  idMascota: number;
  nombre: string;
  especie: string;
  raza: string;
  edad: number;
  dueno: string;
  sala: string | null;
}

interface BackendClientListItem {
  id: number;
  nombre: string;
}

interface BackendPetDetailItem extends BackendPetImageFields {
  idMascota: number;
  nombre: string;
  especie: string;
  raza: string;
  fechaNacimiento?: string | null;
  peso?: number | null;
  sexo?: string | null;
  esterilizado?: boolean | null;
  numeroMicrochip?: string | null;
  microchipNumber?: string | null;
  microchip?: string | null;
  color?: string | null;
  observaciones?: string | null;
  fichaMedica?: BackendPetMedicalDetailItem | null;
  dueno?: {
    clienteId?: number | null;
  } | null;
}

interface BackendPetMedicalDetailItem {
  idFichaMedica?: number | null;
  alergias?: string | null;
  medicacionHabitual?: string | null;
  necesidadesEspeciales?: string | null;
  veterinario?: string | null;
  telefono?: string | null;
}

export const PETS_API_URL = API_BASE_URL;
export const PETS_QUERY_KEY = ['pets-page'];

const PET_MULTIPART_FILE_PART_NAMES = ['foto', 'imagen'] as const;
const PET_MULTIPART_JSON_PART_NAME = 'mascota';
const PET_IMAGE_URL_KEYS = [
  'photoUrl',
  'imageUrl',
  'imagenUrl',
  'fotoUrl',
  'urlImagen',
  'urlFoto',
  'imagen',
  'foto',
] as const;

const normalizeBackendAssetUrl = (value: string) => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return '';
  }

  if (
    normalizedValue.startsWith('data:') ||
    normalizedValue.startsWith('blob:') ||
    /^(?:https?:)?\/\//i.test(normalizedValue)
  ) {
    return normalizedValue;
  }

  return buildApiUrl(normalizedValue);
};

const extractImageValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return normalizeBackendAssetUrl(value);
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const nestedValue = value as Record<string, unknown>;

  for (const key of PET_IMAGE_URL_KEYS) {
    const candidate = extractImageValue(nestedValue[key]);

    if (candidate) {
      return candidate;
    }
  }

  for (const key of ['url', 'href', 'src', 'value'] as const) {
    const candidate = extractImageValue(nestedValue[key]);

    if (candidate) {
      return candidate;
    }
  }

  return '';
};

export const extractPetPhotoUrl = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const candidatePayload = payload as Record<string, unknown>;

  for (const key of PET_IMAGE_URL_KEYS) {
    const candidate = extractImageValue(candidatePayload[key]);

    if (candidate) {
      return candidate;
    }
  }

  return '';
};

const mapSpeciesToUi = (species: string): 'Perro' | 'Gato' =>
  species.toUpperCase() === 'GATO' ? 'Gato' : 'Perro';

const mapSpeciesToBackend = (species: PetCreateInput['species']) =>
  species === 'Gato' ? 'GATO' : 'PERRO';

const mapSexToBackend = (sex: PetCreateInput['sex']) => {
  if (sex === 'Hembra') {
    return 'HEMBRA';
  }

  if (sex === 'Macho') {
    return 'MACHO';
  }

  return '';
};

const buildApiErrorMessage = (rawBody: string, status: number, fallbackMessage: string) => {
  if (!rawBody.trim()) {
    if (status === 413) {
      return `${fallbackMessage}. La imagen es demasiado grande o el backend ha rechazado el tamaño del archivo (HTTP 413)`;
    }

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

const appendFormDataValue = (formData: FormData, key: string, value: unknown) => {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === 'boolean') {
    formData.append(key, value ? 'true' : 'false');
    return;
  }

  formData.append(key, String(value));
};

const appendSearchParamValue = (
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

const buildPetMultipartBody = (
  payload: Record<string, unknown>,
  options: {
    photoFile?: File;
    filePartName?: (typeof PET_MULTIPART_FILE_PART_NAMES)[number];
    includeJsonPart?: boolean;
  } = {}
) => {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    appendFormDataValue(formData, key, value);
  });

  if (options.includeJsonPart) {
    formData.append(
      PET_MULTIPART_JSON_PART_NAME,
      new Blob([JSON.stringify(payload)], { type: 'application/json' })
    );
  }

  if (options.photoFile && options.filePartName) {
    formData.append(options.filePartName, options.photoFile);
  }

  return formData;
};

const buildPetUrlEncodedBody = (payload: Record<string, unknown>) => {
  const searchParams = new URLSearchParams();

  Object.entries(payload).forEach(([key, value]) => {
    appendSearchParamValue(searchParams, key, value);
  });

  return searchParams;
};

const mapPetInputToBackend = (pet: PetCreateInput) => {
  const payload: Record<string, unknown> = {
    nombre: pet.name.trim(),
    especie: mapSpeciesToBackend(pet.species),
    raza: pet.breed.trim() || 'Raza sin especificar',
    clienteId: pet.ownerId,
    esterilizado: pet.neutered === 'Sí',
  };

  if (pet.birthDate) {
    payload.fechaNacimiento = pet.birthDate;
  }

  if (pet.weight.trim()) {
    payload.peso = Number(pet.weight);
  }

  if (pet.sex) {
    payload.sexo = mapSexToBackend(pet.sex);
  }

  if (pet.microchipNumber.trim()) {
    payload.microchip = pet.microchipNumber.trim();
  }

  if (pet.observations.trim()) {
    payload.observaciones = pet.observations.trim();
  }

  return payload;
};

const mapPetUpdateInputToBackend = (
  pet: PetUpdateInput,
  currentPetDetail: BackendPetDetailItem
) => {
  const currentOwnerId = Number(currentPetDetail.dueno?.clienteId ?? pet.ownerId ?? 0);
  const currentWeight = Number(currentPetDetail.peso ?? NaN);
  const currentBirthDate = currentPetDetail.fechaNacimiento?.trim() ?? '';
  const currentSex = currentPetDetail.sexo?.trim() ?? '';
  const currentMicrochip =
    currentPetDetail.numeroMicrochip?.trim() ??
    currentPetDetail.microchipNumber?.trim() ??
    currentPetDetail.microchip?.trim() ??
    '';
  const currentObservations = currentPetDetail.observaciones?.trim() ?? '';
  const currentColor = currentPetDetail.color?.trim() ?? '';

  const payload: Record<string, unknown> = {
    idMascota: currentPetDetail.idMascota,
    nombre: pet.name.trim() || currentPetDetail.nombre,
    especie: mapSpeciesToBackend(pet.species),
    raza: pet.breed.trim() || currentPetDetail.raza || 'Raza sin especificar',
    clienteId: currentOwnerId,
    esterilizado: pet.neutered === 'Sí',
    color: currentColor,
  };

  payload.fechaNacimiento = pet.birthDate || currentBirthDate || null;
  payload.peso = pet.weight.trim()
    ? Number(pet.weight)
    : Number.isFinite(currentWeight)
      ? currentWeight
      : null;
  payload.sexo = pet.sex ? mapSexToBackend(pet.sex) : currentSex || null;

  const nextMicrochip = pet.microchipNumber.trim() || currentMicrochip;
  payload.microchip = nextMicrochip || null;
  payload.numeroMicrochip = nextMicrochip || null;
  payload.observaciones = pet.observations.trim() || currentObservations || null;

  return payload;
};

const mapCurrentPetDetailToUpdatePayload = (currentPetDetail: BackendPetDetailItem) => {
  const currentOwnerId = Number(currentPetDetail.dueno?.clienteId ?? 0);
  const currentWeight = Number(currentPetDetail.peso ?? NaN);
  const currentBirthDate = currentPetDetail.fechaNacimiento?.trim() ?? '';
  const currentSex = currentPetDetail.sexo?.trim() ?? '';
  const currentMicrochip =
    currentPetDetail.numeroMicrochip?.trim() ??
    currentPetDetail.microchipNumber?.trim() ??
    currentPetDetail.microchip?.trim() ??
    '';
  const currentObservations = currentPetDetail.observaciones?.trim() ?? '';
  const currentColor = currentPetDetail.color?.trim() ?? '';
  const currentSpecies = currentPetDetail.especie?.trim() || 'PERRO';

  return {
    idMascota: currentPetDetail.idMascota,
    nombre: currentPetDetail.nombre?.trim() || 'Mascota',
    especie: currentSpecies,
    raza: currentPetDetail.raza?.trim() || 'Raza sin especificar',
    clienteId: currentOwnerId > 0 ? currentOwnerId : null,
    esterilizado: Boolean(currentPetDetail.esterilizado),
    color: currentColor || null,
    fechaNacimiento: currentBirthDate || null,
    peso: Number.isFinite(currentWeight) ? currentWeight : null,
    sexo: currentSex || null,
    microchip: currentMicrochip || null,
    numeroMicrochip: currentMicrochip || null,
    observaciones: currentObservations || null,
  };
};

const mapPetMedicalInfoToBackend = (
  medicalInfo: PetMedicalInfoInput,
  currentMedicalInfo?: BackendPetMedicalDetailItem | null,
  petId?: number
) => {
  const nextMedicalInfo = {
    idMascota: petId ?? null,
    mascotaId: petId ?? null,
    alergias: medicalInfo.allergies.trim() || null,
    medicacionHabitual: medicalInfo.medication.trim() || null,
    necesidadesEspeciales: medicalInfo.specialNeeds.trim() || null,
    veterinario: medicalInfo.vetName.trim() || null,
    telefono: medicalInfo.vetPhone.trim() || null,
  };

  const currentMedicalRecordId = Number(currentMedicalInfo?.idFichaMedica ?? NaN);

  if (Number.isFinite(currentMedicalRecordId) && currentMedicalRecordId > 0) {
    return {
      idFichaMedica: currentMedicalRecordId,
      ...nextMedicalInfo,
    };
  }

  return nextMedicalInfo;
};

const buildPetUpdateDebugSummary = (
  petId: number,
  payload: Record<string, unknown>,
  rawBody: string,
  status: number
) => {
  const payloadSummary = [
    `idMascota=${String(payload.idMascota ?? petId)}`,
    `clienteId=${String(payload.clienteId ?? 'null')}`,
    `especie=${String(payload.especie ?? 'null')}`,
    `raza=${String(payload.raza ?? 'null')}`,
    `fechaNacimiento=${String(payload.fechaNacimiento ?? 'null')}`,
    `peso=${String(payload.peso ?? 'null')}`,
    `sexo=${String(payload.sexo ?? 'null')}`,
    `esterilizado=${String(payload.esterilizado ?? 'null')}`,
    `microchip=${String(payload.microchip ?? 'null')}`,
  ].join(', ');

  const backendResponse = rawBody.trim() || 'respuesta vacía';

  return `Debug PUT /api/mascotas/${petId} [HTTP ${status}]: ${payloadSummary}. Backend: ${backendResponse}`;
};

const buildPetMedicalUpdateDebugSummary = (
  petId: number,
  payload: Record<string, unknown>,
  rawBody: string,
  status: number,
  variantLabel: string
) => {
  const nestedMedicalInfo =
    payload.fichaMedica && typeof payload.fichaMedica === 'object'
      ? (payload.fichaMedica as Record<string, unknown>)
      : payload;

  const payloadSummary = [
    `variante=${variantLabel}`,
    `idMascota=${String(payload.idMascota ?? petId)}`,
    `idFichaMedica=${String(nestedMedicalInfo.idFichaMedica ?? 'null')}`,
    `alergias=${String(nestedMedicalInfo.alergias ?? 'null')}`,
    `medicacionHabitual=${String(nestedMedicalInfo.medicacionHabitual ?? 'null')}`,
    `necesidadesEspeciales=${String(nestedMedicalInfo.necesidadesEspeciales ?? 'null')}`,
    `veterinario=${String(nestedMedicalInfo.veterinario ?? 'null')}`,
    `telefono=${String(nestedMedicalInfo.telefono ?? 'null')}`,
  ].join(', ');

  const backendResponse = rawBody.trim() || 'respuesta vacía';

  return `Debug ficha médica PUT /api/mascotas/${petId} [HTTP ${status}]: ${payloadSummary}. Backend: ${backendResponse}`;
};

const fetchPetBackendDetail = async (petId: number): Promise<BackendPetDetailItem> => {
  const response = await apiFetch(`${PETS_API_URL}/api/mascotas/${petId}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(
      buildApiErrorMessage(rawBody, response.status, 'No se pudo cargar el detalle de la mascota')
    );
  }

  if (!rawBody.trim()) {
    throw new Error('La mascota no devolvió datos para poder actualizarse');
  }

  return JSON.parse(rawBody) as BackendPetDetailItem;
};

const performPetUpdateRequest = async (
  petId: number,
  payload: Record<string, unknown>,
  fallbackMessage: string,
  debugSummaryBuilder?: (rawBody: string, status: number) => string
) => {
  const response = await apiFetch(`${PETS_API_URL}/api/mascotas/${petId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();

  if (!response.ok) {
    const baseMessage = buildApiErrorMessage(rawBody, response.status, fallbackMessage);
    const debugMessage = debugSummaryBuilder?.(rawBody, response.status);

    throw new PetApiRequestError(
      debugMessage ? `${baseMessage}. ${debugMessage}` : baseMessage,
      response.status
    );
  }

  if (!rawBody.trim()) {
    return petId;
  }

  try {
    return extractCreatedPetId(JSON.parse(rawBody)) || petId;
  } catch {
    return petId;
  }
};

const performPetMultipartRequest = async (
  path: string,
  method: 'POST' | 'PUT',
  payload: Record<string, unknown>,
  photoFile: File,
  fallbackId: number,
  fallbackMessage: string,
  debugSummaryBuilder?: (rawBody: string, status: number) => string
) => {
  let lastError: Error | null = null;

  for (const includeJsonPart of [false, true] as const) {
    for (const filePartName of PET_MULTIPART_FILE_PART_NAMES) {
      const response = await apiFetch(path, {
        method,
        body: buildPetMultipartBody(payload, {
          photoFile,
          filePartName,
          includeJsonPart,
        }),
      });

      const rawBody = await response.text();

      if (response.ok) {
        if (!rawBody.trim()) {
          return fallbackId;
        }

        try {
          return extractCreatedPetId(JSON.parse(rawBody)) || fallbackId;
        } catch {
          return fallbackId;
        }
      }

      const baseMessage = buildApiErrorMessage(rawBody, response.status, fallbackMessage);
      const debugMessage = debugSummaryBuilder?.(rawBody, response.status);
      lastError = new PetApiRequestError(
        debugMessage ? `${baseMessage}. ${debugMessage}` : baseMessage,
        response.status
      );

      if (response.status === 413) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error(fallbackMessage);
};

const performPetUrlEncodedRequest = async (
  path: string,
  method: 'POST' | 'PUT',
  payload: Record<string, unknown>,
  fallbackId: number,
  fallbackMessage: string,
  debugSummaryBuilder?: (rawBody: string, status: number) => string
) => {
  const response = await apiFetch(path, {
    method,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Accept: 'application/json',
    },
    body: buildPetUrlEncodedBody(payload),
  });

  const rawBody = await response.text();

  if (!response.ok) {
    const baseMessage = buildApiErrorMessage(rawBody, response.status, fallbackMessage);
    const debugMessage = debugSummaryBuilder?.(rawBody, response.status);

    throw new PetApiRequestError(
      debugMessage ? `${baseMessage}. ${debugMessage}` : baseMessage,
      response.status
    );
  }

  if (!rawBody.trim()) {
    return fallbackId;
  }

  try {
    return extractCreatedPetId(JSON.parse(rawBody)) || fallbackId;
  } catch {
    return fallbackId;
  }
};

const performPetFlatMultipartRequest = async (
  path: string,
  method: 'POST' | 'PUT',
  payload: Record<string, unknown>,
  fallbackId: number,
  fallbackMessage: string,
  debugSummaryBuilder?: (rawBody: string, status: number) => string
) => {
  const response = await apiFetch(path, {
    method,
    body: buildPetMultipartBody(payload),
  });

  const rawBody = await response.text();

  if (!response.ok) {
    const baseMessage = buildApiErrorMessage(rawBody, response.status, fallbackMessage);
    const debugMessage = debugSummaryBuilder?.(rawBody, response.status);

    throw new PetApiRequestError(
      debugMessage ? `${baseMessage}. ${debugMessage}` : baseMessage,
      response.status
    );
  }

  if (!rawBody.trim()) {
    return fallbackId;
  }

  try {
    return extractCreatedPetId(JSON.parse(rawBody)) || fallbackId;
  } catch {
    return fallbackId;
  }
};

const performPetUpdateWithoutPhotoFallbacks = async (
  petId: number,
  payload: Record<string, unknown>,
  fallbackMessage: string,
  debugSummaryBuilder?: (rawBody: string, status: number) => string
) => {
  try {
    return await performPetUpdateRequest(petId, payload, fallbackMessage, debugSummaryBuilder);
  } catch (error) {
    if (!(error instanceof PetApiRequestError) || error.status !== 415) {
      throw error;
    }
  }

  try {
    return await performPetUrlEncodedRequest(
      `${PETS_API_URL}/api/mascotas/${petId}`,
      'PUT',
      payload,
      petId,
      fallbackMessage,
      debugSummaryBuilder
    );
  } catch (error) {
    if (!(error instanceof PetApiRequestError) || error.status !== 415) {
      throw error;
    }
  }

  return performPetFlatMultipartRequest(
    `${PETS_API_URL}/api/mascotas/${petId}`,
    'PUT',
    payload,
    petId,
    fallbackMessage,
    debugSummaryBuilder
  );
};

const performJsonApiRequest = async (
  path: string,
  method: 'POST' | 'PUT',
  payload: Record<string, unknown>,
  fallbackMessage: string,
  debugSummaryBuilder?: (rawBody: string, status: number) => string
) => {
  const response = await apiFetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();

  if (!response.ok) {
    const baseMessage = buildApiErrorMessage(rawBody, response.status, fallbackMessage);
    const debugMessage = debugSummaryBuilder?.(rawBody, response.status);

    throw new PetApiRequestError(
      debugMessage ? `${baseMessage}. ${debugMessage}` : baseMessage,
      response.status
    );
  }

  if (!rawBody.trim()) {
    return 0;
  }

  try {
    return extractCreatedPetId(JSON.parse(rawBody));
  } catch {
    return 0;
  }
};

const extractCreatedPetId = (payload: unknown): number => {
  if (!payload || typeof payload !== 'object') {
    return 0;
  }

  const candidatePayload = payload as Record<string, unknown>;
  const directCandidates = [
    candidatePayload.idMascota,
    candidatePayload.mascotaId,
    candidatePayload.id,
  ];

  for (const candidate of directCandidates) {
    const numericId = Number(candidate);

    if (Number.isFinite(numericId) && numericId > 0) {
      return numericId;
    }
  }

  if (candidatePayload.mascota && typeof candidatePayload.mascota === 'object') {
    return extractCreatedPetId(candidatePayload.mascota);
  }

  if (candidatePayload.data && typeof candidatePayload.data === 'object') {
    return extractCreatedPetId(candidatePayload.data);
  }

  return 0;
};

export const fetchPetsPageData = async (): Promise<EditablePet[]> => {
  const [petsResponse, clientsResponse] = await Promise.all([
    apiFetch(`${PETS_API_URL}/api/mascotas`, {
      headers: {
        Accept: 'application/json',
      },
    }),
    apiFetch(`${PETS_API_URL}/api/clientes`, {
      headers: {
        Accept: 'application/json',
      },
    }),
  ]);

  if (!petsResponse.ok) {
    throw new Error('No se pudieron cargar las mascotas');
  }

  if (!clientsResponse.ok) {
    throw new Error('No se pudieron cargar los clientes');
  }

  const petsData: BackendPetListItem[] = await petsResponse.json();
  const clientsData: BackendClientListItem[] = await clientsResponse.json();
  const ownerIdByName = new Map(clientsData.map((client) => [client.nombre, client.id]));
  const uniquePets = new Map<number, EditablePet>();

  for (const pet of petsData) {
    const existingPet = uniquePets.get(pet.idMascota);
    const hasRoom = Boolean(pet.sala);

    if (!existingPet) {
      uniquePets.set(pet.idMascota, {
        id: pet.idMascota,
        name: pet.nombre,
        species: mapSpeciesToUi(pet.especie),
        breed: pet.raza,
        age: pet.edad,
        microchipNumber: '',
        birthDate: '',
        weight: '',
        sex: '',
        neutered: '',
        observations: '',
        photoUrl: extractPetPhotoUrl(pet),
        owner: pet.dueno,
        ownerId: ownerIdByName.get(pet.dueno),
        isHosted: hasRoom,
        room: pet.sala,
      });
      continue;
    }

    uniquePets.set(pet.idMascota, {
      ...existingPet,
      photoUrl: extractPetPhotoUrl(pet) || existingPet.photoUrl,
      isHosted: existingPet.isHosted || hasRoom,
      room: hasRoom ? pet.sala : existingPet.room,
    });
  }

  return Array.from(uniquePets.values()).sort((petA, petB) =>
    petA.name.localeCompare(petB.name, 'es')
  );
};

export const createPetRequest = async (
  pet: PetCreateInput,
  upload: PetImageUploadInput = {}
): Promise<number> => {
  const payload = mapPetInputToBackend(pet);

  if (upload.photoFile) {
    return performPetMultipartRequest(
      `${PETS_API_URL}/api/mascotas`,
      'POST',
      payload,
      upload.photoFile,
      0,
      'No se pudo crear la mascota'
    );
  }

  const response = await apiFetch(`${PETS_API_URL}/api/mascotas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(rawBody, response.status, 'No se pudo crear la mascota'));
  }

  if (!rawBody.trim()) {
    return 0;
  }

  try {
    return extractCreatedPetId(JSON.parse(rawBody));
  } catch {
    return 0;
  }
};

export const mapEditablePetToPetInput = (pet: EditablePet): PetUpdateInput => ({
  ownerId: pet.ownerId ?? 0,
  name: pet.name.trim(),
  species: pet.species,
  breed: pet.breed.trim(),
  microchipNumber: pet.microchipNumber?.trim() ?? '',
  birthDate: pet.birthDate ?? '',
  weight: pet.weight?.trim() ?? '',
  sex: pet.sex === 'Macho' || pet.sex === 'Hembra' ? pet.sex : '',
  neutered: pet.neutered === 'No' ? 'No' : 'Sí',
  observations: pet.observations?.trim() ?? '',
});

export const updatePetRequest = async (
  petId: number,
  pet: PetUpdateInput,
  upload: PetImageUploadInput = {}
): Promise<PetUpdateResult> => {
  const currentPetDetail = await fetchPetBackendDetail(petId);
  const payload = mapPetUpdateInputToBackend(pet, currentPetDetail);

  try {
    if (upload.photoFile) {
      try {
        const updatedPetId = await performPetMultipartRequest(
          `${PETS_API_URL}/api/mascotas/${petId}`,
          'PUT',
          payload,
          upload.photoFile,
          petId,
          'No se pudo actualizar la mascota',
          (rawBody, status) => buildPetUpdateDebugSummary(petId, payload, rawBody, status)
        );

        return {
          petId: updatedPetId,
          photoSavedToBackend: true,
        };
      } catch (error) {
        if (!(error instanceof PetApiRequestError) || error.status !== 415) {
          throw error;
        }

        const updatedPetId = await performPetUpdateWithoutPhotoFallbacks(
          petId,
          payload,
          'No se pudo actualizar la mascota',
          (rawBody, status) => buildPetUpdateDebugSummary(petId, payload, rawBody, status)
        );

        return {
          petId: updatedPetId,
          photoSavedToBackend: false,
        };
      }
    }

    const updatedPetId = await performPetUpdateWithoutPhotoFallbacks(
      petId,
      payload,
      'No se pudo actualizar la mascota',
      (rawBody, status) => buildPetUpdateDebugSummary(petId, payload, rawBody, status)
    );

    return {
      petId: updatedPetId,
      photoSavedToBackend: true,
    };
  } catch (error) {
    console.error('[pets-api] Pet update failed', {
      petId,
      payload,
      currentPetDetail,
      error,
    });
    throw error;
  }
};

export const updatePetMedicalInfoRequest = async (
  petId: number,
  medicalInfo: PetMedicalInfoInput
): Promise<number> => {
  const currentPetDetail = await fetchPetBackendDetail(petId);
  const basePayload = mapCurrentPetDetailToUpdatePayload(currentPetDetail);
  const medicalPayload = mapPetMedicalInfoToBackend(
    medicalInfo,
    currentPetDetail.fichaMedica,
    petId
  );
  const nestedPayload = {
    ...basePayload,
    fichaMedica: medicalPayload,
  };
  const attemptErrors: string[] = [];

  const collectAttemptError = (label: string, error: unknown) => {
    const message = error instanceof Error ? error.message : 'error desconocido';
    attemptErrors.push(`${label}: ${message}`);
  };

  try {
    return await performPetUpdateRequest(
      petId,
      nestedPayload,
      'No se pudo actualizar la ficha médica de la mascota',
      (rawBody, status) =>
        buildPetMedicalUpdateDebugSummary(
          petId,
          nestedPayload,
          rawBody,
          status,
          'fichaMedica'
        )
    );
  } catch (nestedError) {
    collectAttemptError('PUT mascota con fichaMedica', nestedError);
    const flatPayload = {
      ...basePayload,
      ...medicalPayload,
    };

    try {
      return await performPetUpdateRequest(
        petId,
        flatPayload,
        'No se pudo actualizar la ficha médica de la mascota',
        (rawBody, status) =>
          buildPetMedicalUpdateDebugSummary(petId, flatPayload, rawBody, status, 'campos-planos')
      );
    } catch (flatError) {
      collectAttemptError('PUT mascota con campos planos', flatError);
    }
  }

  const dedicatedPaths = [
    { path: `/api/mascotas/${petId}/ficha-medica`, method: 'POST' as const, label: 'POST ruta dedicada' },
    { path: `/api/mascotas/${petId}/ficha-medica`, method: 'PUT' as const, label: 'PUT ruta dedicada' },
    { path: '/api/fichas-medicas', method: 'POST' as const, label: 'POST fichas-medicas' },
  ];

  const medicalRecordId = Number(currentPetDetail.fichaMedica?.idFichaMedica ?? NaN);

  if (Number.isFinite(medicalRecordId) && medicalRecordId > 0) {
    dedicatedPaths.push({
      path: `/api/fichas-medicas/${medicalRecordId}`,
      method: 'PUT' as const,
      label: 'PUT fichas-medicas por idFichaMedica',
    });
  }

  for (const attempt of dedicatedPaths) {
    try {
      const result =
        (await performJsonApiRequest(
          attempt.path,
          attempt.method,
          medicalPayload,
          'No se pudo actualizar la ficha médica de la mascota',
          (rawBody, status) =>
            buildPetMedicalUpdateDebugSummary(
              petId,
              medicalPayload,
              rawBody,
              status,
              `${attempt.method} ${attempt.path}`
            )
        )) || petId;

      return result;
    } catch (attemptError) {
      collectAttemptError(attempt.label, attemptError);
    }
  }

  console.error('[pets-api] Pet medical update failed', {
    petId,
    medicalPayload,
    nestedPayload,
    basePayload,
    currentPetDetail,
    attempts: attemptErrors,
  });

  const currentMedicalRecordId = Number(currentPetDetail.fichaMedica?.idFichaMedica ?? NaN);
  const hasExistingMedicalRecord =
    Number.isFinite(currentMedicalRecordId) && currentMedicalRecordId > 0;

  if (!hasExistingMedicalRecord) {
    throw new PetMedicalBackendUnsupportedError(
      `La API actual no permite crear la ficha médica inicial de esta mascota. Intentos realizados: ${attemptErrors.join(' | ')}`
    );
  }

  throw new Error(
    `No se pudo actualizar la ficha médica en la base de datos. Intentos realizados: ${attemptErrors.join(' | ')}`
  );
};

export const deletePetRequest = async (petId: number) => {
  const response = await apiFetch(`${PETS_API_URL}/api/mascotas/${petId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('No se pudo eliminar la mascota');
  }

  return petId;
};
