import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../ui/button';

interface DeleteClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clientName: string;
  isDeleting?: boolean;
}

export function DeleteClientModal({
  isOpen,
  onClose,
  onConfirm,
  clientName,
  isDeleting = false,
}: DeleteClientModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-gray-900">Eliminar cliente</h3>
              <p className="text-sm text-gray-600 mt-0.5">Esta acción no se puede deshacer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6">
          <p className="text-gray-700 mb-4">
            ¿Estás seguro de que quieres eliminar a{' '}
            <span className="font-semibold text-gray-900">{clientName}</span>?
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Atención:</strong> Al eliminar este cliente también se eliminarán:
            </p>
            <ul className="text-sm text-amber-700 mt-2 ml-4 list-disc space-y-1">
              <li>Todas sus mascotas registradas</li>
              <li>Su historial de reservas</li>
              <li>Registros de pagos asociados</li>
              <li>Seguimientos y actividades</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 border-gray-200 hover:bg-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? 'Eliminando...' : 'Eliminar cliente'}
          </Button>
        </div>
      </div>
    </div>
  );
}
