import { CheckCircle, Wrench } from 'lucide-react';

interface RoomStatusBadgeProps {
  status: 'operational' | 'maintenance';
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

const statusConfig = {
  operational: {
    label: 'Operativa',
    icon: CheckCircle,
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  maintenance: {
    label: 'Mantenimiento',
    icon: Wrench,
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
};

export function RoomStatusBadge({
  status,
  size = 'md',
  showIcon = true,
}: RoomStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${config.className} ${sizeClasses[size]}`}
    >
      {showIcon && <Icon className={iconSizeClasses[size]} />}
      <span>{config.label}</span>
    </span>
  );
}
