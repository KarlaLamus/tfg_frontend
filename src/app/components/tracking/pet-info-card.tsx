import { useNavigate } from 'react-router';
import {
  Dog,
  Cat,
  Calendar,
  DoorOpen,
  User,
  Phone,
  AlertTriangle,
  Syringe,
  Heart,
  Stethoscope,
} from 'lucide-react';
import { Card } from '../ui/card';
import { ImageWithFallback } from '../noImg/ImageWithFallback';
import { buildReturnNavigationState } from '../../utils/return-navigation';



interface Pet {
  id: number;
  name: string;
  species: string;
  breed: string;
  sex: string;
  neutered: boolean;
  photoUrl?: string;
  observations?: string;
  allergies?: string;
  medication?: string;
  specialNeeds?: string;
  vet?: string;
  vetPhone?: string;
}

interface Reservation {
  id: string;
  checkIn: string;
  checkOut: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  room: string;
}

interface Client {
  id: number;
  name: string;
  phone: string;
}

interface PetInfoCardProps {
  pet: Pet;
  reservation: Reservation;
  client: Client;
}

const statusConfig = {
  pending: { label: 'Pendiente', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed: { label: 'Confirmada', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: 'En curso', className: 'bg-green-50 text-green-700 border-green-200' },
  completed: { label: 'Finalizada', className: 'bg-gray-50 text-gray-700 border-gray-200' },
  cancelled: { label: 'Cancelada', className: 'bg-red-50 text-red-700 border-red-200' },
};

export function PetInfoCard({ pet, reservation, client }: PetInfoCardProps) {
  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const hasAlerts = pet.allergies || pet.medication || pet.specialNeeds;

  return (
    <Card className="p-6 border-0 shadow-md">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna 1: Información de la mascota */}
        <div>
          <h3 className="text-gray-900 mb-4 flex items-center gap-2">
            {pet.species === 'Perro' ? (
              <Dog className="w-5 h-5 text-blue-500" />
            ) : (
              <Cat className="w-5 h-5 text-purple-500" />
            )}
            Información de la mascota
          </h3>

          <div className="flex items-start gap-4">
            {/* Foto de la mascota */}
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-blue-100">
                {pet.photoUrl ? (
                  <ImageWithFallback
                    src={pet.photoUrl}
                    alt={pet.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {pet.species === 'Perro' ? (
                      <Dog className="w-10 h-10 text-gray-400" />
                    ) : (
                      <Cat className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Datos de la mascota */}
            <div className="flex-1 space-y-2">
              <button
                onClick={() =>
                  navigate(
                    `/mascotas/${pet.id}`,
                    {
                      state: buildReturnNavigationState('/seguimiento', 'Volver a seguimiento'),
                    }
                  )
                }
                className="text-lg font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {pet.name}
              </button>
              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Especie:</span> {pet.species}
                </p>
                <p>
                  <span className="font-medium">Raza:</span> {pet.breed}
                </p>
                <p>
                  <span className="font-medium">Sexo:</span> {pet.sex}
                </p>
                <p>
                  <span className="font-medium">Esterilizado:</span> {pet.neutered ? 'Sí' : 'No'}
                </p>
                {pet.observations && (
                  <p className="text-xs text-gray-500 italic mt-2">{pet.observations}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Columna 2: Información de la reserva y cliente */}
        <div>
          <h3 className="text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-500" />
            Estancia y cliente
          </h3>

          <div className="space-y-3">
            {/* Reserva */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Reserva:</span>
                <span className="font-medium text-gray-900">{reservation.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Estado:</span>
                <span
                  className={`inline-block px-2 py-0.5 text-xs rounded-full border ${
                    statusConfig[reservation.status].className
                  }`}
                >
                  {statusConfig[reservation.status].label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Entrada:</span>
                <span className="text-gray-900">{formatDate(reservation.checkIn)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Salida:</span>
                <span className="text-gray-900">{formatDate(reservation.checkOut)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 flex items-center gap-1">
                  <DoorOpen className="w-3.5 h-3.5" />
                  Sala:
                </span>
                <span className="text-gray-900">{reservation.room}</span>
              </div>
            </div>

            {/* Cliente */}
            <div className="bg-blue-50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-700 mb-1">
                <User className="w-4 h-4" />
                <span className="font-medium">Dueño</span>
              </div>
              <button
                onClick={() =>
                  navigate(
                    `/clientes/${client.id}`,
                    {
                      state: buildReturnNavigationState('/seguimiento', 'Volver a seguimiento'),
                    }
                  )
                }
                className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
              >
                {client.name}
              </button>
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-3.5 h-3.5" />
                <a href={`tel:${client.phone}`} className="hover:text-blue-600">
                  {client.phone}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Columna 3: Alertas médicas */}
        <div>
          <h3 className="text-gray-900 mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Información médica
          </h3>

          {hasAlerts ? (
            <div className="space-y-3">
              {pet.allergies && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-red-700 mb-1">Alergias</p>
                      <p className="text-sm text-red-900">{pet.allergies}</p>
                    </div>
                  </div>
                </div>
              )}

              {pet.medication && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Syringe className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-700 mb-1">
                        Medicación habitual
                      </p>
                      <p className="text-sm text-amber-900">{pet.medication}</p>
                    </div>
                  </div>
                </div>
              )}

              {pet.specialNeeds && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Heart className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-blue-700 mb-1">
                        Necesidades especiales
                      </p>
                      <p className="text-sm text-blue-900">{pet.specialNeeds}</p>
                    </div>
                  </div>
                </div>
              )}

              {(pet.vet || pet.vetPhone) && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Stethoscope className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      {pet.vet && (
                        <p className="text-gray-900 font-medium">{pet.vet}</p>
                      )}
                      {pet.vetPhone && (
                        <a
                          href={`tel:${pet.vetPhone}`}
                          className="text-gray-600 hover:text-blue-600"
                        >
                          {pet.vetPhone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg
                  className="w-6 h-6 text-green-600"
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
              <p className="text-sm text-green-700 font-medium">Sin alertas médicas</p>
              <p className="text-xs text-green-600 mt-1">
                No hay alergias, medicación ni necesidades especiales registradas
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
