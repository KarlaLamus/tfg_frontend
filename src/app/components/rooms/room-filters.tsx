import { Search, X, PawPrint, Maximize2, Settings, DoorClosed } from 'lucide-react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface RoomsFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeChange: (value: string) => void;
  sizeFilter: string;
  onSizeChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  occupancyFilter: string;
  onOccupancyChange: (value: string) => void;
  onClearFilters: () => void;
}

const typeOptions = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'dog', label: 'Perro' },
  { value: 'cat', label: 'Gato' },
];

const sizeOptions = [
  { value: 'all', label: 'Todos los tamaños' },
  { value: 'S', label: 'S (Pequeño)' },
  { value: 'M', label: 'M (Mediano)' },
  { value: 'L', label: 'L (Grande)' },
];

const statusOptions = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'operational', label: 'Operativa' },
  { value: 'maintenance', label: 'Mantenimiento' },
];

const occupancyOptions = [
  { value: 'all', label: 'Todas' },
  { value: 'free', label: 'Libres' },
  { value: 'occupied', label: 'Ocupadas' },
];

export function RoomsFilters({
  searchTerm,
  onSearchChange,
  typeFilter,
  onTypeChange,
  sizeFilter,
  onSizeChange,
  statusFilter,
  onStatusChange,
  occupancyFilter,
  onOccupancyChange,
  onClearFilters,
}: RoomsFiltersProps) {
  const hasActiveFilters =
    searchTerm ||
    typeFilter !== 'all' ||
    sizeFilter !== 'all' ||
    statusFilter !== 'all' ||
    occupancyFilter !== 'all';

  return (
    <Card className="p-4 border-0 shadow-md">
      <div className="space-y-3">
        {/* Fila 1: Búsqueda y botón limpiar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-3 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar por código, tipo o tamaño..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filtro de tipo */}
          <div className="relative">
            <PawPrint className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
            <select
              value={typeFilter}
              onChange={(e) => onTypeChange(e.target.value)}
              className="w-full h-10 pl-10 pr-8 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
            >
              {typeOptions.map((option) => (
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

          {/* Filtro de tamaño */}
          <div className="relative">
            <Maximize2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
            <select
              value={sizeFilter}
              onChange={(e) => onSizeChange(e.target.value)}
              className="w-full h-10 pl-10 pr-8 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
            >
              {sizeOptions.map((option) => (
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

          {/* Filtro de estado */}
          <div className="relative">
            <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-full h-10 pl-10 pr-8 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
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

          {/* Filtro de ocupación */}
          <div className="relative">
            <DoorClosed className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
            <select
              value={occupancyFilter}
              onChange={(e) => onOccupancyChange(e.target.value)}
              className="w-full h-10 pl-10 pr-8 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
            >
              {occupancyOptions.map((option) => (
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
