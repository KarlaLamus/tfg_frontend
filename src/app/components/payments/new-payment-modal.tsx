import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';

interface NewPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (paymentData: PaymentFormData) => void;
  reservationOptions?: PaymentReservationOption[];
  initialValues?: Partial<PaymentFormData>;
  mode?: 'create' | 'edit';
}

export interface PaymentFormData {
  reservationId: string;
  client: string;
  amount: number;
  discount: number;
  method: 'card' | 'cash' | 'transfer' | 'other';
}

export interface PaymentReservationOption {
  id: string;
  client: string;
  amount: number;
  discount: number;
}

const getInitialFormValues = (initialValues?: Partial<PaymentFormData>) => ({
  reservationId: initialValues?.reservationId ?? '',
  client: initialValues?.client ?? '',
  amount:
    typeof initialValues?.amount === 'number' && Number.isFinite(initialValues.amount)
      ? initialValues.amount.toString()
      : '',
  discount:
    typeof initialValues?.discount === 'number' && Number.isFinite(initialValues.discount)
      ? initialValues.discount.toString()
      : '0',
  method: initialValues?.method ?? ('card' as const),
});

export function NewPaymentModal({
  isOpen,
  onClose,
  onSubmit,
  reservationOptions = [],
  initialValues,
  mode = 'create',
}: NewPaymentModalProps) {
  const initialFormValues = useMemo(() => getInitialFormValues(initialValues), [initialValues]);
  const [reservationId, setReservationId] = useState(initialFormValues.reservationId);
  const [client, setClient] = useState(initialFormValues.client);
  const [amount, setAmount] = useState(initialFormValues.amount);
  const [discount, setDiscount] = useState(initialFormValues.discount);
  const [method, setMethod] = useState<'card' | 'cash' | 'transfer' | 'other'>(
    initialFormValues.method
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mergedReservationOptions = useMemo(() => {
    const normalizedOptions = reservationOptions.map((option) => ({
      ...option,
      discount: Number(option.discount ?? 0),
    }));
    const prefilledReservationId = initialValues?.reservationId;

    if (
      !prefilledReservationId ||
      mode !== 'edit' ||
      normalizedOptions.some((option) => option.id === prefilledReservationId)
    ) {
      return normalizedOptions;
    }

    return [
      {
        id: prefilledReservationId,
        client: initialValues?.client ?? '',
        amount: initialValues?.amount ?? 0,
        discount: initialValues?.discount ?? 0,
      },
      ...normalizedOptions,
    ];
  }, [initialValues, mode, reservationOptions]);

  const handleReservationChange = (value: string) => {
    setReservationId(value);

    const reservation = mergedReservationOptions.find((item) => item.id === value);
    if (!reservation) {
      setClient('');
      setAmount('');
      setDiscount('0');
      return;
    }

    setClient(reservation.client);
    setAmount(reservation.amount.toString());
    setDiscount(reservation.discount.toString());
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!reservationId) {
      newErrors.reservationId = 'Debes seleccionar una reserva';
    }
    if (!client.trim()) {
      newErrors.client = 'El cliente es obligatorio';
    }
    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'El importe debe ser mayor a 0';
    }
    if (parseFloat(discount) < 0) {
      newErrors.discount = 'El descuento no puede ser negativo';
    }
    if (parseFloat(discount) > parseFloat(amount)) {
      newErrors.discount = 'El descuento no puede ser mayor al importe total';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const paymentData: PaymentFormData = {
      reservationId,
      client: client.trim(),
      amount: parseFloat(amount),
      discount: parseFloat(discount),
      method,
    };

    onSubmit(paymentData);
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  const netAmount = parseFloat(amount || '0') - parseFloat(discount || '0');
  const isEditing = mode === 'edit';
  const title = isEditing ? 'Editar pago' : 'Registrar nuevo pago';
  const description = isEditing
    ? 'Ajusta el método de pago sin alterar los importes de la reserva.'
    : 'Selecciona la reserva y registra el pago con los importes calculados.';
  const submitLabel = isEditing ? 'Guardar cambios' : 'Registrar pago';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-gray-900 text-xl mb-1">{title}</h3>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form onSubmit={handleSubmit} className="space-y-5" id="payment-form">
            {/* Reserva */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Reserva <span className="text-red-500">*</span>
              </label>
              <select
                value={reservationId}
                onChange={(e) => handleReservationChange(e.target.value)}
                disabled={isEditing}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.reservationId ? 'border-red-500' : 'border-gray-300'
                } ${isEditing ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
              >
                <option value="">Selecciona una reserva</option>
                {mergedReservationOptions.map((res) => (
                  <option key={res.id} value={res.id}>
                    {res.id} - {res.client} ({res.amount.toFixed(2)} €)
                  </option>
                ))}
              </select>
              {errors.reservationId && (
                <p className="text-sm text-red-500 mt-1">{errors.reservationId}</p>
              )}
            </div>

            {/* Cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Cliente <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={client}
                placeholder="Nombre del cliente"
                readOnly
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.client ? 'border-red-500' : 'border-gray-300'
                } bg-gray-50 text-gray-500 cursor-not-allowed`}
              />
              {errors.client && (
                <p className="text-sm text-red-500 mt-1">{errors.client}</p>
              )}
            </div>

            {/* Grid de 2 columnas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Importe */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Importe total <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    placeholder="0.00"
                    readOnly
                    className={`w-full px-3 py-2 pr-8 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.amount ? 'border-red-500' : 'border-gray-300'
                    } bg-gray-50 text-gray-500 cursor-not-allowed`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    €
                  </span>
                </div>
                {errors.amount && (
                  <p className="text-sm text-red-500 mt-1">{errors.amount}</p>
                )}
              </div>

              {/* Descuento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Descuento
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount}
                    placeholder="0.00"
                    readOnly
                    className={`w-full px-3 py-2 pr-8 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.discount ? 'border-red-500' : 'border-gray-300'
                    } bg-gray-50 text-gray-500 cursor-not-allowed`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    €
                  </span>
                </div>
                {errors.discount && (
                  <p className="text-sm text-red-500 mt-1">{errors.discount}</p>
                )}
              </div>
            </div>

            {/* importe neto */}
            {amount && parseFloat(amount) > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  Importe neto:{' '}
                  <span className="font-bold">{netAmount.toFixed(2)} €</span>
                </p>
              </div>
            )}

            {/* Método de pago */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Método de pago <span className="text-red-500">*</span>
              </label>
              <select
                value={method}
                onChange={(e) =>
                  setMethod(e.target.value as 'card' | 'cash' | 'transfer' | 'other')
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="card">Tarjeta</option>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="other">Otro</option>
              </select>
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
              className="flex-1 sm:flex-initial"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="payment-form"
              className="flex-1 sm:flex-initial bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
