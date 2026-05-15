import { useState } from 'react';
import { Pencil, Trash2, Clock, User, AlertTriangle, Camera, X } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { ImageWithFallback } from '../noImg/ImageWithFallback';
import { DeleteConfirmationModal } from '../ui/delete-confirmation-modal';

interface Employee {
  id: number;
  name: string;
}

interface TrackingRecord {
  id: string;
  date: string;
  createdAt: string;
  employee: Employee;
  feeding: string;
  medication: string;
  behavior: string;
  incidents: string | null;
  photoUrl: string | null;
}

interface TrackingItemProps {
  record: TrackingRecord;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (record: TrackingRecord) => void;
  onDelete: (recordId: string) => void;
}

export function TrackingItem({ record, isFirst, onEdit, onDelete }: TrackingItemProps) {
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleEdit = () => {
    onEdit(record);
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    onDelete(record.id);
    setIsDeleteModalOpen(false);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const hasIncidents = record.incidents !== null && record.incidents.trim() !== '';

  return (
    <>
      <div className="relative">
        {/* Punto del timeline (solo desktop) */}
        <div
          className={`hidden lg:block absolute left-8 top-6 w-4 h-4 rounded-full border-2 ${
            hasIncidents
              ? 'bg-amber-500 border-amber-600'
              : isFirst
              ? 'bg-blue-500 border-blue-600'
              : 'bg-green-500 border-green-600'
          } transform -translate-x-1/2 z-10`}
        ></div>

        {/* Tarjeta de registro */}
        <Card
          className={`lg:ml-16 p-5 border-0 shadow-md ${
            hasIncidents ? 'bg-amber-50/30 border-l-4 border-l-amber-500' : ''
          }`}
        >
          {/* Header del registro */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h4 className="text-gray-900">{formatDate(record.date)}</h4>
                {hasIncidents && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs rounded-full border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Con incidencias
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {formatTime(record.createdAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  {record.employee.name}
                </span>
                <span className="text-xs text-gray-400">{record.id}</span>
              </div>
            </div>

            {/* Acciones - Desktop */}
            <div className="hidden sm:flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                title="Editar"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Contenido del seguimiento */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Alimentación */}
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-orange-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <h5 className="text-sm font-medium text-gray-700">Alimentación</h5>
                </div>
                <p className="text-sm text-gray-600">{record.feeding}</p>
              </div>

              {/* Medicación */}
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                      />
                    </svg>
                  </div>
                  <h5 className="text-sm font-medium text-gray-700">Medicación</h5>
                </div>
                <p className="text-sm text-gray-600">{record.medication}</p>
              </div>

              {/* Comportamiento */}
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h5 className="text-sm font-medium text-gray-700">Comportamiento</h5>
                </div>
                <p className="text-sm text-gray-600">{record.behavior}</p>
              </div>

              {/* Incidencias */}
              {hasIncidents ? (
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-amber-200 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                    </div>
                    <h5 className="text-sm font-medium text-amber-900">Incidencias</h5>
                  </div>
                  <p className="text-sm text-amber-800">{record.incidents}</p>
                </div>
              ) : (
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-green-200 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-green-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <h5 className="text-sm font-medium text-green-900">Incidencias</h5>
                  </div>
                  <p className="text-sm text-green-700">Ninguna incidencia reportada</p>
                </div>
              )}
            </div>

            {/* Foto */}
            {record.photoUrl && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(true)}
                  className="group relative inline-block rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-all"
                >
                  <ImageWithFallback
                    src={record.photoUrl}
                    alt="Foto del seguimiento"
                    className="w-32 h-32 object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Acciones móvil */}
          <div className="sm:hidden mt-4 pt-4 border-t border-gray-100 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="flex-1 text-gray-600 hover:bg-gray-50"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </Card>
      </div>

      {/* Modal de foto */}
      {showPhotoModal && record.photoUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setShowPhotoModal(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X className="w-8 h-8" />
            </button>
            <ImageWithFallback
              src={record.photoUrl}
              alt="Foto del seguimiento"
              className="max-w-full max-h-[90vh] rounded-lg"
            />
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Eliminar seguimiento"
        entityLabel="seguimiento"
        itemName={record.id}
      />
    </>
  );
}
