interface PaymentStatusBadgeProps {
  status: 'paid' | 'pending' | 'cancelled';
  size?: 'sm' | 'md';
}

const statusConfig = {
  paid: {
    label: 'Pagado',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  pending: {
    label: 'Pendiente',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  cancelled: {
    label: 'Anulado',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
};

export function PaymentStatusBadge({ status, size = 'md' }: PaymentStatusBadgeProps) {
  const config = statusConfig[status];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span className={`inline-block rounded-full border ${config.className} ${sizeClasses[size]}`}>
      {config.label}
    </span>
  );
}
