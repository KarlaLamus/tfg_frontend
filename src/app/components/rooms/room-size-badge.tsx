interface RoomSizeBadgeProps {
  size: 'S' | 'M' | 'L';
  variant?: 'sm' | 'md';
}

const sizeConfig = {
  S: {
    label: 'S',
    fullLabel: 'Pequeño',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  M: {
    label: 'M',
    fullLabel: 'Mediano',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  L: {
    label: 'L',
    fullLabel: 'Grande',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

export function RoomSizeBadge({ size, variant = 'md' }: RoomSizeBadgeProps) {
  const config = sizeConfig[size];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={`inline-block rounded-full border font-medium ${config.className} ${sizeClasses[variant]}`}
      title={config.fullLabel}
    >
      {config.label}
    </span>
  );
}
