import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { X, User, PawPrint, Upload, Dog, Cat, Calendar, Weight, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  CLIENTS_QUERY_KEY,
  fetchClients,
  type ClientListRecord,
} from '../../utils/clients-api';
import { useAppliedLocalClientChanges } from '../../utils/client-local-overrides';
import {
  createPetRequest,
  fetchPetsPageData,
  PETS_QUERY_KEY,
  type PetCreateInput,
} from '../../utils/pets-api';
import {
  getLatestAllowedPetBirthDate,
  getPetBirthDateValidationError,
  isValidPetImageFile,
  getPetWeightValidationError,
  isPetTextOnly,
  isValidPetMicrochipNumber,
  mapPetSubmitErrorToField,
  MAX_PET_WEIGHT_KG,
  normalizePetMicrochipNumber,
  PET_IMAGE_FORMAT_ERROR,
  PET_IMAGE_INPUT_ACCEPT,
  PET_IMAGE_PROCESSING_ERROR,
  PET_IMAGE_PROCESSING_PENDING_ERROR,
  optimizePetImageForUpload,
  readPetImagePreviewUrl,
} from '../../utils/pet-form';
import {
  RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY,
  RESERVATION_FORM_CLIENT_PETS_QUERY_KEY,
} from '../../utils/deletion-sync';
import type { EditablePet } from './edit-pet-modal';

interface AddPetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (petId: string, petSummary?: AddedPetSummary) => void;
  preselectedClientId?: number;
  preselectedClientName?: string;
  preselectedClientEmail?: string;
  preselectedClientPhone?: string;
}

type ClientOption = {
  id: number;
  name: string;
  email: string;
  phone: string;
};

export interface AddedPetSummary {
  id: number;
  name: string;
  species: 'Perro' | 'Gato';
  breed: string;
  microchipNumber?: string;
  age: number;
  birthDate?: string;
  weight: number;
  sex?: 'Macho' | 'Hembra' | '';
  neutered?: 'Si' | 'No' | '';
  color: string;
  observations: string;
  photoUrl?: string;
  owner: string;
  ownerId?: number;
  isHosted: boolean;
  room: string | null;
  isLocalOnly?: boolean;
}

const mapClientToOption = (client: ClientListRecord): ClientOption => ({
  id: client.id,
  name: client.name,
  email: client.email,
  phone: client.phone,
});

const getFallbackSelectedClient = (
  clientId?: number,
  clientName?: string,
  clientEmail?: string,
  clientPhone?: string
): ClientOption | null =>
  clientId && clientName
    ? {
        id: clientId,
        name: clientName,
        email: clientEmail ?? '',
        phone: clientPhone ?? '',
      }
    : null;

const getInitialFormData = (clientId?: number) => ({
  clientId: clientId || null,
  name: '',
  species: '',
  breed: '',
  microchipNumber: '',
  birthDate: '',
  weight: '',
  sex: '',
  neutered: '',
  observations: '',
});

const calculateAgeFromBirthDate = (birthDate: string) => {
  if (!birthDate) {
    return 0;
  }

  const today = new Date();
  const birth = new Date(`${birthDate}T00:00:00`);

  if (Number.isNaN(birth.getTime())) {
    return 0;
  }

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

const latestAllowedBirthDate = getLatestAllowedPetBirthDate();

const normalizeLookupValue = (value: string) => value.trim().toLowerCase();

const findCreatedPetInList = (
  pets: EditablePet[],
  input: PetCreateInput
): EditablePet | undefined => {
  const normalizedName = normalizeLookupValue(input.name);
  const normalizedBreed = normalizeLookupValue(input.breed);

  return [...pets]
    .filter((pet) => pet.ownerId === input.ownerId)
    .filter((pet) => normalizeLookupValue(pet.name) === normalizedName)
    .filter((pet) => pet.species === input.species)
    .filter((pet) =>
      normalizedBreed ? normalizeLookupValue(pet.breed) === normalizedBreed : true
    )
    .sort((petA, petB) => petB.id - petA.id)[0];
};

export function AddPetModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedClientId,
  preselectedClientName,
  preselectedClientEmail,
  preselectedClientPhone,
}: AddPetModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(() => getInitialFormData(preselectedClientId));

  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(() =>
    getFallbackSelectedClient(
      preselectedClientId,
      preselectedClientName,
      preselectedClientEmail,
      preselectedClientPhone
    )
  );

  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: backendClients = [] } = useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: fetchClients,
  });
  const clients = useAppliedLocalClientChanges<ClientListRecord>(backendClients);

  const clientOptions = useMemo(() => clients.map(mapClientToOption), [clients]);

  const preselectedClient = useMemo(() => {
    if (!preselectedClientId) {
      return null;
    }

    return (
      clientOptions.find((client) => client.id === preselectedClientId) ??
      getFallbackSelectedClient(
        preselectedClientId,
        preselectedClientName,
        preselectedClientEmail,
        preselectedClientPhone
      )
    );
  }, [
    clientOptions,
    preselectedClientEmail,
    preselectedClientId,
    preselectedClientName,
    preselectedClientPhone,
  ]);

  const activeSelectedClient = selectedClient ?? preselectedClient;

  if (!isOpen) return null;

  const filteredClients = clientOptions.filter(
    (client) =>
      client.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      client.phone.includes(clientSearchTerm)
  );

  const handleChange = (field: string, value: string) => {
    const nextValue =
      field === 'microchipNumber' ? normalizePetMicrochipNumber(value) : value;

    setFormData((prev) => ({ ...prev, [field]: nextValue }));
    if (errors[field] || errors.submit) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        delete newErrors.submit;
        return newErrors;
      });
    }
  };

  const handleClientSelect = (client: ClientOption) => {
    setSelectedClient(client);
    setFormData((prev) => ({ ...prev, clientId: client.id }));
    setClientSearchTerm('');
    setShowClientDropdown(false);
    if (errors.clientId) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.clientId;
        delete newErrors.submit;
        return newErrors;
      });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (!isValidPetImageFile(file)) {
      e.target.value = '';
      setErrors((prev) => ({ ...prev, photo: PET_IMAGE_FORMAT_ERROR }));
      return;
    }

    setIsProcessingPhoto(true);

    try {
      const optimizedFile = await optimizePetImageForUpload(file);
      const previewUrl = await readPetImagePreviewUrl(optimizedFile);

      setPhotoPreview(previewUrl);
      setPhotoFile(optimizedFile);
      setErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors.photo;
        return nextErrors;
      });
    } catch {
      setErrors((prev) => ({ ...prev, photo: PET_IMAGE_PROCESSING_ERROR }));
    } finally {
      e.target.value = '';
      setIsProcessingPhoto(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.clientId) {
      newErrors.clientId = 'Selecciona un cliente';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre de la mascota es obligatorio';
    } else if (!isPetTextOnly(formData.name)) {
      newErrors.name = 'El nombre solo puede contener letras';
    }

    if (!formData.species) {
      newErrors.species = 'La especie es obligatoria';
    }

    if (formData.breed.trim() && !isPetTextOnly(formData.breed)) {
      newErrors.breed = 'La raza solo puede contener letras';
    }

    if (
      formData.microchipNumber.trim() &&
      !isValidPetMicrochipNumber(formData.microchipNumber)
    ) {
      newErrors.microchipNumber = 'El número de microchip debe tener 15 números';
    }

    if (!formData.sex) {
      newErrors.sex = 'Selecciona el sexo';
    }

    if (!formData.neutered) {
      newErrors.neutered = 'Indica si está esterilizado';
    }

    if (formData.weight) {
      const weightError = getPetWeightValidationError(formData.weight);

      if (weightError) {
        newErrors.weight = weightError;
      }
    }

    if (formData.birthDate) {
      const birthDateError = getPetBirthDateValidationError(formData.birthDate);

      if (birthDateError) {
        newErrors.birthDate = birthDateError;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.SyntheticEvent, createReservation = false) => {
    e.preventDefault();

    if (isProcessingPhoto) {
      setErrors((prev) => ({ ...prev, photo: PET_IMAGE_PROCESSING_PENDING_ERROR }));
      return;
    }

    if (!validateForm() || !activeSelectedClient?.id) {
      return;
    }

    setIsSubmitting(true);
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.submit;
      return newErrors;
    });

    const petInput: PetCreateInput = {
      ownerId: activeSelectedClient.id,
      name: formData.name.trim(),
      species: formData.species === 'Gato' ? 'Gato' : 'Perro',
      breed: formData.breed.trim(),
      microchipNumber: formData.microchipNumber.trim(),
      birthDate: formData.birthDate,
      weight: formData.weight.trim(),
      sex:
        formData.sex === 'Macho' || formData.sex === 'Hembra'
          ? formData.sex
          : '',
      neutered: formData.neutered === 'No' ? 'No' : 'Sí',
      observations: formData.observations.trim(),
    };

    try {
      const createdPetId = await createPetRequest(petInput, {
        photoFile,
      });
      let createdPetFromList: EditablePet | undefined;

      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: PETS_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY }),
          queryClient.invalidateQueries({
            queryKey: ['client-detail', String(activeSelectedClient.id)],
          }),
          queryClient.invalidateQueries({
            queryKey: RESERVATION_FORM_CLIENT_PETS_QUERY_KEY,
          }),
          queryClient.invalidateQueries({
            queryKey: RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY,
          }),
        ]);

        const refreshedPets = await queryClient.fetchQuery({
          queryKey: PETS_QUERY_KEY,
          queryFn: fetchPetsPageData,
        });

        createdPetFromList = findCreatedPetInList(refreshedPets, petInput);
      } catch {
        createdPetFromList = undefined;
      }

      const resolvedPetId = createdPetFromList?.id ?? createdPetId;
      const createdPetSummary =
        resolvedPetId > 0
          ? {
              id: resolvedPetId,
              name: createdPetFromList?.name ?? petInput.name,
              species: createdPetFromList?.species ?? petInput.species,
              breed:
                createdPetFromList?.breed ||
                petInput.breed.trim() ||
                'Raza sin especificar',
              microchipNumber: petInput.microchipNumber,
              age: createdPetFromList?.age ?? calculateAgeFromBirthDate(petInput.birthDate),
              birthDate: petInput.birthDate,
              weight: Number.isFinite(Number(petInput.weight)) ? Number(petInput.weight) : 0,
              sex: petInput.sex,
              neutered: petInput.neutered === 'Sí' ? ('Si' as const) : ('No' as const),
              color: 'No especificado',
              observations: petInput.observations,
              photoUrl: createdPetFromList?.photoUrl || photoPreview || '',
              owner: activeSelectedClient.name,
              ownerId: activeSelectedClient.id,
              isHosted: createdPetFromList?.isHosted ?? false,
              room: createdPetFromList?.room ?? null,
              isLocalOnly: false,
            }
          : undefined;

      toast.success('Mascota registrada correctamente', {
        description: createReservation
          ? 'Ahora puedes crear una reserva.'
          : 'La mascota ya está disponible en el sistema.',
      });

      onSuccess?.(resolvedPetId > 0 ? String(resolvedPetId) : '', createdPetSummary);
      handleClose();

      if (createReservation) {
        const returnTo = location.pathname.startsWith('/clientes/')
          ? location.pathname
          : '/mascotas';
        const returnLabel = location.pathname.startsWith('/clientes/')
          ? 'Volver a cliente'
          : 'Volver a mascotas';
        const reservationSearchParams = new URLSearchParams({
          clienteId: String(activeSelectedClient.id),
          returnTo,
          returnLabel,
        });

        if (resolvedPetId > 0) {
          reservationSearchParams.set('mascotaId', String(resolvedPetId));
        }

        navigate(`/reservas/nueva?${reservationSearchParams.toString()}`);
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'No se pudo crear la mascota';
      const mappedFieldError = mapPetSubmitErrorToField(message);

      setErrors((prev) => ({
        ...prev,
        ...(mappedFieldError
          ? { [mappedFieldError.field]: mappedFieldError.message }
          : { submit: message }),
      }));
      toast.error('No se pudo crear la mascota', {
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData(getInitialFormData(preselectedClientId));
    setSelectedClient(null);
    setClientSearchTerm('');
    setPhotoPreview(null);
    setPhotoFile(null);
    setErrors({});
    setIsSubmitting(false);
    setIsProcessingPhoto(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-gray-900 text-xl mb-1">Registrar nueva mascota</h3>
              <p className="text-sm text-gray-600">
                Añade una nueva mascota al sistema y asígnala a un cliente
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Formulario */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form onSubmit={(e) => handleSubmit(e, false)}>
            {/* Bloque 1: Cliente asociado */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Cliente asociado
              </h4>

              {activeSelectedClient ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-900 mb-1">{activeSelectedClient.name}</p>
                      <p className="text-sm text-gray-600 mb-0.5">{activeSelectedClient.email}</p>
                      <p className="text-sm text-gray-600">{activeSelectedClient.phone}</p>
                    </div>
                    {!preselectedClientId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedClient(null);
                          setFormData((prev) => ({ ...prev, clientId: null }));
                        }}
                        className="text-gray-600"
                      >
                        Cambiar
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Buscar cliente por nombre, teléfono o email"
                    value={clientSearchTerm}
                    onChange={(e) => {
                      setClientSearchTerm(e.target.value);
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    className={errors.clientId ? 'border-red-500' : ''}
                  />
                  {showClientDropdown && clientSearchTerm && filteredClients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => handleClientSelect(client)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <p className="text-gray-900 text-sm mb-0.5">{client.name}</p>
                          <p className="text-xs text-gray-600">
                            {client.email} · {client.phone}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  {errors.clientId && (
                    <p className="text-sm text-red-600 mt-1">{errors.clientId}</p>
                  )}
                </div>
              )}
            </div>

            {/* Bloque 2: Información básica de la mascota */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-green-600" />
                Información básica de la mascota
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nombre de la mascota <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej. Max"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
                </div>

                {/* Especie */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Especie <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.species}
                    onValueChange={(value) => handleChange('species', value)}
                  >
                    <SelectTrigger className={errors.species ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Selecciona la especie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Perro">
                        <div className="flex items-center gap-2">
                          <Dog className="w-4 h-4" />
                          Perro
                        </div>
                      </SelectItem>
                      <SelectItem value="Gato">
                        <div className="flex items-center gap-2">
                          <Cat className="w-4 h-4" />
                          Gato
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.species && <p className="text-sm text-red-600 mt-1">{errors.species}</p>}
                </div>

                {/* Raza */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Raza (opcional)
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej. Labrador, Siamés, Mestizo"
                    value={formData.breed}
                    onChange={(e) => handleChange('breed', e.target.value)}
                    className={errors.breed ? 'border-red-500' : ''}
                  />
                  {errors.breed && <p className="text-sm text-red-600 mt-1">{errors.breed}</p>}
                </div>

                {/* Microchip */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Numero de microchip
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej. 981020000123456"
                    value={formData.microchipNumber}
                    onChange={(e) => handleChange('microchipNumber', e.target.value)}
                    inputMode="numeric"
                    maxLength={15}
                    className={errors.microchipNumber ? 'border-red-500' : ''}
                  />
                  {errors.microchipNumber && (
                    <p className="text-sm text-red-600 mt-1">{errors.microchipNumber}</p>
                  )}
                </div>

                {/* Fecha de nacimiento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Fecha de nacimiento
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => handleChange('birthDate', e.target.value)}
                      max={latestAllowedBirthDate}
                      className={`pl-10 ${errors.birthDate ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.birthDate && (
                    <p className="text-sm text-red-600 mt-1">{errors.birthDate}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Bloque 3: Características físicas */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Weight className="w-4 h-4 text-purple-600" />
                Características físicas
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Peso (kg)*/}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Peso (kg)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Ej. 12.5"
                    value={formData.weight}
                    onChange={(e) => handleChange('weight', e.target.value)}
                    min="0"
                    max={String(MAX_PET_WEIGHT_KG)}
                    className={errors.weight ? 'border-red-500' : ''}
                  />
                  {errors.weight && <p className="text-sm text-red-600 mt-1">{errors.weight}</p>}
                </div>

                {/* Sexo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Sexo <span className="text-red-500">*</span>
                  </label>
                  <Select value={formData.sex} onValueChange={(value) => handleChange('sex', value)}>
                    <SelectTrigger className={errors.sex ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Macho">Macho</SelectItem>
                      <SelectItem value="Hembra">Hembra</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.sex && <p className="text-sm text-red-600 mt-1">{errors.sex}</p>}
                </div>

                {/* Esterilizado */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Esterilizado <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.neutered}
                    onValueChange={(value) => handleChange('neutered', value)}
                  >
                    <SelectTrigger className={errors.neutered ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sí">Sí</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.neutered && (
                    <p className="text-sm text-red-600 mt-1">{errors.neutered}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Bloque 4: Información adicional */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Info className="w-4 h-4 text-orange-600" />
                Información adicional
              </h4>

              <div className="space-y-4">
                {/* Observaciones */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Observaciones
                  </label>
                  <Textarea
                    placeholder="Alergias, comportamiento, necesidades especiales, medicación, dieta específica..."
                    value={formData.observations}
                    onChange={(e) => handleChange('observations', e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ejemplo: "Le asustan los ruidos fuertes" o "Muy sociable con otros perros"
                  </p>
                </div>

                {/* Foto de la mascota */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Foto de la mascota
                  </label>
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    {/* Vista previa */}
                    <div className="w-full sm:w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-xs text-gray-500">Sin foto</p>
                        </div>
                      )}
                    </div>

                    {/* Botones de acción */}
                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={PET_IMAGE_INPUT_ACCEPT}
                        onChange={handlePhotoUpload}
                        className="hidden"
                        disabled={isSubmitting || isProcessingPhoto}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isSubmitting || isProcessingPhoto}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {isProcessingPhoto ? 'Procesando foto...' : 'Subir foto'}
                        </Button>
                        {photoPreview && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isSubmitting || isProcessingPhoto}
                            onClick={() => {
                              setPhotoPreview(null);
                              setPhotoFile(null);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            Eliminar
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Formatos admitidos: JPG, PNG. La imagen se reduce automáticamente si es demasiado grande.
                      </p>
                      {errors.photo && <p className="text-sm text-red-600 mt-1">{errors.photo}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mensaje contextual */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                La mascota quedará registrada en el sistema y podrás asociarle reservas, servicios y
                seguimiento diario durante su estancia.
              </p>
            </div>

            {errors.submit && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{errors.submit}</p>
              </div>
            )}
          </form>
        </div>

        {/* Footer con acciones */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting || isProcessingPhoto}
              className="sm:order-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={(e) => handleSubmit(e, true)}
              disabled={isSubmitting || isProcessingPhoto}
              className="bg-purple-600 hover:bg-purple-700 text-white sm:order-3"
            >
              {isSubmitting ? 'Guardando...' : isProcessingPhoto ? 'Procesando foto...' : 'Guardar y crear reserva'}
            </Button>
            <Button
              onClick={(e) => handleSubmit(e, false)}
              disabled={isSubmitting || isProcessingPhoto}
              className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white sm:order-2"
            >
              {isSubmitting ? 'Guardando...' : isProcessingPhoto ? 'Procesando foto...' : 'Guardar mascota'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
