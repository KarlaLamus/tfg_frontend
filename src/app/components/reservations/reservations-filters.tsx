import { Search, X, Calendar, DoorOpen, CreditCard } from 'lucide-react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface ReservationsFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  dateFilter: string;
  onDateChange: (value: string) => void;
  roomFilter: string;
  onRoomChange: (value: string) => void;
  paymentStatusFilter: string;
  onPaymentStatusChange: (value: string) => void;
  onClearFilters: () => void;
}

const statusOptions = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmada' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'completed', label: 'Finalizada' },
  { value: 'cancelled', label: 'Cancelada' },
];

const paymentStatusOptions = [
  { value: 'all', label: 'Todos los pagos' },
  { value: 'pending', label: 'Pendiente de pago' },
  { value: 'paid', label: 'Pagada' },
];

export function ReservationsFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  dateFilter,
  onDateChange,
  roomFilter,
  onRoomChange,
  paymentStatusFilter,
  onPaymentStatusChange,
  onClearFilters,
}: ReservationsFiltersProps) {
  const hasActiveFilters =
    searchTerm ||
    statusFilter !== 'all' ||
    dateFilter ||
    roomFilter ||
    paymentStatusFilter !== 'all';

  return (
    <Card className="p-4 border-0 shadow-md">
      <div className="space-y-3">
        {/* Fila 1: Búsqueda */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar por cliente, mascota o número de reserva..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtro de estado */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-full h-10 px-3 pr-8 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>

          {/* Botón limpiar filtros */}
          <div>
            <Button
              variant="outline"
              onClick={onClearFilters}
              disabled={!hasActiveFilters}
              className="w-full border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4 mr-2" />
              Limpiar filtros
            </Button>
          </div>
        </div>

        {/* Fila 2: Filtros adicionales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Filtro de fecha */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => onDateChange(e.target.value)}
              placeholder="Filtrar por fecha"
              className="pl-10"
            />
          </div>

          {/* Filtro de sala */}
          <div className="relative">
            <DoorOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
            <Input
              type="text"
              value={roomFilter}
              onChange={(e) => onRoomChange(e.target.value)}
              placeholder="Filtrar por sala o box..."
              className="pl-10"
            />
          </div>

          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
            <select
              value={paymentStatusFilter}
              onChange={(e) => onPaymentStatusChange(e.target.value)}
              className="w-full h-10 pl-10 pr-8 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
            >
              {paymentStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
