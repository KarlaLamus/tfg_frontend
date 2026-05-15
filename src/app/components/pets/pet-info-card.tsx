import { Calendar, Scale, Scissors, FileText } from 'lucide-react';
import { Card } from '../ui/card';

interface Pet {
  name: string;
  species: string;
  breed: string;
  birthDate: string;
  weight: number;
  sex: string;
  neutered: boolean;
  color: string;
  observations?: string;
}

interface PetInfoCardProps {
  pet: Pet;
}

export function PetInfoCard({ pet }: PetInfoCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(pet.birthDate);

  return (
    <Card className="p-6 border-0 shadow-md">
      <h3 className="text-gray-900 mb-4">Información general</h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">Nombre</label>
          <p className="text-gray-900">{pet.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Especie</label>
            <p className="text-gray-900">{pet.species}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Raza</label>
            <p className="text-gray-900">{pet.breed}</p>
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Fecha de nacimiento
          </label>
          <p className="text-gray-900">
            {formatDate(pet.birthDate)} ({age} {age === 1 ? 'año' : 'años'})
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 flex items-center gap-2">
              <Scale className="w-4 h-4" />
              Peso (kg)
            </label>
            <p className="text-gray-900">{pet.weight} kg</p>
          </div>
          <div>
            <label className="text-sm text-gray-500 mb-1 block">Sexo</label>
            <p className="text-gray-900">{pet.sex}</p>
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <Scissors className="w-4 h-4" />
            Esterilizado
          </label>
          <p className="text-gray-900">{pet.neutered ? 'Sí' : 'No'}</p>
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-1 block">Color</label>
          <p className="text-gray-900">{pet.color}</p>
        </div>

        {pet.observations && (
          <div>
            <label className="text-sm text-gray-500 mb-1 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Observaciones
            </label>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
              {pet.observations}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
