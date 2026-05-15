import { Heart, Pill, AlertTriangle, Stethoscope, Phone, Pencil } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

interface MedicalInfo {
  allergies?: string;
  medication?: string;
  specialNeeds?: string;
  vetName?: string;
  vetPhone?: string;
}

interface PetMedicalCardProps {
  medicalInfo: MedicalInfo | null;
  onEdit: () => void;
}

export function PetMedicalCard({ medicalInfo, onEdit }: PetMedicalCardProps) {
  const hasInfo = medicalInfo && Object.values(medicalInfo).some((value) => value);

  return (
    <Card className="p-6 border-0 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-900">Ficha médica</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="border-gray-200 hover:bg-gray-50"
        >
          <Pencil className="w-3.5 h-3.5 mr-2" />
          Editar
        </Button>
      </div>

      {hasInfo ? (
        <div className="space-y-4">
          {medicalInfo.allergies && (
            <div>
              <label className="text-sm text-gray-500 mb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Alergias
              </label>
              <p className="text-sm text-gray-900 bg-red-50 border border-red-200 p-3 rounded-lg">
                {medicalInfo.allergies}
              </p>
            </div>
          )}

          {medicalInfo.medication && (
            <div>
              <label className="text-sm text-gray-500 mb-1 flex items-center gap-2">
                <Pill className="w-4 h-4 text-blue-500" />
                Medicación habitual
              </label>
              <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">
                {medicalInfo.medication}
              </p>
            </div>
          )}

          {medicalInfo.specialNeeds && (
            <div>
              <label className="text-sm text-gray-500 mb-1 flex items-center gap-2">
                <Heart className="w-4 h-4 text-purple-500" />
                Necesidades especiales
              </label>
              <p className="text-sm text-gray-700 bg-purple-50 p-3 rounded-lg">
                {medicalInfo.specialNeeds}
              </p>
            </div>
          )}

          {(medicalInfo.vetName || medicalInfo.vetPhone) && (
            <div className="pt-3 border-t border-gray-100">
              <label className="text-sm text-gray-500 mb-2 flex items-center gap-2">
                <Stethoscope className="w-4 h-4" />
                Veterinario de contacto
              </label>
              <div className="space-y-2">
                {medicalInfo.vetName && (
                  <p className="text-sm text-gray-900">{medicalInfo.vetName}</p>
                )}
                {medicalInfo.vetPhone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-3.5 h-3.5" />
                    <a
                      href={`tel:${medicalInfo.vetPhone}`}
                      className="text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {medicalInfo.vetPhone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Heart className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600 mb-3">
            No hay información médica registrada
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            <Pencil className="w-3.5 h-3.5 mr-2" />
            Agregar información médica
          </Button>
        </div>
      )}
    </Card>
  );
}
