import { Plus, Dog, Cat, Eye } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { ImageWithFallback } from '../noImg/ImageWithFallback';

interface Pet {
  id: number;
  name: string;
  species: string;
  breed: string;
  age: number;
  weight: number;
  color: string;
  photoUrl?: string;
  observations?: string;
  isLocalOnly?: boolean;
}

interface ClientPetsSectionProps {
  pets: Pet[];
  clientId: number;
  onCreatePet?: () => void;
}

export function ClientPetsSection({ pets, clientId, onCreatePet }: ClientPetsSectionProps) {
  const navigate = useNavigate();

  const handleNewPet = () => {
    onCreatePet?.();
  };

  const handleViewPet = (pet: Pet) => {
    if (pet.isLocalOnly) {
      toast.info('La ficha aún no está disponible', {
        description: 'Esta mascota todavía no se ha sincronizado con el backend.',
      });
      return;
    }

    navigate(`/mascotas/${pet.id}`, {
      state: {
        returnTo: `/clientes/${clientId}`,
        returnLabel: 'Volver a cliente',
      },
    });
  };

  return (
    <Card className="gap-0 border-0 shadow-md">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-gray-900">Mascotas del cliente</h3>
        <Button
          onClick={handleNewPet}
          size="sm"
          className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Registrar nueva mascota
        </Button>
      </div>

      <div className="p-4">
        {pets.length > 0 ? (
          <div className="grid gap-3">
            {pets.map((pet) => (
              <div
                key={pet.id}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:bg-white"
              >
                <div className="flex items-start gap-3">
                  {pet.photoUrl ? (
                    <ImageWithFallback
                      src={pet.photoUrl}
                      alt={`Foto de ${pet.name}`}
                      className="h-12 w-12 shrink-0 overflow-hidden rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                        pet.species === 'Perro'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-purple-100 text-purple-600'
                      }`}
                    >
                      {pet.species === 'Perro' ? (
                        <Dog className="w-6 h-6" />
                      ) : (
                        <Cat className="w-6 h-6" />
                      )}
                    </div>
                  )}

                  {/* Info de la mascota */}
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <h4 className="text-gray-900">{pet.name}</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewPet(pet)}
                        className="h-8 shrink-0 border-blue-200 px-3 text-xs text-blue-600 hover:bg-blue-50"
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Ver ficha
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {pet.breed} · {pet.age} {pet.age === 1 ? 'año' : 'años'} · {pet.weight} kg
                    </p>

                    <div className="space-y-1.5 text-sm mb-3">
                      <div className="flex items-start gap-2">
                        <span className="min-w-[52px] text-gray-500">Color:</span>
                        <span className="text-gray-700">{pet.color}</span>
                      </div>
                      {pet.observations && (
                        <div className="flex items-start gap-2">
                          <span className="min-w-[52px] text-gray-500">Notas:</span>
                          <span className="text-gray-700 text-xs leading-5">{pet.observations}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-sm mx-auto">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Dog className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Este cliente aún no tiene mascotas registradas
            </p>
            <Button
              onClick={handleNewPet}
              size="sm"
              className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Registrar primera mascota
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
