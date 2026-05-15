import { Dog, Cat } from 'lucide-react';

interface RoomTypeBadgeProps {
  type: 'dog' | 'cat';
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

const typeConfig = {
  dog: {
    label: 'Perro',
    icon: Dog,
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  cat: {
    label: 'Gato',
    icon: Cat,
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

export function RoomTypeBadge({ type, size = 'md', showIcon = true }: RoomTypeBadgeProps) {
  const config = typeConfig[type];
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
