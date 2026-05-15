import { Calendar, PawPrint, Clock, DollarSign } from 'lucide-react';
import { Card } from '../ui/card';
import { cn } from '../ui/utils';

interface StatsCardsProps {
  activeReservations: number;
  hostedPets: number;
  pendingReservations: number;
  monthlyRevenue: number;
  isLoading?: boolean;
  showRevenue?: boolean;
}

const formatCurrency = (amount: number) =>
  amount.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export function StatsCards({
  activeReservations,
  hostedPets,
  pendingReservations,
  monthlyRevenue,
  isLoading = false,
  showRevenue = false,
}: StatsCardsProps) {
  const stats = [
    {
      label: 'Reservas activas',
      value: String(activeReservations),
      icon: Calendar,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      label: 'Mascotas alojadas',
      value: String(hostedPets),
      icon: PawPrint,
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      label: 'Pendientes de confirmar',
      value: String(pendingReservations),
      icon: Clock,
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
    },
  ];

  if (showRevenue) {
    stats.push({
      label: 'Ingresos del mes',
      value: formatCurrency(monthlyRevenue),
      icon: DollarSign,
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    });
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2',
        showRevenue ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
      )}
    >
      {stats.map((stat) => (
        <Card key={stat.label} className="border-0 p-6 shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="mb-1 text-sm text-gray-600">{stat.label}</p>
              <p className="text-gray-900">{isLoading ? '...' : stat.value}</p>
            </div>
            <div className={`rounded-xl p-3 ${stat.bgColor}`}>
              <stat.icon className={`h-6 w-6 ${stat.textColor}`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
