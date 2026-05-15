import { User, Phone, Mail, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { buildReturnNavigationState } from '../../utils/return-navigation';

interface Owner {
  id: number;
  name: string;
  phone: string;
  email: string;
}

interface PetOwnerCardProps {
  owner: Owner;
}

export function PetOwnerCard({ owner }: PetOwnerCardProps) {
  const navigate = useNavigate();

  const handleViewClient = () => {
    navigate(`/clientes/${owner.id}`, {
      state: buildReturnNavigationState('/mascotas', 'Volver a mascotas'),
    });
  };

  return (
    <Card className="p-6 border-0 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-900">Información del dueño</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleViewClient}
          className="border-blue-200 text-blue-600 hover:bg-blue-50"
        >
          <ExternalLink className="w-3.5 h-3.5 mr-2" />
          Ver ficha
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center text-white shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">Nombre completo</label>
            <p className="text-sm text-gray-900">{owner.name}</p>
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Teléfono
          </label>
          <a
            href={`tel:${owner.phone}`}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            {owner.phone}
          </a>
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Correo electrónico
          </label>
          <a
            href={`mailto:${owner.email}`}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
          >
            {owner.email}
          </a>
        </div>
      </div>
    </Card>
  );
}
