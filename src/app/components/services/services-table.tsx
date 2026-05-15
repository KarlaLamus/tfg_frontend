import { useEffect, useRef, useState } from 'react';
import {
  Eye,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Euro,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { ServiceStatusBadge } from './service-status-badge';
import type { EditableService } from './service-form-modal';

interface ServicesTableProps {
  services: EditableService[];
  onViewService: (service: EditableService) => void;
  onEditService: (service: EditableService) => void;
  onToggleStatus: (service: EditableService) => void;
  onDeleteService: (service: EditableService) => void;
}

const DESKTOP_BREAKPOINT = 1024;
const DESKTOP_FIXED_HEIGHT = 470;
const MOBILE_FIXED_HEIGHT = 620;
const DESKTOP_ROW_HEIGHT = 60;
const MOBILE_CARD_HEIGHT = 218;
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

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
};

const formatServiceCode = (id: number) => `S-${String(id).padStart(3, '0')}`;

export function ServicesTable({
  services,
  onViewService,
  onEditService,
  onToggleStatus,
  onDeleteService,
}: ServicesTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(getFallbackItemsPerPage);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paginationRef = useRef<HTMLDivElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(services.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentServices = services.slice(startIndex, endIndex);

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
        container.querySelector('[data-mobile-service-card="true"]') instanceof HTMLElement
          ? (container.querySelector('[data-mobile-service-card="true"]') as HTMLElement)
          : null;
      const cardHeight = firstCard?.getBoundingClientRect().height ?? MOBILE_CARD_HEIGHT;
      const calculatedItems = Math.floor(
        (listHeight + MOBILE_CARDS_GAP) / (cardHeight + MOBILE_CARDS_GAP)
      );

      return clampItemsPerPage(calculatedItems, false);
    };

    const handleResize = () => {
      const nextItemsPerPage = calculateItemsPerPage();
      setItemsPerPage((currentValue) =>
        currentValue === nextItemsPerPage ? currentValue : nextItemsPerPage
      );
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [services.length, totalPages]);

  const handlePrevPage = () => {
    setCurrentPage(Math.max(safeCurrentPage - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(Math.min(safeCurrentPage + 1, totalPages));
  };

  return (
    <div ref={containerRef} className="space-y-4">
      <Card className="hidden overflow-hidden border-0 shadow-md lg:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-gray-700">ID Servicio</TableHead>
              <TableHead className="text-gray-700">Nombre</TableHead>
              <TableHead className="text-gray-700">Descripcion</TableHead>
              <TableHead className="text-gray-700">Precio</TableHead>
              <TableHead className="text-gray-700">Estado</TableHead>
              <TableHead className="text-right text-gray-700">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentServices.map((service) => (
              <TableRow key={service.id} className="hover:bg-gray-50">
                <TableCell className="text-sm text-gray-600">
                  {formatServiceCode(service.id)}
                </TableCell>
                <TableCell className="text-gray-900 font-medium">{service.name}</TableCell>
                <TableCell className="max-w-md text-sm text-gray-600">
                  {service.description}
                </TableCell>
                <TableCell className="font-medium text-gray-900">
                  {formatPrice(service.price)}
                </TableCell>
                <TableCell>
                  <ServiceStatusBadge status={service.status} size="sm" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewService(service)}
                      className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      title="Ver detalle"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditService(service)}
                      className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleStatus(service)}
                      className={`h-8 w-8 p-0 ${
                        service.status === 'active'
                          ? 'text-green-600 hover:bg-green-50 hover:text-green-700'
                          : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                      }`}
                      title={service.status === 'active' ? 'Desactivar' : 'Activar'}
                    >
                      {service.status === 'active' ? (
                        <ToggleRight className="h-4 w-4" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteService(service)}
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
        {currentServices.map((service) => (
          <Card key={service.id} data-mobile-service-card="true" className="border-0 p-4 shadow-md">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h4 className="text-gray-900">{service.name}</h4>
                  <p className="mt-1 text-xs text-gray-500">{formatServiceCode(service.id)}</p>
                </div>
                <ServiceStatusBadge status={service.status} />
              </div>

              <p className="text-sm text-gray-600">{service.description}</p>

              <div>
                <p className="mb-1 flex items-center gap-1.5 text-sm text-gray-500">
                  <Euro className="h-3.5 w-3.5" />
                  Precio
                </p>
                <p className="text-lg font-medium text-gray-900">{formatPrice(service.price)}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewService(service)}
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Ver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditService(service)}
                  className="text-gray-600 hover:bg-gray-50"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleStatus(service)}
                  className={
                    service.status === 'active'
                      ? 'border-green-200 text-green-600 hover:bg-green-50'
                      : 'border-red-200 text-red-600 hover:bg-red-50'
                  }
                >
                  {service.status === 'active' ? (
                    <>
                      <ToggleRight className="mr-2 h-4 w-4" />
                      Desactivar
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="mr-2 h-4 w-4" />
                      Activar
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDeleteService(service)}
                  className="border-red-200 text-red-600 hover:bg-red-50"
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
                Mostrando {startIndex + 1} a {Math.min(endIndex, services.length)} de{' '}
                {services.length} servicios
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
