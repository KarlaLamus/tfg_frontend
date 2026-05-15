import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { PaymentMethodBadge } from './payment-method-badge';
import { PaymentStatusBadge } from './payment-status-badge';
import type { PaymentRecord } from '../../utils/payments-api';

interface ViewPaymentModalProps {
  isOpen: boolean;
  payment: PaymentRecord | null;
  onClose: () => void;
}

const formatAmount = (amount: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);

const formatDate = (value: string) => {
  if (!value) {
    return 'No registrado';
  }

  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

export function ViewPaymentModal({ isOpen, payment, onClose }: ViewPaymentModalProps) {
  if (!isOpen || !payment) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-8">
            <span>{payment.id}</span>
            <PaymentStatusBadge status={payment.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-sm text-gray-500">Reserva</p>
              <p className="text-sm text-gray-900">{payment.reservationId}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-500">Cliente</p>
              <p className="text-sm text-gray-900">{payment.client}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-500">Fecha</p>
              <p className="text-sm text-gray-900">{formatDate(payment.date)}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-500">Método</p>
              <PaymentMethodBadge method={payment.method} size="sm" />
            </div>
          </div>

          <div className="grid gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-sm text-gray-500">Importe</p>
              <p className="font-medium text-gray-900">{formatAmount(payment.amount)}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-500">Descuento</p>
              <p className="font-medium text-gray-900">{formatAmount(payment.discount)}</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-500">Total final</p>
              <p className="font-medium text-gray-900">{formatAmount(payment.total)}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
