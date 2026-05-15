import { Search, X, Calendar, User, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface Employee {
  id: number;
  name: string;
}

interface TrackingFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  dateFilter: string;
  onDateChange: (value: string) => void;
  employeeFilter: string;
  onEmployeeChange: (value: string) => void;
  incidentFilter: string;
  onIncidentChange: (value: string) => void;
  onClearFilters: () => void;
  employees: Employee[];
}

const dateOptions = [
  { value: 'all', label: 'Toda la estancia' },
  { value: 'today', label: 'Hoy' },
  { value: 'last_7_days', label: 'Últimos 7 días' },
];

const incidentOptions = [
  { value: 'all', label: 'Todos los registros' },
  { value: 'with_incidents', label: 'Con incidencias' },
  { value: 'no_incidents', label: 'Sin incidencias' },
];

export function TrackingFilters({
  searchTerm,
  onSearchChange,
  dateFilter,
  onDateChange,
  employeeFilter,
  onEmployeeChange,
  incidentFilter,
  onIncidentChange,
  onClearFilters,
  employees,
}: TrackingFiltersProps) {
  const hasActiveFilters =
    searchTerm ||
    dateFilter !== 'all' ||
    employeeFilter !== 'all' ||
    incidentFilter !== 'all';

  return (
    <Card className="p-4 border-0 shadow-md">
      <div className="space-y-3">
        {/* Fila 1: Búsqueda */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar en registros de seguimiento..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtro de fecha */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
            <select
              value={dateFilter}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full h-10 pl-10 pr-8 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
            >
              {dateOptions.map((option) => (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Filtro de empleado */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
            <select
              value={employeeFilter}
              onChange={(e) => onEmployeeChange(e.target.value)}
              className="w-full h-10 pl-10 pr-8 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
            >
              <option value="all">Todos los empleados</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id.toString()}>
                  {employee.name}
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

          {/* Filtro de incidencias */}
          <div className="relative">
            <AlertTriangle className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
            <select
              value={incidentFilter}
              onChange={(e) => onIncidentChange(e.target.value)}
              className="w-full h-10 pl-10 pr-8 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
            >
              {incidentOptions.map((option) => (
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
