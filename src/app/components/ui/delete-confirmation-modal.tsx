import { AlertTriangle } from 'lucide-react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  entityLabel?: string;
  itemName?: string;
  question?: string;
  confirmLabel?: string;
  description?: string;
  warningTitle?: string;
  warningItems?: string[];
  isDeleting?: boolean;
  confirmDisabled?: boolean;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  entityLabel = 'elemento',
  itemName,
  question,
  confirmLabel,
  description = 'Esta acción no se puede deshacer.',
  warningTitle,
  warningItems = [],
  isDeleting = false,
  confirmDisabled = false,
}: DeleteConfirmationModalProps) {
  const resolvedConfirmLabel = confirmLabel ?? `Eliminar ${entityLabel}`;
  const defaultQuestion = question ?? (itemName
    ? `¿Seguro que quieres eliminar ${itemName}?`
    : `¿Seguro que quieres eliminar este ${entityLabel}?`);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-md overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
        <DialogHeader className="border-b border-gray-100 px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-gray-900">{title}</DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-6 text-gray-700">{defaultQuestion}</p>

          {(warningTitle || warningItems.length > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              {warningTitle && (
                <p className="text-sm font-medium text-amber-900">{warningTitle}</p>
              )}
              {warningItems.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                  {warningItems.map((warningItem) => (
                    <li key={warningItem}>{warningItem}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-gray-100 bg-gray-50 px-6 py-4 sm:justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="border-gray-200 bg-white hover:bg-gray-50"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isDeleting || confirmDisabled}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {isDeleting ? 'Eliminando...' : resolvedConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
