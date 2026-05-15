interface ReservationStatusBadgeProps {
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  size?: 'sm' | 'md';
}

const statusConfig = {
  pending: {
    label: 'Pendiente',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  confirmed: {
    label: 'Confirmada',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  in_progress: {
    label: 'En curso',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  completed: {
    label: 'Finalizada',
    className: 'bg-gray-50 text-gray-700 border-gray-200',
  },
  cancelled: {
    label: 'Cancelada',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
};

export function ReservationStatusBadge({ status, size = 'md' }: ReservationStatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`inline-block ${sizeClasses} rounded-full border ${config.className}`}
    >
      {config.label}
    </span>
  );
}
