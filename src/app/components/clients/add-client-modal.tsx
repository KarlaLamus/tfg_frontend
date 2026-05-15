import { useState } from 'react';
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
  BACKEND_CRUD_SUPPORT,
  BACKEND_WRITE_LIMITATIONS,
} from '../../utils/backend-capabilities';
import {
  buildClientPhoneValue,
  DEFAULT_CLIENT_COUNTRY_CODE,
  isClientTextOnly,
  normalizeClientCountryCode,
  normalizeClientPhoneNumber,
} from '../../utils/client-form';

// Props del modal:
// `isOpen` decide si el modal se muestra o no.
// `onClose` permite avisar al padre de que debe cerrarlo.
// `onSuccess` notifica al padre que el cliente se ha guardado
// y si el siguiente paso será crear una mascota.
interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (client: ClientUpsertInput) => Promise<AddedClientSummary>;
  onSuccess?: (client: AddedClientSummary, shouldAddPet: boolean) => void;
}

export interface AddedClientSummary {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  observations: string;
  petsCount: number;
  reservationsCount: number;
  registeredAt: string;
  isLocalOnly?: boolean;
}

// Estructura del formulario.
// Incluye datos básicos, dirección y un campo opcional de observaciones internas.
// Este modal se centra únicamente en registrar información de la ficha del cliente.
type AddClientFormData = ClientUpsertInput;

// Estado inicial reutilizable.
// Lo definimos fuera del componente para no recrearlo en cada render
// y para poder reutilizarlo al resetear el formulario.
const initialFormData: AddClientFormData = {
  name: '',
  email: '',
  phone: '',
  address: '',
  postalCode: '',
  city: '',
  observations: '',
};

// Tipo auxiliar para saber qué acción está ejecutando el usuario.
// Sirve para mostrar el texto correcto en cada botón mientras se guarda.
type SubmitAction = 'save' | 'saveAndAddPet' | null;

const normalizeComparableText = (value: string) => value.trim().toLowerCase();

export function AddClientModal({
  isOpen,
  onClose,
  onSubmit,
  onSuccess,
}: AddClientModalProps) {
  const queryClient = useQueryClient();
  // Estado principal del formulario.
  // Guarda todos los valores introducidos por el usuario.
  const [formData, setFormData] = useState<AddClientFormData>(initialFormData);
  const [countryCode, setCountryCode] = useState(DEFAULT_CLIENT_COUNTRY_CODE);
  const [phoneNumber, setPhoneNumber] = useState('');

  // Estado para errores de validación.
  // La clave coincide con el nombre del campo y el valor es el mensaje de error.
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Estado para bloquear el modal mientras se está guardando.
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para saber qué botón disparó el guardado.
  // Así podemos mostrar "Guardando..." solo en la acción correcta.
  const [submitAction, setSubmitAction] = useState<SubmitAction>(null);

  // Si el modal está cerrado, no renderizamos nada.
  // Esto evita pintar el overlay y todo su contenido innecesariamente.
  if (!isOpen) return null;

  // Resetea el formulario a su estado inicial.
  // Se usa tanto al cerrar como al terminar un guardado correcto.
  const resetForm = () => {
    setFormData(initialFormData);
    setCountryCode(DEFAULT_CLIENT_COUNTRY_CODE);
    setPhoneNumber('');
    setErrors({});
    setIsSubmitting(false);
    setSubmitAction(null);
  };

  const clearFieldError = (field: keyof AddClientFormData | 'submit') => {
    if (!errors[field]) {
      return;
    }

    setErrors((previousErrors) => {
      const nextErrors = { ...previousErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  // Actualiza un único campo del formulario.
  // También elimina el error de ese campo cuando el usuario empieza a corregirlo.
  const handleChange = (field: keyof AddClientFormData, value: string) => {
    setFormData((previousData) => ({
      ...previousData,
      [field]: value,
    }));
    clearFieldError(field);
  };

  const handleCountryCodeChange = (value: string) => {
    const nextCountryCode = normalizeClientCountryCode(value);
    setCountryCode(nextCountryCode);
    setFormData((previousData) => ({
      ...previousData,
      phone: buildClientPhoneValue(nextCountryCode, phoneNumber),
    }));
    clearFieldError('phone');
  };

  const handlePhoneNumberChange = (value: string) => {
    const nextPhoneNumber = normalizeClientPhoneNumber(value);
    setPhoneNumber(nextPhoneNumber);
    setFormData((previousData) => ({
      ...previousData,
      phone: buildClientPhoneValue(countryCode, nextPhoneNumber),
    }));
    clearFieldError('phone');
  };

  // Valida el formulario completo.
  // Devuelve `true` si todo está correcto y `false` si hay errores.
  // Además actualiza el estado `errors` para reflejar los mensajes en pantalla.
  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const existingClients =
      queryClient.getQueryData<ClientListRecord[]>(CLIENTS_QUERY_KEY) ?? [];
    const normalizedEmail = normalizeComparableText(formData.email);

    // El nombre es obligatorio porque identifica al cliente en toda la aplicación.
    if (!formData.name.trim()) {
      nextErrors.name = 'El nombre es obligatorio';
    } else if (!isClientTextOnly(formData.name)) {
      nextErrors.name = 'El nombre solo puede contener letras';
    }

    // El email es obligatorio y además debe tener formato válido.
    if (!formData.email.trim()) {
      nextErrors.email = 'El correo electrónico es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nextErrors.email = 'Introduce un email válido';
    } else if (
      existingClients.some(
        (client) => normalizeComparableText(client.email) === normalizedEmail
      )
    ) {
      nextErrors.email = 'Ya existe un cliente con ese correo electrónico';
    }

    // El teléfono es obligatorio y solo permitimos dígitos, espacios
    // y algunos símbolos habituales de teléfonos internacionales.
    if (!phoneNumber.trim()) {
      nextErrors.phone = 'El teléfono es obligatorio';
    } else if (!countryCode.trim()) {
      nextErrors.phone = 'El prefijo es obligatorio';
    } else if (phoneNumber.length !== 9) {
      nextErrors.phone = 'El teléfono debe tener 9 números';
    }

    // La dirección es obligatoria para tener una ficha de cliente completa.
    if (!formData.address.trim()) {
      nextErrors.address = 'La dirección es obligatoria';
    }

    // El código postal es obligatorio y debe tener 4 o 5 dígitos.
    if (!formData.postalCode.trim()) {
      nextErrors.postalCode = 'El código postal es obligatorio';
    } else if (!/^\d{4,5}$/.test(formData.postalCode)) {
      nextErrors.postalCode = 'Introduce un código postal válido';
    }

    // La ciudad también es obligatoria.
    if (!formData.city.trim()) {
      nextErrors.city = 'La ciudad es obligatoria';
    } else if (!isClientTextOnly(formData.city)) {
      nextErrors.city = 'La ciudad solo puede contener letras';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Ejecuta el guardado del cliente.
  // `shouldAddPet` nos dice si después del guardado se abrirá el flujo
  // para registrar una mascota justo a continuación.
  const submitClient = async (shouldAddPet: boolean) => {
    // Antes de guardar, validamos todo el formulario.
    if (!validateForm()) {
      return;
    }

    // Marcamos la UI como "ocupada" para deshabilitar acciones duplicadas.
    setIsSubmitting(true);
    setSubmitAction(shouldAddPet ? 'saveAndAddPet' : 'save');

    try {
      const continueToPet = shouldAddPet && BACKEND_CRUD_SUPPORT.pets.create;
      const createdClient = await onSubmit({
        ...formData,
        phone: buildClientPhoneValue(countryCode, phoneNumber),
      });

      toast.success('Cliente registrado correctamente', {
        description: continueToPet
          ? 'Ahora puedes añadirle una mascota.'
          : 'El cliente ya está disponible en el sistema.',
      });

      // Avisamos al componente padre para que refresque datos
      // o abra el siguiente flujo si hace falta.
      onSuccess?.(createdClient, continueToPet);

      // Reset y cierre del modal tras guardado correcto.
      resetForm();
      onClose();
    } catch (error) {
      // Manejo defensivo por si falla la operación real en el futuro.
      console.error('Error al guardar el cliente:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'No se pudo guardar el cliente';
      toast.error('No se pudo guardar el cliente', {
        description: errorMessage,
      });
      setErrors((currentErrors) => ({
        ...currentErrors,
        submit: errorMessage,
      }));
      setIsSubmitting(false);
      setSubmitAction(null);
    }
  };

  // Si el usuario pulsa Enter dentro del formulario,
  // tomamos como acción por defecto "Guardar cliente".
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submitClient(false);
  };

  // Cierra el modal manualmente.
  // Si se está guardando, evitamos cerrar para no dejar la UI en un estado ambiguo.
  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    resetForm();
    onClose();
  };

  return (
    // Overlay que oscurece el fondo y centra el modal en pantalla.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* Contenedor principal del modal. */}
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Cabecera del modal con título, descripción y botón de cierre. */}
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="mb-1 text-xl text-gray-900">Añadir nuevo cliente</h3>
              <p className="text-sm text-gray-600">
                Registra un nuevo cliente en el sistema para asociarle mascotas y reservas.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              aria-label="Cerrar modal"
              className="p-1 text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Zona scrollable del contenido. */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Formulario principal del cliente. */}
          <form id="add-client-form" onSubmit={handleFormSubmit}>
            {/* Bloque 1: datos básicos para identificar y contactar al cliente. */}
            <div className="mb-6">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-900">
                <User className="h-4 w-4 text-blue-600" />
                Datos personales
              </h4>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
	                {/* Campo nombre completo. */}
	                <div className="md:col-span-2">
	                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
	                    Nombre completo <span className="text-red-500">*</span>
	                  </label>
	                  <Input
	                    type="text"
	                    placeholder="Ej. Marta García López"
	                    value={formData.name}
	                    onChange={(e) => handleChange('name', e.target.value)}
	                    className={errors.name ? 'border-red-500' : ''}
	                  />
	                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
	                </div>

                {/* Campo correo electrónico. */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Correo electrónico <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="email"
                      placeholder="Ej. marta@email.com"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>

	                {/* Campo teléfono. */}
	                <div>
	                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
	                    Teléfono <span className="text-red-500">*</span>
	                  </label>
	                  <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2">
	                    <div className="flex items-center rounded-md border border-gray-300 bg-white px-3">
	                      <span className="text-sm text-gray-500">+</span>
	                      <input
	                        type="text"
	                        inputMode="numeric"
	                        maxLength={4}
	                        placeholder="34"
	                        value={countryCode}
	                        onChange={(e) => handleCountryCodeChange(e.target.value)}
	                        className="w-full border-0 bg-transparent px-1 py-2 text-sm text-gray-900 outline-none"
	                      />
	                    </div>
	                    <div className="relative">
	                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
	                      <Input
	                        type="tel"
	                        inputMode="numeric"
	                        maxLength={9}
	                        placeholder="612345678"
	                        value={phoneNumber}
	                        onChange={(e) => handlePhoneNumberChange(e.target.value)}
	                        className={`pl-10 ${errors.phone ? 'border-red-500' : ''}`}
	                      />
	                    </div>
	                  </div>
	                  {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
	                </div>
              </div>
            </div>

            {/* Bloque 2: datos de dirección del cliente. */}
            <div className="mb-6">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-900">
                <MapPin className="h-4 w-4 text-green-600" />
                Datos de contacto y dirección
              </h4>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Campo dirección. */}
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Dirección <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Navigation className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Ej. Calle Mayor 15, 2ºB"
                      value={formData.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                      className={`pl-10 ${errors.address ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600">{errors.address}</p>
                  )}
                </div>

                {/* Campo código postal. */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Código postal <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="Ej. 28001"
                    value={formData.postalCode}
                    onChange={(e) => handleChange('postalCode', e.target.value)}
                    className={errors.postalCode ? 'border-red-500' : ''}
                  />
                  {errors.postalCode && (
                    <p className="mt-1 text-sm text-red-600">{errors.postalCode}</p>
                  )}
                </div>

                {/* Campo ciudad. */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Ciudad <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Ej. Madrid"
                      value={formData.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      className={`pl-10 ${errors.city ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
                </div>
              </div>
            </div>

            {/* Bloque 3: observaciones internas de la ficha del cliente. */}
            <div className="mb-6">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-900">
                <FileText className="h-4 w-4 text-amber-600" />
                Observaciones
              </h4>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Observaciones del cliente
                </label>
                <Textarea
                  placeholder="Ej. Prefiere contacto por email, alergias de sus mascotas, indicaciones especiales..."
                  value={formData.observations}
                  onChange={(e) => handleChange('observations', e.target.value)}
                  className="min-h-28"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Este campo es opcional y sirve para dejar notas internas visibles en la ficha.
                </p>
              </div>
            </div>

            {/* Mensaje contextual para guiar al usuario. */}
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-800">
                Registra primero al cliente para poder asociarle mascotas, reservas y pagos dentro
                del sistema.{' '}
                {!BACKEND_CRUD_SUPPORT.pets.create &&
                  'La API de mascotas está temporalmente en solo lectura para altas y ediciones.'}
              </p>
            </div>

            {errors.submit && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{errors.submit}</p>
              </div>
            )}
          </form>
        </div>

        {/* Pie del modal con acciones principales. */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            {/* Acción secundaria: cerrar sin guardar. */}
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="sm:order-1"
            >
              Cancelar
            </Button>

            {/* Acción alternativa: guardar y pasar al flujo de mascota. */}
            <Button
              type="button"
              onClick={() => void submitClient(true)}
              disabled={isSubmitting || !BACKEND_CRUD_SUPPORT.pets.create}
              title={
                !BACKEND_CRUD_SUPPORT.pets.create
                  ? BACKEND_WRITE_LIMITATIONS.pets
                  : undefined
              }
              className="bg-purple-600 text-white hover:bg-purple-700 sm:order-3"
            >
              {submitAction === 'saveAndAddPet' && isSubmitting
                ? 'Guardando...'
                : 'Guardar y añadir mascota'}
            </Button>

            {/* Acción principal: guardar cliente y cerrar. */}
            <Button
              type="submit"
              form="add-client-form"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600 sm:order-2"
            >
              {submitAction === 'save' && isSubmitting ? 'Guardando...' : 'Guardar cliente'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
