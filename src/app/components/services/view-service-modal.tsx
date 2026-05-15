import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { ServiceStatusBadge } from './service-status-badge';
import type { EditableService } from './service-form-modal';

interface ViewServiceModalProps {
  isOpen: boolean;
  service: EditableService | null;
  onClose: () => void;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
};

export function ViewServiceModal({ isOpen, service, onClose }: ViewServiceModalProps) {
  if (!isOpen || !service) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-8">
            <span>{service.name}</span>
            <ServiceStatusBadge status={service.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-1 text-sm text-gray-500">ID Servicio</p>
            <p className="text-sm text-gray-900">S-{String(service.id).padStart(3, '0')}</p>
          </div>

          <div>
            <p className="mb-1 text-sm text-gray-500">Descripcion</p>
            <p className="text-sm leading-6 text-gray-900">{service.description}</p>
          </div>

          <div>
            <p className="mb-1 text-sm text-gray-500">Precio</p>
            <p className="text-sm font-medium text-gray-900">{formatPrice(service.price)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
