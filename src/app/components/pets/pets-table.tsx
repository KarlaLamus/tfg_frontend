import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Dog,
  Cat,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import type { EditablePet } from './edit-pet-modal';
import { buildReturnNavigationState } from '../../utils/return-navigation';
import { ImageWithFallback } from '../noImg/ImageWithFallback';

type Pet = EditablePet;

interface PetsTableProps {
  pets: Pet[];
  onDelete: (id: number) => void;
  hasActiveFilters?: boolean;
  onCreatePet?: () => void;
}

const DESKTOP_BREAKPOINT = 1024;
const DESKTOP_FIXED_HEIGHT = 470;
const MOBILE_FIXED_HEIGHT = 620;
const DESKTOP_ROW_HEIGHT = 62;
const MOBILE_CARD_HEIGHT = 178;
const TABLE_HEADER_HEIGHT = 44;
const DEFAULT_PAGINATION_HEIGHT = 90;
const PAGE_BOTTOM_BUFFER = 32;
const SPACE_BETWEEN_BLOCKS = 16;
const MOBILE_CARDS_GAP = 12;
const MIN_DESKTOP_ITEMS = 20;
const MAX_DESKTOP_ITEMS = 20;
const MIN_MOBILE_ITEMS = 20;
const MAX_MOBILE_ITEMS = 20;

const clampItemsPerPage = (items: number, isDesktop: boolean) => {
  const minItems = isDesktop ? MIN_DESKTOP_ITEMS : MIN_MOBILE_ITEMS;
  const maxItems = isDesktop ? MAX_DESKTOP_ITEMS : MAX_MOBILE_ITEMS;

  return Math.min(Math.max(items, minItems), maxItems);
};

const getFallbackItemsPerPage = () => {
  if (typeof window === 'undefined') {
    return 20;
  }

  const isDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
  const fixedHeight = isDesktop ? DESKTOP_FIXED_HEIGHT : MOBILE_FIXED_HEIGHT;
  const itemHeight = isDesktop ? DESKTOP_ROW_HEIGHT : MOBILE_CARD_HEIGHT;
  const availableHeight = window.innerHeight - fixedHeight;
  const calculatedItems = Math.floor(availableHeight / itemHeight);

  return clampItemsPerPage(calculatedItems, isDesktop);
};

export function PetsTable({
  pets,
  onDelete,
  hasActiveFilters = false,
  onCreatePet,
}: PetsTableProps) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(getFallbackItemsPerPage);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paginationRef = useRef<HTMLDivElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(pets.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPets = pets.slice(startIndex, endIndex);

  useEffect(() => {
    const calculateItemsPerPage = () => {
      if (typeof window === 'undefined') {
        return 20;
      }

      const isDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
      const container = containerRef.current;

      if (!container) {
        return getFallbackItemsPerPage();
      }

      const availableHeight =
        window.innerHeight - container.getBoundingClientRect().top - PAGE_BOTTOM_BUFFER;
      const paginationHeight =
        totalPages > 1
          ? (paginationRef.current?.getBoundingClientRect().height ?? DEFAULT_PAGINATION_HEIGHT) +
            SPACE_BETWEEN_BLOCKS
          : 0;
      const listHeight = availableHeight - paginationHeight;

      if (isDesktop) {
        const tableHeader =
          container.querySelector('[data-slot="table-header"]') instanceof HTMLElement
            ? (container.querySelector('[data-slot="table-header"]') as HTMLElement)
            : null;
        const firstRow =
          container.querySelector('[data-slot="table-body"] tr') instanceof HTMLElement
            ? (container.querySelector('[data-slot="table-body"] tr') as HTMLElement)
            : null;

        const headerHeight = tableHeader?.getBoundingClientRect().height ?? TABLE_HEADER_HEIGHT;
        const rowHeight = firstRow?.getBoundingClientRect().height ?? DESKTOP_ROW_HEIGHT;
        const calculatedItems = Math.floor((listHeight - headerHeight) / rowHeight);

        return clampItemsPerPage(calculatedItems, true);
      }

      const firstCard =
        container.querySelector('[data-mobile-pet-card="true"]') instanceof HTMLElement
          ? (container.querySelector('[data-mobile-pet-card="true"]') as HTMLElement)
          : null;
      const cardHeight = firstCard?.getBoundingClientRect().height ?? MOBILE_CARD_HEIGHT;
      const calculatedItems = Math.floor(
        (listHeight + MOBILE_CARDS_GAP) / (cardHeight + MOBILE_CARDS_GAP)
      );

      return clampItemsPerPage(calculatedItems, false);
    };

    const handleResize = () => {
      const nextItemsPerPage = calculateItemsPerPage();
      setItemsPerPage((currentItemsPerPage) =>
        currentItemsPerPage === nextItemsPerPage ? currentItemsPerPage : nextItemsPerPage
      );
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [pets.length, totalPages]);

  const handlePrevPage = () => {
    setCurrentPage(Math.max(safeCurrentPage - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(Math.min(safeCurrentPage + 1, totalPages));
  };

  const handleViewPet = (id: number) => {
    navigate(`/mascotas/${id}`, {
      state: buildReturnNavigationState('/mascotas', 'Volver a mascotas'),
    });
  };

  const renderOwner = (pet: Pet) => {
    if (!pet.ownerId) {
      return <span className="text-sm text-gray-700">{pet.owner}</span>;
    }

    return (
      <button
        onClick={() =>
          navigate(
            `/clientes/${pet.ownerId}`,
            {
              state: buildReturnNavigationState('/mascotas', 'Volver a mascotas'),
            }
          )
        }
        className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
      >
        {pet.owner}
      </button>
    );
  };

  const renderPetName = (pet: Pet, className = 'text-gray-900') => (
    <button
      onClick={() => handleViewPet(pet.id)}
      className={`text-left hover:text-blue-600 hover:underline ${className}`}
    >
      {pet.name}
    </button>
  );

  const renderPetAvatar = (pet: Pet, sizeClassName: string) => {
    if (pet.photoUrl) {
      return (
        <ImageWithFallback
          src={pet.photoUrl}
          alt={`Foto de ${pet.name}`}
          className={`${sizeClassName} overflow-hidden rounded-full object-cover`}
        />
      );
    }

    return (
      <div
        className={`flex items-center justify-center rounded-full ${
          pet.species === 'Perro'
            ? 'bg-blue-100 text-blue-600'
            : 'bg-purple-100 text-purple-600'
        } ${sizeClassName}`}
      >
        {pet.species === 'Perro' ? (
          <Dog className="h-5 w-5" />
        ) : (
          <Cat className="h-5 w-5" />
        )}
      </div>
    );
  };

  if (pets.length === 0) {
    return (
      <Card className="border-0 p-12 text-center shadow-md">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Dog className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mb-2 text-gray-900">No se encontraron mascotas</h3>
          <p className="mb-6 text-sm text-gray-600">
            {hasActiveFilters
              ? 'Intenta ajustar los filtros de búsqueda para ver resultados.'
              : 'Comienza registrando la primera mascota en el sistema.'}
          </p>
          {!hasActiveFilters && onCreatePet && (
            <Button
              onClick={onCreatePet}
              className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
            >
              Registrar primera mascota
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4">
      <Card className="hidden overflow-hidden border-0 shadow-md lg:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-gray-700">Mascota</TableHead>
              <TableHead className="text-gray-700">Especie</TableHead>
              <TableHead className="text-gray-700">Raza</TableHead>
              <TableHead className="text-gray-700">Edad</TableHead>
              <TableHead className="text-gray-700">Dueño</TableHead>
              <TableHead className="text-center text-gray-700">Estado</TableHead>
              <TableHead className="text-right text-gray-700">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentPets.map((pet) => (
              <TableRow key={pet.id} className="hover:bg-gray-50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    {renderPetAvatar(pet, 'h-9 w-9')}
                    {renderPetName(pet)}
                  </div>
                </TableCell>
                <TableCell className="text-gray-600">{pet.species}</TableCell>
                <TableCell className="text-gray-600">{pet.breed}</TableCell>
                <TableCell className="text-gray-600">
                  {pet.age} {pet.age === 1 ? 'año' : 'años'}
                </TableCell>
                <TableCell>{renderOwner(pet)}</TableCell>
                <TableCell className="text-center">
                  {pet.isHosted ? (
                    <div className="flex flex-col items-center">
                      <span className="mb-1 inline-block rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs text-green-700">
                        Hospedado
                      </span>
                      <p className="text-xs text-gray-500">{pet.room}</p>
                    </div>
                  ) : (
                    <span className="inline-block rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
                      No hospedado
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewPet(pet.id)}
                      className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      title="Ver ficha"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(pet.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="space-y-3 lg:hidden">
        {currentPets.map((pet) => (
          <Card key={pet.id} data-mobile-pet-card="true" className="border-0 p-4 shadow-md">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {renderPetAvatar(pet, 'h-10 w-10')}
                  <div>
                    {renderPetName(pet, 'text-gray-900')}
                    <p className="text-sm text-gray-600">
                      {pet.breed} · {pet.age} {pet.age === 1 ? 'año' : 'años'}
                    </p>
                  </div>
                </div>
                {pet.isHosted ? (
                  <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs text-green-700">
                    Hospedado
                  </span>
                ) : (
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
                    No hospedado
                  </span>
                )}
              </div>

              <div className="text-sm">
                <p className="mb-1 text-gray-500">Dueño</p>
                {renderOwner(pet)}
              </div>

              {pet.isHosted && (
                <div className="text-sm">
                  <p className="mb-1 text-gray-500">Sala actual</p>
                  <p className="text-gray-900">{pet.room}</p>
                </div>
              )}

              <div className="flex gap-2 border-t border-gray-100 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewPet(pet.id)}
                  className="flex-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Ver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(pet.id)}
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div ref={paginationRef}>
          <Card className="border-0 p-4 shadow-md">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="text-sm text-gray-600">
                Mostrando {startIndex + 1} a {Math.min(endIndex, pets.length)} de {pets.length}{' '}
                mascotas
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={safeCurrentPage === 1}
                  className="h-9"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <Button
                      key={page}
                      variant={safeCurrentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={`h-9 w-9 p-0 ${
                        safeCurrentPage === page
                          ? 'bg-gradient-to-r from-blue-500 to-green-500 text-white'
                          : ''
                      }`}
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={safeCurrentPage === totalPages}
                  className="h-9"
                >
                  Siguiente
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
