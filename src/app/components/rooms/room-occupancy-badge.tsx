import { DoorOpen, DoorClosed } from 'lucide-react';

interface RoomOccupancyBadgeProps {
  occupied: boolean;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export function RoomOccupancyBadge({
  occupied,
  size = 'md',
  showIcon = true,
}: RoomOccupancyBadgeProps) {
  const config = occupied
    ? {
        label: 'Ocupada',
        icon: DoorClosed,
        className: 'bg-red-50 text-red-700 border-red-200',
      }
    : {
        label: 'Libre',
        icon: DoorOpen,
        className: 'bg-gray-50 text-gray-700 border-gray-200',
      };

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
