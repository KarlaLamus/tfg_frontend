import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, User, Mail, Phone, MapPin, Building2, Navigation, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  CLIENTS_QUERY_KEY,
  type ClientListRecord,
  type ClientUpsertInput,
} from '../../utils/clients-api';
import {
  buildClientPhoneValue,
  DEFAULT_CLIENT_COUNTRY_CODE,
  isClientTextOnly,
  parseClientPhoneValue,
  normalizeClientCountryCode,
  normalizeClientPhoneNumber,
} from '../../utils/client-form';

interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  address?: string;
  postalCode?: string;
  city?: string;
  observations?: string;
}

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (client: ClientUpsertInput) => Promise<Client>;
  client: Client;
}

const normalizeComparableText = (value: string) => value.trim().toLowerCase();

export function EditClientModal({ isOpen, onClose, onSubmit, client }: EditClientModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    postalCode: '',
    city: '',
    observations: '',
  });
  const [countryCode, setCountryCode] = useState(DEFAULT_CLIENT_COUNTRY_CODE);
  const [phoneNumber, setPhoneNumber] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos del cliente cuando se abre el modal
  useEffect(() => {
    if (isOpen && client) {
      const parsedPhone = parseClientPhoneValue(client.phone || '');
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: buildClientPhoneValue(parsedPhone.countryCode, parsedPhone.phoneNumber),
        address: client.address || '',
        postalCode: client.postalCode || '',
        city: client.city || '',
        observations: client.observations || '',
      });
      setCountryCode(parsedPhone.countryCode);
      setPhoneNumber(parsedPhone.phoneNumber);
      setErrors({});
    }
  }, [isOpen, client]);

  if (!isOpen) return null;

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCountryCodeChange = (value: string) => {
    const nextCountryCode = normalizeClientCountryCode(value);
    setCountryCode(nextCountryCode);
    setFormData((prev) => ({
      ...prev,
      phone: buildClientPhoneValue(nextCountryCode, phoneNumber),
    }));

    if (errors.phone) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.phone;
        return newErrors;
      });
    }
  };

  const handlePhoneNumberChange = (value: string) => {
    const nextPhoneNumber = normalizeClientPhoneNumber(value);
    setPhoneNumber(nextPhoneNumber);
    setFormData((prev) => ({
      ...prev,
      phone: buildClientPhoneValue(countryCode, nextPhoneNumber),
    }));

    if (errors.phone) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.phone;
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const existingClients =
      queryClient.getQueryData<ClientListRecord[]>(CLIENTS_QUERY_KEY) ?? [];
    const normalizedEmail = normalizeComparableText(formData.email);

    // Validar nombre
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es obligatorio';
    } else if (!isClientTextOnly(formData.name)) {
      newErrors.name = 'El nombre solo puede contener letras';
    }

    // Validar email
    if (!formData.email.trim()) {
      newErrors.email = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Formato de email inválido';
    } else if (
      existingClients.some(
        (existingClient) =>
          existingClient.id !== client.id &&
          normalizeComparableText(existingClient.email) === normalizedEmail
      )
    ) {
      newErrors.email = 'Ya existe otro cliente con ese correo electrónico';
    }

    // Validar teléfono
    if (!phoneNumber.trim()) {
      newErrors.phone = 'El teléfono es obligatorio';
    } else if (!countryCode.trim()) {
      newErrors.phone = 'El prefijo es obligatorio';
    } else if (phoneNumber.length !== 9) {
      newErrors.phone = 'El teléfono debe tener 9 números';
    }

    if (formData.city.trim() && !isClientTextOnly(formData.city)) {
      newErrors.city = 'La ciudad solo puede contener letras';
    }

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsSubmitting(true);

      const updatedClient = await onSubmit({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: buildClientPhoneValue(countryCode, phoneNumber),
        address: formData.address.trim(),
        postalCode: formData.postalCode.trim(),
        city: formData.city.trim(),
        observations: formData.observations.trim(),
      });

      toast.success('Cliente actualizado', {
        description: `${updatedClient.name} se ha editado correctamente.`,
      });

      // Cerrar modal
      onClose();
    } catch (error) {
      console.error('Error al actualizar cliente:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'No se pudo actualizar el cliente';
      setErrors({ submit: errorMessage });
      toast.error('No se pudo actualizar el cliente', {
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h3 className="text-gray-900">Editar cliente</h3>
            <p className="text-sm text-gray-600 mt-1">Actualiza la información del cliente</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
            {errors.submit && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{errors.submit}</p>
              </div>
            )}

            {/* Información personal */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4">Información personal</h4>
              <div className="space-y-4">
                {/* Nombre completo */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre completo *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Ej: Juan Pérez García"
                      className={`pl-10 ${errors.name ? 'border-red-300' : ''}`}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
                </div>

	                {/* Email y Teléfono */}
	                <div className="grid sm:grid-cols-2 gap-4">
	                  <div>
	                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
	                      Correo electrónico *
	                    </label>
	                    <div className="relative">
	                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
	                      <Input
	                        id="email"
	                        type="email"
	                        value={formData.email}
	                        onChange={(e) => handleChange('email', e.target.value)}
	                        placeholder="correo@ejemplo.com"
	                        className={`pl-10 ${errors.email ? 'border-red-300' : ''}`}
	                        disabled={isSubmitting}
	                      />
	                    </div>
	                    {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
	                  </div>

	                  <div>
	                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
	                      Teléfono *
	                    </label>
	                    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
	                      <div className="flex items-center rounded-md border border-gray-300 bg-white px-3">
	                        <span className="text-sm text-gray-500">+</span>
	                        <input
	                          type="text"
	                          inputMode="numeric"
	                          maxLength={4}
	                          value={countryCode}
	                          onChange={(e) => handleCountryCodeChange(e.target.value)}
	                          placeholder="34"
	                          className="w-full border-0 bg-transparent px-1 py-2 text-sm text-gray-900 outline-none"
	                          disabled={isSubmitting}
	                        />
	                      </div>
	                      <div className="relative">
	                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
	                        <Input
	                          id="phone"
	                          type="tel"
	                          inputMode="numeric"
	                          maxLength={9}
	                          value={phoneNumber}
	                          onChange={(e) => handlePhoneNumberChange(e.target.value)}
	                          placeholder="612345678"
	                          className={`pl-10 ${errors.phone ? 'border-red-300' : ''}`}
	                          disabled={isSubmitting}
	                        />
	                      </div>
	                    </div>
	                    {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone}</p>}
	                  </div>
	                </div>
              </div>
            </div>

            {/* Dirección */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4">Dirección (opcional)</h4>
              <div className="space-y-4">
                {/* Dirección completa */}
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                    Dirección
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="address"
                      type="text"
                      value={formData.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                      placeholder="Calle, número, piso..."
                      className="pl-10"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

	                {/* Código postal y Ciudad */}
	                <div className="grid sm:grid-cols-2 gap-4">
	                  <div>
	                    <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-2">
	                      Código postal
	                    </label>
	                    <div className="relative">
	                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
	                      <Input
	                        id="postalCode"
	                        type="text"
	                        value={formData.postalCode}
	                        onChange={(e) => handleChange('postalCode', e.target.value)}
	                        placeholder="28001"
	                        className="pl-10"
	                        disabled={isSubmitting}
	                      />
	                    </div>
	                  </div>

	                  <div>
	                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
	                      Ciudad
	                    </label>
	                    <div className="relative">
	                      <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
	                      <Input
	                        id="city"
	                        type="text"
	                        value={formData.city}
	                        onChange={(e) => handleChange('city', e.target.value)}
	                        placeholder="Madrid"
	                        className={`pl-10 ${errors.city ? 'border-red-300' : ''}`}
	                        disabled={isSubmitting}
	                      />
	                    </div>
	                    {errors.city && <p className="text-sm text-red-600 mt-1">{errors.city}</p>}
	                  </div>
	                </div>
	              </div>
	            </div>

            <div>
              <h4 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-900">
                <FileText className="h-4 w-4 text-amber-600" />
                Observaciones
              </h4>
              <div>
                <label htmlFor="observations" className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones del cliente
                </label>
                <Textarea
                  id="observations"
                  value={formData.observations}
                  onChange={(e) => handleChange('observations', e.target.value)}
                  placeholder="Notas internas, preferencias o información útil sobre este cliente"
                  className="min-h-28"
                  disabled={isSubmitting}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Este campo es opcional y se muestra en la ficha del cliente.
                </p>
              </div>
            </div>

            {/* Error general */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{errors.submit}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 border-gray-200 hover:bg-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
