import { useEffect, useState } from 'react';
import { AlertTriangle, Heart, Phone, Pill, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

export interface EditablePetMedicalInfo {
  allergies: string;
  medication: string;
  specialNeeds: string;
  vetName: string;
  vetPhone: string;
}

interface EditPetMedicalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (medicalInfo: EditablePetMedicalInfo) => Promise<void> | void;
  medicalInfo: EditablePetMedicalInfo;
}

export function EditPetMedicalModal({
  isOpen,
  onClose,
  onSave,
  medicalInfo,
}: EditPetMedicalModalProps) {
  const [formData, setFormData] = useState<EditablePetMedicalInfo>(medicalInfo);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    setFormData(medicalInfo);
    setIsSubmitting(false);
    setSubmitError('');
  }, [medicalInfo, isOpen]);

  const handleChange = (field: keyof EditablePetMedicalInfo, value: string) => {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      await onSave({
        allergies: formData.allergies.trim(),
        medication: formData.medication.trim(),
        specialNeeds: formData.specialNeeds.trim(),
        vetName: formData.vetName.trim(),
        vetPhone: formData.vetPhone.trim(),
      });
      onClose();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : 'No se pudo actualizar la ficha médica';

      setSubmitError(message);
      toast.error('No se pudo actualizar la ficha médica', {
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl rounded-2xl border-0 p-0 shadow-2xl">
        <DialogHeader className="border-b border-gray-100 px-6 py-5 text-left">
          <DialogTitle className="text-gray-900">Editar ficha médica</DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Actualiza la información médica visible en la ficha de la mascota.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(100vh-14rem)] space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Alergias
            </label>
            <Textarea
              value={formData.allergies}
              onChange={(event) => handleChange('allergies', event.target.value)}
              rows={3}
              placeholder="Ej. Alergia al pollo"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Pill className="h-4 w-4 text-blue-500" />
              Medicación habitual
            </label>
            <Textarea
              value={formData.medication}
              onChange={(event) => handleChange('medication', event.target.value)}
              rows={3}
              placeholder="Ej. Antihistamínico una vez al día"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <Heart className="h-4 w-4 text-purple-500" />
              Necesidades especiales
            </label>
            <Textarea
              value={formData.specialNeeds}
              onChange={(event) => handleChange('specialNeeds', event.target.value)}
              rows={3}
              placeholder="Ej. Dieta específica o cuidados especiales"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Stethoscope className="h-4 w-4 text-gray-500" />
                Veterinario
              </label>
              <Input
                value={formData.vetName}
                onChange={(event) => handleChange('vetName', event.target.value)}
                placeholder="Nombre de la clínica o veterinario"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Phone className="h-4 w-4 text-gray-500" />
                Teléfono del veterinario
              </label>
              <Input
                value={formData.vetPhone}
                onChange={(event) => handleChange('vetPhone', event.target.value)}
                placeholder="+34 600 000 000"
                disabled={isSubmitting}
              />
            </div>
          </div>
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        </div>

        <DialogFooter className="border-t border-gray-100 bg-gray-50 px-6 py-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-200 bg-white"
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
