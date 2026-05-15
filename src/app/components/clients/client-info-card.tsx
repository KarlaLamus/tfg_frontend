import { Calendar, FileText } from 'lucide-react';
import { Card } from '../ui/card';

interface Client {
  name: string;
  email: string;
  phone: string;
  registeredAt: string;
  observations?: string;
}

interface ClientInfoCardProps {
  client: Client;
}

export function ClientInfoCard({ client }: ClientInfoCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <Card className="p-6 border-0 shadow-md">
      <h3 className="text-gray-900 mb-4">Información del cliente</h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-500 mb-1 block">Nombre completo</label>
          <p className="text-gray-900">{client.name}</p>
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-1 block">Correo electrónico</label>
          <p className="text-gray-900">{client.email}</p>
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-1 block">Teléfono</label>
          <p className="text-gray-900">{client.phone}</p>
        </div>

        <div>
          <label className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Fecha de registro
          </label>
          <p className="text-gray-900">{formatDate(client.registeredAt)}</p>
        </div>

        {client.observations && (
          <div>
            <label className="text-sm text-gray-500 mb-1 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Observaciones
            </label>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
              {client.observations}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
