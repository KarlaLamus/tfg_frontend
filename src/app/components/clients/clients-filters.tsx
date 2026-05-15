import { useState } from 'react';
import { Search, PawPrint, CalendarDays, ArrowUpDown, RotateCcw, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export type ClientFilters = {
  searchTerm: string;
  petsFilter: 'all' | 'withPets' | 'withoutPets';
  reservationsFilter: 'all' | 'withReservations' | 'withoutReservations';
  sortByDate: 'none' | 'newest' | 'oldest';
};

interface ClientsFiltersProps {
  onSearch: (filters: ClientFilters) => void;
}

const defaultFilters: ClientFilters = {
  searchTerm: '',
  petsFilter: 'all',
  reservationsFilter: 'all',
  sortByDate: 'newest',
};

const petsOptions = [
  { value: 'withPets', label: 'Con mascotas' },
  { value: 'withoutPets', label: 'Sin mascotas' },
] as const;

const reservationOptions = [
  { value: 'withReservations', label: 'Con reservas' },
  { value: 'withoutReservations', label: 'Sin reservas' },
] as const;

const sortOptions = [
  { value: 'newest', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
] as const;

export function ClientsFilters({ onSearch }: ClientsFiltersProps) {
  // Estado único con todos los filtros agrupados
  const [filters, setFilters] = useState<ClientFilters>(defaultFilters);

  // Función genérica para actualizar cualquier campo del filtro
  const updateFilters = (newValues: Partial<ClientFilters>) => {
    const updatedFilters = { ...filters, ...newValues };
    setFilters(updatedFilters);
    onSearch(updatedFilters);
  };

  // Restaura todos los filtros a su estado inicial
  const handleClearFilters = () => {
    setFilters(defaultFilters);
    onSearch(defaultFilters);
  };

  // Indica si hay filtros activos distintos al estado por defecto
  const hasActiveFilters =
    filters.searchTerm !== '' ||
    filters.petsFilter !== 'all' ||
    filters.reservationsFilter !== 'all' ||
    filters.sortByDate !== defaultFilters.sortByDate;

  const getOptionClassName = (isActive: boolean, activeClassName: string) => {
    return isActive
      ? `border-transparent text-white shadow-sm ${activeClassName}`
      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50';
  };

  const activeFilterCount = [
    filters.searchTerm !== '',
    filters.petsFilter !== 'all',
    filters.reservationsFilter !== 'all',
    filters.sortByDate !== defaultFilters.sortByDate,
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-5">
      <div className="space-y-4">
        {/* Buscador general */}
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por nombre, correo o teléfono..."
              value={filters.searchTerm}
              onChange={(e) => updateFilters({ searchTerm: e.target.value })}
              className="pl-11 h-11 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-3">
            <div className="flex items-center gap-2 mb-3">
              <PawPrint className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-medium text-gray-900">Mascotas</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {petsOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateFilters({
                      petsFilter: option.value,
                    })
                  }
                  className={`rounded-full ${getOptionClassName(
                    filters.petsFilter === option.value,
                    'bg-blue-600 hover:bg-blue-700'
                  )}`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-green-100 bg-green-50/40 p-3">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-green-600" />
              <p className="text-sm font-medium text-gray-900">Reservas</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {reservationOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateFilters({
                      reservationsFilter: option.value,
                    })
                  }
                  className={`rounded-full ${getOptionClassName(
                    filters.reservationsFilter === option.value,
                    'bg-green-600 hover:bg-green-700'
                  )}`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-3">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpDown className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-medium text-gray-900">Orden</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sortOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateFilters({
                      sortByDate: option.value,
                    })
                  }
                  className={`rounded-full ${getOptionClassName(
                    filters.sortByDate === option.value,
                    'bg-amber-600 hover:bg-amber-700'
                  )}`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <span className="font-medium text-gray-700">
                  Vista filtrada ({activeFilterCount})
                </span>

                {filters.searchTerm !== '' && (
                  <button
                    type="button"
                    onClick={() => updateFilters({ searchTerm: '' })}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1 text-slate-700 transition-colors hover:bg-slate-300"
                  >
                    <span>“{filters.searchTerm}”</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {filters.petsFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => updateFilters({ petsFilter: 'all' })}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-blue-700 transition-colors hover:bg-blue-200"
                  >
                    <span>
                      {filters.petsFilter === 'withPets' ? 'Con mascotas' : 'Sin mascotas'}
                    </span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {filters.reservationsFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => updateFilters({ reservationsFilter: 'all' })}
                    className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-green-700 transition-colors hover:bg-green-200"
                  >
                    <span>
                      {filters.reservationsFilter === 'withReservations'
                        ? 'Con reservas'
                        : 'Sin reservas'}
                    </span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {filters.sortByDate !== defaultFilters.sortByDate && (
                  <button
                    type="button"
                    onClick={() => updateFilters({ sortByDate: defaultFilters.sortByDate })}
                    className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-700 transition-colors hover:bg-amber-200"
                  >
                    <span>
                      {filters.sortByDate === 'oldest'
                        ? 'Más antiguos primero'
                        : 'Sin ordenar'}
                    </span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Quitar filtros
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
