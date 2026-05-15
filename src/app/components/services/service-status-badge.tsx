interface ServiceStatusBadgeProps {
  status: 'active' | 'inactive';
  size?: 'sm' | 'md';
}

const statusConfig = {
  active: {
    label: 'Activo',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  inactive: {
    label: 'Inactivo',
    className: 'bg-gray-50 text-gray-700 border-gray-200',
  },
};

export function ServiceStatusBadge({ status, size = 'md' }: ServiceStatusBadgeProps) {
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
