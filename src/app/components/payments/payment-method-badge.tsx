import { Banknote, CreditCard, ArrowLeftRight, HelpCircle } from 'lucide-react';

interface PaymentMethodBadgeProps {
  method: 'cash' | 'card' | 'transfer' | 'other';
  size?: 'sm' | 'md';
}

const methodConfig = {
  cash: {
    label: 'Efectivo',
    icon: Banknote,
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  card: {
    label: 'Tarjeta',
    icon: CreditCard,
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  transfer: {
    label: 'Transferencia',
    icon: ArrowLeftRight,
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  other: {
    label: 'Otro',
    icon: HelpCircle,
    className: 'bg-gray-50 text-gray-700 border-gray-200',
  },
};

export function PaymentMethodBadge({ method, size = 'md' }: PaymentMethodBadgeProps) {
  const config = methodConfig[method];
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
      <Icon className={iconSizeClasses[size]} />
      <span>{config.label}</span>
    </span>
  );
}
