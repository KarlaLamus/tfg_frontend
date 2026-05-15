import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
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

export interface EditableService {
  id: number;
  name: string;
  description: string;
  price: number;
  status: 'active' | 'inactive';
  isLocalOnly?: boolean;
}

interface ServiceFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  service?: EditableService | null;
  onClose: () => void;
  onSave: (service: EditableService) => Promise<void> | void;
}

export function ServiceFormModal({
  isOpen,
  mode,
  service,
  onClose,
  onSave,
}: ServiceFormModalProps) {
  const [formData, setFormData] = useState(() => ({
    name: service?.name ?? '',
    description: service?.description ?? '',
    price: service ? service.price.toString() : '',
    status: service?.status ?? ('active' as EditableService['status']),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors[field];
        return nextErrors;
      });
    }
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const parsedPrice = Number(formData.price);

    if (!formData.name.trim()) {
      nextErrors.name = 'El nombre es obligatorio';
    }

    if (!formData.price.trim()) {
      nextErrors.price = 'El precio es obligatorio';
    } else if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      nextErrors.price = 'Introduce un precio valido';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave({
        id: service?.id ?? 0,
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        status: formData.status,
        isLocalOnly: service?.isLocalOnly,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Nuevo servicio' : 'Editar servicio'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Nombre <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(event) => handleChange('name', event.target.value)}
                className={errors.name ? 'border-red-300' : ''}
                disabled={isSubmitting}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">Descripcion</label>
              <Textarea
                value={formData.description}
                onChange={(event) => handleChange('description', event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Precio <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(event) => handleChange('price', event.target.value)}
                className={errors.price ? 'border-red-300' : ''}
                disabled={isSubmitting}
              />
              {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Estado</label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  handleChange('status', value as EditableService['status'])
                }
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-gray-200 bg-white hover:bg-gray-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
            >
              {mode === 'create' ? 'Crear servicio' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
