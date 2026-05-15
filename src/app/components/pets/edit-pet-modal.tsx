import { useEffect, useRef, useState } from 'react';
import { X, PawPrint, User, DoorOpen, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  getLatestAllowedPetBirthDate,
  getPetBirthDateValidationError,
  getPetWeightValidationError,
  isPetTextOnly,
  isValidPetImageFile,
  isValidPetMicrochipNumber,
  MAX_PET_WEIGHT_KG,
  normalizePetMicrochipNumber,
  PET_IMAGE_FORMAT_ERROR,
  PET_IMAGE_INPUT_ACCEPT,
  PET_IMAGE_PROCESSING_ERROR,
  PET_IMAGE_PROCESSING_PENDING_ERROR,
  optimizePetImageForUpload,
  readPetImagePreviewUrl,
} from '../../utils/pet-form';

export interface EditablePet {
  id: number;
  name: string;
  species: 'Perro' | 'Gato';
  breed: string;
  age: number;
  microchipNumber?: string;
  birthDate?: string;
  weight?: string;
  sex?: 'Macho' | 'Hembra' | '';
  neutered?: 'Si' | 'No' | '';
  observations?: string;
  photoUrl?: string;
  owner: string;
  ownerId?: number;
  isHosted: boolean;
  room: string | null;
}

export interface EditablePetSubmission extends EditablePet {
  photoFile?: File | null;
}

export interface EditPetSaveResult {
  photoSavedToBackend?: boolean;
}

interface EditPetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pet: EditablePetSubmission) => Promise<EditPetSaveResult | void> | EditPetSaveResult | void;
  pet: EditablePet | null;
}

const getInitialFormData = (pet: EditablePet | null) => ({
  name: pet?.name ?? '',
  species: pet?.species ?? ('Perro' as EditablePet['species']),
  breed: pet?.breed ?? '',
  microchipNumber: pet?.microchipNumber ?? '',
  birthDate: pet?.birthDate ?? '',
  weight: pet?.weight ?? '',
  sex: pet?.sex ?? '',
  neutered: pet?.neutered ?? '',
  observations: pet?.observations ?? '',
});

const latestAllowedBirthDate = getLatestAllowedPetBirthDate();

export function EditPetModal({ isOpen, onClose, onSave, pet }: EditPetModalProps) {
  const calculateAgeFromBirthDate = (birthDate: string) => {
    if (!birthDate) {
      return pet?.age ?? 0;
    }

    const today = new Date();
    const birth = new Date(`${birthDate}T00:00:00`);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDifference = today.getMonth() - birth.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birth.getDate())
    ) {
      age -= 1;
    }

    return Math.max(age, 0);
  };

  const [formData, setFormData] = useState(() => getInitialFormData(pet));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(pet?.photoUrl ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData(getInitialFormData(pet));
    setErrors({});
    setIsSubmitting(false);
    setIsProcessingPhoto(false);
    setPhotoPreview(pet?.photoUrl ?? null);
    setPhotoFile(null);
  }, [pet, isOpen]);

  if (!isOpen || !pet) {
    return null;
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    const nextValue =
      field === 'microchipNumber' ? normalizePetMicrochipNumber(value) : value;

    setFormData((previousData) => ({
      ...previousData,
      [field]: nextValue,
    }));

    if (errors[field] || errors.submit) {
      setErrors((previousErrors) => {
        const nextErrors = { ...previousErrors };
        delete nextErrors[field];
        delete nextErrors.submit;
        return nextErrors;
      });
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!isValidPetImageFile(file)) {
      event.target.value = '';
      setErrors((previousErrors) => ({
        ...previousErrors,
        photo: PET_IMAGE_FORMAT_ERROR,
      }));
      return;
    }

    setIsProcessingPhoto(true);

    try {
      const optimizedFile = await optimizePetImageForUpload(file);
      const previewUrl = await readPetImagePreviewUrl(optimizedFile);

      setPhotoPreview(previewUrl);
      setPhotoFile(optimizedFile);
      setErrors((previousErrors) => {
        const nextErrors = { ...previousErrors };
        delete nextErrors.photo;
        return nextErrors;
      });
    } catch {
      setErrors((previousErrors) => ({
        ...previousErrors,
        photo: PET_IMAGE_PROCESSING_ERROR,
      }));
    } finally {
      event.target.value = '';
      setIsProcessingPhoto(false);
    }
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      nextErrors.name = 'El nombre es obligatorio';
    } else if (!isPetTextOnly(formData.name)) {
      nextErrors.name = 'El nombre solo puede contener letras';
    }

    if (!formData.breed.trim()) {
      nextErrors.breed = 'La raza es obligatoria';
    } else if (!isPetTextOnly(formData.breed)) {
      nextErrors.breed = 'La raza solo puede contener letras';
    }

    if (!formData.birthDate) {
      nextErrors.birthDate = 'La fecha de nacimiento es obligatoria';
    } else {
      const birthDateError = getPetBirthDateValidationError(formData.birthDate);

      if (birthDateError) {
        nextErrors.birthDate = birthDateError;
      }
    }

    if (
      formData.microchipNumber.trim() &&
      !isValidPetMicrochipNumber(formData.microchipNumber)
    ) {
      nextErrors.microchipNumber = 'El número de microchip debe tener 15 números';
    }

    if (!formData.sex) {
      nextErrors.sex = 'Selecciona el sexo';
    }

    if (!formData.neutered) {
      nextErrors.neutered = 'Indica si esta esterilizado';
    }

    if (formData.weight) {
      const weightError = getPetWeightValidationError(formData.weight);

      if (weightError) {
        nextErrors.weight = weightError;
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isProcessingPhoto) {
      setErrors((previousErrors) => ({
        ...previousErrors,
        photo: PET_IMAGE_PROCESSING_PENDING_ERROR,
      }));
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors((previousErrors) => {
      const nextErrors = { ...previousErrors };
      delete nextErrors.submit;
      return nextErrors;
    });

    try {
      const saveResult = await onSave({
        ...pet,
        name: formData.name.trim(),
        species: formData.species,
        breed: formData.breed.trim(),
        age: calculateAgeFromBirthDate(formData.birthDate),
        microchipNumber: formData.microchipNumber.trim(),
        birthDate: formData.birthDate,
        weight: formData.weight.trim(),
        sex: formData.sex,
        neutered: formData.neutered,
        observations: formData.observations.trim(),
        photoUrl: photoPreview ?? '',
        photoFile,
      });

      toast.success('Mascota actualizada', {
        description:
          saveResult?.photoSavedToBackend === false
            ? `${formData.name.trim() || pet.name} se ha actualizado. La nueva imagen queda visible en esta sesión, pero la API todavía no permite reemplazarla al editar.`
            : `${formData.name.trim() || pet.name} se ha editado correctamente.`,
      });

      onClose();
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'No se pudo actualizar la mascota';

      setErrors((previousErrors) => ({
        ...previousErrors,
        submit: message,
      }));
      toast.error('No se pudo actualizar la mascota', {
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 p-5">
          <div>
            <h3 className="text-gray-900">Editar mascota</h3>
            <p className="mt-1 text-sm text-gray-600">
              Actualiza los datos visibles en el listado de mascotas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[calc(100vh-10rem)] space-y-5 overflow-y-auto p-5">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-500">ID mascota</p>
                  <p className="text-sm text-gray-900">{pet.id}</p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-green-100 p-2 text-green-600">
                    {pet.isHosted ? <DoorOpen className="h-4 w-4" /> : <PawPrint className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Estado actual</p>
                    <p className="text-sm text-gray-900">
                      {pet.isHosted ? `Hospedado en ${pet.room}` : 'No hospedado'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="pet-name" className="mb-2 block text-sm font-medium text-gray-700">
                  Nombre
                </label>
                <Input
                  id="pet-name"
                  value={formData.name}
                  onChange={(event) => handleChange('name', event.target.value)}
                  className={errors.name ? 'border-red-300' : ''}
                  disabled={isSubmitting}
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Especie</label>
                <Select
                  value={formData.species}
                  onValueChange={(value) =>
                    handleChange('species', value as EditablePet['species'])
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una especie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Perro">Perro</SelectItem>
                    <SelectItem value="Gato">Gato</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="pet-microchip" className="mb-2 block text-sm font-medium text-gray-700">
                  Numero de microchip
                </label>
                <Input
                  id="pet-microchip"
                  value={formData.microchipNumber}
                  onChange={(event) => handleChange('microchipNumber', event.target.value)}
                  placeholder="Ej. 981020000123456"
                  inputMode="numeric"
                  maxLength={15}
                  className={errors.microchipNumber ? 'border-red-300' : ''}
                  disabled={isSubmitting}
                />
                {errors.microchipNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.microchipNumber}</p>
                )}
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="pet-breed" className="mb-2 block text-sm font-medium text-gray-700">
                  Raza
                </label>
                <Input
                  id="pet-breed"
                  value={formData.breed}
                  onChange={(event) => handleChange('breed', event.target.value)}
                  className={errors.breed ? 'border-red-300' : ''}
                  disabled={isSubmitting}
                />
                {errors.breed && <p className="mt-1 text-sm text-red-600">{errors.breed}</p>}
              </div>

              <div>
                <label htmlFor="pet-birth-date" className="mb-2 block text-sm font-medium text-gray-700">
                  Fecha de nacimiento
                </label>
                <Input
                  id="pet-birth-date"
                  type="date"
                  value={formData.birthDate}
                  onChange={(event) => handleChange('birthDate', event.target.value)}
                  max={latestAllowedBirthDate}
                  className={errors.birthDate ? 'border-red-300' : ''}
                  disabled={isSubmitting}
                />
                {errors.birthDate && <p className="mt-1 text-sm text-red-600">{errors.birthDate}</p>}
              </div>

              <div>
                <label htmlFor="pet-weight" className="mb-2 block text-sm font-medium text-gray-700">
                  Peso (kg)
                </label>
                <Input
                  id="pet-weight"
                  type="number"
                  min="0"
                  max={String(MAX_PET_WEIGHT_KG)}
                  step="0.1"
                  placeholder="Ej. 12.5"
                  value={formData.weight}
                  onChange={(event) => handleChange('weight', event.target.value)}
                  className={errors.weight ? 'border-red-300' : ''}
                  disabled={isSubmitting}
                />
                {errors.weight && <p className="mt-1 text-sm text-red-600">{errors.weight}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Sexo</label>
                <Select
                  value={formData.sex}
                  onValueChange={(value) => handleChange('sex', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className={errors.sex ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Selecciona el sexo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Macho">Macho</SelectItem>
                    <SelectItem value="Hembra">Hembra</SelectItem>
                  </SelectContent>
                </Select>
                {errors.sex && <p className="mt-1 text-sm text-red-600">{errors.sex}</p>}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Esterilizado <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.neutered}
                  onValueChange={(value) => handleChange('neutered', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className={errors.neutered ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Selecciona una opcion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Si">Si</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
                {errors.neutered && <p className="mt-1 text-sm text-red-600">{errors.neutered}</p>}
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <label className="mb-2 block text-sm font-medium text-gray-700">Foto</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={PET_IMAGE_INPUT_ACCEPT}
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={isSubmitting || isProcessingPhoto}
                />
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-white">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt={`Foto de ${formData.name || pet.name}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <PawPrint className="h-6 w-6 text-gray-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting || isProcessingPhoto}
                      className="border-gray-200"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {isProcessingPhoto ? 'Procesando foto...' : 'Subir foto'}
                    </Button>
                    <p className="mt-2 text-xs text-gray-500">
                      PNG o JPG. La imagen se reduce automáticamente si es demasiado grande.
                    </p>
                    {errors.photo && <p className="mt-1 text-sm text-red-600">{errors.photo}</p>}
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-2">
                <label htmlFor="pet-observations" className="mb-2 block text-sm font-medium text-gray-700">
                  Observaciones
                </label>
                <Textarea
                  id="pet-observations"
                  value={formData.observations}
                  onChange={(event) => handleChange('observations', event.target.value)}
                  disabled={isSubmitting}
                  className="min-h-20"
                  placeholder="Notas internas sobre la mascota"
                />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Dueño</p>
                    <p className="text-sm text-gray-900">{pet.owner}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Edad calculada</p>
                  <p className="text-sm text-gray-900">
                    {formData.birthDate
                      ? `${calculateAgeFromBirthDate(formData.birthDate)} años`
                      : `${pet.age} años`}
                  </p>
                </div>
              </div>
            </div>

            {errors.submit && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {errors.submit}
              </div>
            )}
          </div>

          <div className="flex gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50 p-5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting || isProcessingPhoto}
              className="flex-1 border-gray-200 hover:bg-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isProcessingPhoto}
              className="flex-1 bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
            >
              {isSubmitting
                ? 'Guardando cambios...'
                : isProcessingPhoto
                  ? 'Procesando foto...'
                  : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
