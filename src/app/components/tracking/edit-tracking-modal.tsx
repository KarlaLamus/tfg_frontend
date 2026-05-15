import { useEffect, useRef, useState } from 'react';
import { X, Calendar, Utensils, Pill, Heart, AlertTriangle, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/button';
import {
  isValidPetImageFile,
  PET_IMAGE_FORMAT_ERROR,
  PET_IMAGE_INPUT_ACCEPT,
  PET_IMAGE_PROCESSING_ERROR,
  PET_IMAGE_PROCESSING_PENDING_ERROR,
  optimizePetImageForUpload,
  readPetImagePreviewUrl,
} from '../../utils/pet-form';

interface EditTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (trackingData: EditTrackingFormData) => Promise<void> | void;
  trackingRecord: {
    id: string;
    date: string;
    createdAt: string;
    feeding: string;
    medication: string;
    behavior: string;
    incidents: string | null;
    photoUrl: string | null;
  } | null;
  petName: string;
}

export interface EditTrackingFormData {
  id: string;
  alimentacion: string;
  medicacionAdministrada: string;
  comportamiento: string;
  incidencias: string;
  fotoUrl: string;
  photoFile?: File | null;
}

export function EditTrackingModal({ isOpen, onClose, onSubmit, trackingRecord, petName }: EditTrackingModalProps) {
  const [alimentacion, setAlimentacion] = useState(() => trackingRecord?.feeding ?? '');
  const [medicacion, setMedicacion] = useState(() => trackingRecord?.medication ?? '');
  const [comportamiento, setComportamiento] = useState(() => trackingRecord?.behavior ?? '');
  const [incidencias, setIncidencias] = useState(() => trackingRecord?.incidents ?? '');
  const [fotoUrl, setFotoUrl] = useState(() => trackingRecord?.photoUrl ?? '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAlimentacion(trackingRecord?.feeding ?? '');
    setMedicacion(trackingRecord?.medication ?? '');
    setComportamiento(trackingRecord?.behavior ?? '');
    setIncidencias(trackingRecord?.incidents ?? '');
    setFotoUrl(trackingRecord?.photoUrl ?? '');
    setPhotoFile(null);
    setIsProcessingPhoto(false);
    setErrors({});

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [trackingRecord, isOpen]);

  if (!isOpen || !trackingRecord) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!alimentacion.trim()) {
      newErrors.alimentacion = 'La alimentación es obligatoria';
    }
    if (!comportamiento.trim()) {
      newErrors.comportamiento = 'El comportamiento es obligatorio';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    const trackingData: EditTrackingFormData = {
      id: trackingRecord.id,
      alimentacion: alimentacion.trim(),
      medicacionAdministrada: medicacion.trim() || 'No se ha administrado medicación',
      comportamiento: comportamiento.trim(),
      incidencias: incidencias.trim(),
      fotoUrl: fotoUrl.trim(),
      photoFile,
    };

    setIsSubmitting(true);

    try {
      await onSubmit(trackingData);
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setAlimentacion('');
    setMedicacion('');
    setComportamiento('');
    setIncidencias('');
    setFotoUrl('');
    setPhotoFile(null);
    setIsProcessingPhoto(false);
    setErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
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

      setFotoUrl(previewUrl);
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

  const handleRemovePhoto = () => {
    setFotoUrl('');
    setPhotoFile(null);
    setErrors((previousErrors) => {
      const nextErrors = { ...previousErrors };
      delete nextErrors.photo;
      return nextErrors;
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-gray-900 text-xl mb-1">Editar seguimiento de {petName}</h3>
              <p className="text-sm text-gray-600">
                Modificar registro {trackingRecord.id} del{' '}
                {new Date(trackingRecord.date).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form onSubmit={handleSubmit} className="space-y-5" id="edit-tracking-form">
            {/* Fecha original (solo lectura) */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-xs text-gray-600">Fecha del seguimiento (no modificable)</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(trackingRecord.createdAt).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}{' '}
                  a las{' '}
                  {new Date(trackingRecord.createdAt).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            {/* Bloque 1: Alimentación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-blue-600" />
                Alimentación <span className="text-red-500">*</span>
              </label>
              <textarea
                value={alimentacion}
                onChange={(e) => {
                  setAlimentacion(e.target.value);
                  if (errors.alimentacion) {
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.alimentacion;
                      return newErrors;
                    });
                  }
                }}
                rows={3}
                placeholder="Ej: Ha comido toda la ración de pienso y ha bebido agua con normalidad."
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                  errors.alimentacion ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.alimentacion && (
                <p className="text-sm text-red-500 mt-1">{errors.alimentacion}</p>
              )}
            </div>

            {/* Bloque 2: Medicación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <Pill className="w-4 h-4 text-purple-600" />
                Medicación administrada
              </label>
              <textarea
                value={medicacion}
                onChange={(e) => setMedicacion(e.target.value)}
                rows={2}
                placeholder="Ej: Antihistamínico administrado a las 09:00 según prescripción."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Si no hay medicación, déjalo vacío o escribe "No se ha administrado medicación"
              </p>
            </div>

            {/* Bloque 3: Comportamiento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <Heart className="w-4 h-4 text-pink-600" />
                Comportamiento <span className="text-red-500">*</span>
              </label>
              <textarea
                value={comportamiento}
                onChange={(e) => {
                  setComportamiento(e.target.value);
                  if (errors.comportamiento) {
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.comportamiento;
                      return newErrors;
                    });
                  }
                }}
                rows={3}
                placeholder="Ej: Muy activa y sociable. Disfruta del tiempo de juego con otros perros."
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                  errors.comportamiento ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.comportamiento && (
                <p className="text-sm text-red-500 mt-1">{errors.comportamiento}</p>
              )}
            </div>

            {/* Bloque 4: Incidencias */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Incidencias
              </label>
              <textarea
                value={incidencias}
                onChange={(e) => setIncidencias(e.target.value)}
                rows={2}
                placeholder="Ej: Leve episodio de ansiedad al separarse del grupo después del paseo."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Solo si hay algo destacable o preocupante
              </p>
            </div>

            {/* Bloque 5: Foto (opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-green-600" />
                Foto
              </label>
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
                  {fotoUrl ? (
                    <img
                      src={fotoUrl}
                      alt={`Foto de ${petName}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-gray-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
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
                    {fotoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemovePhoto}
                        disabled={isSubmitting || isProcessingPhoto}
                        className="border-gray-200 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    PNG o JPG. La imagen se reduce automáticamente si es demasiado grande.
                  </p>
                  {errors.photo && <p className="mt-1 text-sm text-red-600">{errors.photo}</p>}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Opcional: foto de {petName} durante su estancia
              </p>
            </div>
          </form>
        </div>

        {/* Footer con botones */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              disabled={isSubmitting || isProcessingPhoto}
              className="flex-1 sm:flex-initial"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="edit-tracking-form"
              disabled={isSubmitting || isProcessingPhoto}
              className="flex-1 sm:flex-initial bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
            >
              {isSubmitting
                ? 'Guardando...'
                : isProcessingPhoto
                  ? 'Procesando foto...'
                  : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
