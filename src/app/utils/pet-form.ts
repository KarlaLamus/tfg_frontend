const LETTERS_ONLY_PATTERN = /^[\p{L}]+(?:[ '-][\p{L}]+)*$/u;
const MICROCHIP_PATTERN = /^\d{15}$/;
export const MAX_PET_WEIGHT_KG = 150;
export const PET_IMAGE_INPUT_ACCEPT = '.png,.jpg,.jpeg,image/png,image/jpeg';
export const PET_IMAGE_FORMAT_ERROR = 'Solo se permiten archivos PNG o JPG';
export const PET_IMAGE_PROCESSING_ERROR = 'No se pudo procesar la imagen seleccionada';
export const PET_IMAGE_PROCESSING_PENDING_ERROR =
  'Espera a que termine de procesarse la imagen';

const ALLOWED_PET_IMAGE_TYPES = new Set(['image/png', 'image/jpeg']);
const ALLOWED_PET_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
const PET_IMAGE_MAX_DIMENSION = 1200;
const PET_IMAGE_TARGET_MAX_BYTES = 220 * 1024;
const PET_IMAGE_INITIAL_JPEG_QUALITY = 0.82;
const PET_IMAGE_MIN_JPEG_QUALITY = 0.5;
const PET_IMAGE_SCALE_STEP = 0.85;
const PET_IMAGE_MIN_DIMENSION = 320;
const PET_IMAGE_JPEG_MIME_TYPE = 'image/jpeg';
const PET_IMAGE_PNG_MIME_TYPE = 'image/png';

const digitsOnly = (value: string) => value.replace(/\D/g, '');
const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const normalizePetMicrochipNumber = (value: string) => digitsOnly(value).slice(0, 15);

export const isPetTextOnly = (value: string) => LETTERS_ONLY_PATTERN.test(value.trim());

export const isValidPetImageFile = (file: File) => {
  if (ALLOWED_PET_IMAGE_TYPES.has(file.type)) {
    return true;
  }

  if (file.type) {
    return false;
  }

  const normalizedFileName = file.name.trim().toLowerCase();
  return ALLOWED_PET_IMAGE_EXTENSIONS.some((extension) =>
    normalizedFileName.endsWith(extension)
  );
};

const loadImageElement = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(PET_IMAGE_PROCESSING_ERROR));
    };

    image.src = objectUrl;
  });

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(PET_IMAGE_PROCESSING_ERROR));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality
    );
  });

const getOptimizedPetImageName = (fileName: string, mimeType: string) => {
  const normalizedName = fileName.trim();
  const extension = mimeType === PET_IMAGE_PNG_MIME_TYPE ? '.png' : '.jpg';
  const nameWithoutExtension = normalizedName.replace(/\.[^.]+$/, '') || 'mascota';

  return `${nameWithoutExtension}${extension}`;
};

const renderPetImageBlob = async (
  image: HTMLImageElement,
  width: number,
  height: number,
  mimeType: string,
  quality?: number
) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error(PET_IMAGE_PROCESSING_ERROR);
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvasToBlob(canvas, mimeType, quality);
};

export const readPetImagePreviewUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error(PET_IMAGE_PROCESSING_ERROR));
    };

    reader.onerror = () => reject(new Error(PET_IMAGE_PROCESSING_ERROR));
    reader.readAsDataURL(file);
  });

export const optimizePetImageForUpload = async (file: File) => {
  const image = await loadImageElement(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;

  if (originalWidth <= 0 || originalHeight <= 0) {
    throw new Error(PET_IMAGE_PROCESSING_ERROR);
  }

  let width = originalWidth;
  let height = originalHeight;
  const scale = Math.min(1, PET_IMAGE_MAX_DIMENSION / Math.max(originalWidth, originalHeight));

  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  if (
    file.size <= PET_IMAGE_TARGET_MAX_BYTES &&
    width === originalWidth &&
    height === originalHeight
  ) {
    return file;
  }

  let mimeType = file.type === PET_IMAGE_PNG_MIME_TYPE ? PET_IMAGE_PNG_MIME_TYPE : PET_IMAGE_JPEG_MIME_TYPE;
  let quality = PET_IMAGE_INITIAL_JPEG_QUALITY;
  let blob = await renderPetImageBlob(
    image,
    width,
    height,
    mimeType,
    mimeType === PET_IMAGE_JPEG_MIME_TYPE ? quality : undefined
  );

  if (blob.size > PET_IMAGE_TARGET_MAX_BYTES && mimeType === PET_IMAGE_PNG_MIME_TYPE) {
    mimeType = PET_IMAGE_JPEG_MIME_TYPE;
    quality = PET_IMAGE_INITIAL_JPEG_QUALITY;
    blob = await renderPetImageBlob(image, width, height, mimeType, quality);
  }

  while (blob.size > PET_IMAGE_TARGET_MAX_BYTES && quality > PET_IMAGE_MIN_JPEG_QUALITY) {
    quality = Math.max(quality - 0.08, PET_IMAGE_MIN_JPEG_QUALITY);
    blob = await renderPetImageBlob(image, width, height, PET_IMAGE_JPEG_MIME_TYPE, quality);
  }

  while (
    blob.size > PET_IMAGE_TARGET_MAX_BYTES &&
    Math.max(width, height) > PET_IMAGE_MIN_DIMENSION
  ) {
    width = Math.max(1, Math.round(width * PET_IMAGE_SCALE_STEP));
    height = Math.max(1, Math.round(height * PET_IMAGE_SCALE_STEP));
    quality = PET_IMAGE_INITIAL_JPEG_QUALITY;
    blob = await renderPetImageBlob(image, width, height, PET_IMAGE_JPEG_MIME_TYPE, quality);

    while (blob.size > PET_IMAGE_TARGET_MAX_BYTES && quality > PET_IMAGE_MIN_JPEG_QUALITY) {
      quality = Math.max(quality - 0.08, PET_IMAGE_MIN_JPEG_QUALITY);
      blob = await renderPetImageBlob(image, width, height, PET_IMAGE_JPEG_MIME_TYPE, quality);
    }
  }

  return new File([blob], getOptimizedPetImageName(file.name, blob.type), {
    type: blob.type,
    lastModified: Date.now(),
  });
};

export const isValidPetMicrochipNumber = (value: string) =>
  MICROCHIP_PATTERN.test(normalizePetMicrochipNumber(value));

export const getLatestAllowedPetBirthDate = (today = new Date()) => {
  const normalizedToday = new Date(today);
  normalizedToday.setHours(0, 0, 0, 0);
  normalizedToday.setMonth(normalizedToday.getMonth() - 3);

  return formatDateForInput(normalizedToday);
};

export const getPetBirthDateValidationError = (birthDate: string) => {
  if (!birthDate) {
    return null;
  }

  const parsedBirthDate = new Date(`${birthDate}T00:00:00`);

  if (Number.isNaN(parsedBirthDate.getTime())) {
    return 'La fecha de nacimiento no es válida';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (parsedBirthDate > today) {
    return 'La fecha de nacimiento no puede ser futura';
  }

  const latestAllowedBirthDate = new Date(today);
  latestAllowedBirthDate.setMonth(latestAllowedBirthDate.getMonth() - 3);

  if (parsedBirthDate > latestAllowedBirthDate) {
    return 'La mascota debe tener al menos 3 meses';
  }

  return null;
};

export const getPetWeightValidationError = (weight: string) => {
  if (!weight.trim()) {
    return null;
  }

  const parsedWeight = Number(weight);

  if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
    return 'Introduce un peso válido';
  }

  if (parsedWeight > MAX_PET_WEIGHT_KG) {
    return `El peso no puede superar ${MAX_PET_WEIGHT_KG} kg`;
  }

  return null;
};

export const mapPetSubmitErrorToField = (message: string) => {
  const normalizedMessage = message.trim();
  const lowerCaseMessage = normalizedMessage.toLowerCase();

  if (!normalizedMessage) {
    return null;
  }

  if (lowerCaseMessage.includes('microchip')) {
    return {
      field: 'microchipNumber' as const,
      message:
        lowerCaseMessage.includes('existe') ||
        lowerCaseMessage.includes('duplic') ||
        lowerCaseMessage.includes('uso')
          ? 'El número de microchip ya está en uso'
          : normalizedMessage,
    };
  }

  if (lowerCaseMessage.includes('raza')) {
    return { field: 'breed' as const, message: normalizedMessage };
  }

  if (lowerCaseMessage.includes('peso')) {
    return { field: 'weight' as const, message: normalizedMessage };
  }

  if (lowerCaseMessage.includes('sexo')) {
    return { field: 'sex' as const, message: normalizedMessage };
  }

  if (lowerCaseMessage.includes('esteriliz')) {
    return { field: 'neutered' as const, message: normalizedMessage };
  }

  if (lowerCaseMessage.includes('fecha')) {
    return { field: 'birthDate' as const, message: normalizedMessage };
  }

  if (lowerCaseMessage.includes('especie')) {
    return { field: 'species' as const, message: normalizedMessage };
  }

  if (
    lowerCaseMessage.includes('cliente') ||
    lowerCaseMessage.includes('dueño') ||
    lowerCaseMessage.includes('dueno')
  ) {
    return { field: 'clientId' as const, message: normalizedMessage };
  }

  if (lowerCaseMessage.includes('nombre')) {
    return { field: 'name' as const, message: normalizedMessage };
  }

  return null;
};
