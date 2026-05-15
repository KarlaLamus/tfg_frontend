import { TrackingItem } from './tracking-item';

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

interface TrackingTimelineProps {
  records: TrackingRecord[];
  onEdit: (record: TrackingRecord) => void;
  onDelete: (recordId: string) => void;
}

export function TrackingTimeline({ records, onEdit, onDelete }: TrackingTimelineProps) {
  return (
    <div className="relative">
      {/* Línea vertical del timeline (solo desktop) */}
      <div className="hidden lg:block absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-green-200 to-transparent"></div>

      {/* Lista de registros */}
      <div className="space-y-4">
        {records.map((record, index) => (
          <TrackingItem
            key={record.id}
            record={record}
            isFirst={index === 0}
            isLast={index === records.length - 1}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}