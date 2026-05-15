import { Plus, Utensils, Pill, Smile, AlertCircle, User, Clock } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

interface TrackingRecord {
  id: number;
  date: string;
  time: string;
  feeding: string;
  medication: string;
  behavior: string;
  incidents: string;
  staff: string;
}

interface PetTrackingSectionProps {
  tracking: TrackingRecord[];
  onCreateTracking: () => void;
  maxRecords?: number;
}

export function PetTrackingSection({
  tracking,
  onCreateTracking,
  maxRecords,
}: PetTrackingSectionProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const sortedTracking = [...tracking].sort((a, b) => {
    const dateTimeA = new Date(`${a.date}T${a.time}:00`).getTime();
    const dateTimeB = new Date(`${b.date}T${b.time}:00`).getTime();
    return dateTimeB - dateTimeA;
  });

  const limitedTracking =
    typeof maxRecords === 'number' ? sortedTracking.slice(0, maxRecords) : sortedTracking;

  // Agrupar por fecha
  const groupedByDate = limitedTracking.reduce((acc, record) => {
    if (!acc[record.date]) {
      acc[record.date] = [];
    }
    acc[record.date].push(record);
    return acc;
  }, {} as Record<string, TrackingRecord[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-gray-900">Seguimiento diario</h3>
          <p className="text-sm text-gray-500 mt-1">Registros durante la estancia actual</p>
        </div>
        <Button
          onClick={onCreateTracking}
          size="sm"
          className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Registrar seguimiento
        </Button>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedByDate)
          .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
          .map(([date, records]) => (
            <div key={date}>
              {/* Fecha */}
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px bg-gray-200 flex-1"></div>
                <p className="text-sm text-gray-600 font-medium capitalize">
                  {formatDate(date)}
                </p>
                <div className="h-px bg-gray-200 flex-1"></div>
              </div>

              {/* Registros de ese día */}
              <div className="space-y-3">
                {records
                  .sort((a, b) => b.time.localeCompare(a.time))
                  .map((record) => (
                    <Card key={record.id} className="p-5 border-0 shadow-md">
                      {/* Header del registro */}
                      <div className="flex items-start justify-between mb-4 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{record.time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <User className="w-3.5 h-3.5" />
                          {record.staff}
                        </div>
                      </div>

                      {/* Contenido del registro */}
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                            <Utensils className="w-4 h-4 text-orange-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 mb-1">Alimentación</p>
                            <p className="text-sm text-gray-900">{record.feeding}</p>
                          </div>
                        </div>

                        {record.medication !== 'Ninguna' && record.medication !== '-' && (
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                              <Pill className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500 mb-1">Medicación</p>
                              <p className="text-sm text-gray-900">{record.medication}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                            <Smile className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 mb-1">Comportamiento</p>
                            <p className="text-sm text-gray-900">{record.behavior}</p>
                          </div>
                        </div>

                        {record.incidents !== 'Ninguna' && record.incidents !== '-' && (
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500 mb-1">Incidencias</p>
                              <p className="text-sm text-gray-900">{record.incidents}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
      </div>

      {limitedTracking.length === 0 && (
        <Card className="p-8 border-0 shadow-md text-center">
          <div className="max-w-sm mx-auto">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Smile className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Aún no hay registros de seguimiento para esta estancia
            </p>
            <Button
              onClick={onCreateTracking}
              size="sm"
              className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear primer registro
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
