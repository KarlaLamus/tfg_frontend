import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, Trash2, ChevronLeft, ChevronRight, PawPrint, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { buildReturnNavigationState } from '../../utils/return-navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface Client {
  id: number;
  name: string;
  email: string;
  phone: string;
  petsCount: number;
  reservationsCount: number;
  registeredAt: string;
}

interface ClientsTableProps {
  clients: Client[];
  onDelete: (id: number) => void;
  onCreateClient?: () => void;
}

const DESKTOP_BREAKPOINT = 1024;
const DESKTOP_FIXED_HEIGHT = 470;
const MOBILE_FIXED_HEIGHT = 620;
const DESKTOP_ROW_HEIGHT = 60;
const MOBILE_CARD_HEIGHT = 175;
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

export function ClientsTable({ clients, onDelete, onCreateClient }: ClientsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(getFallbackItemsPerPage);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paginationRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const totalPages = Math.max(1, Math.ceil(clients.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClients = clients.slice(startIndex, endIndex);

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
        container.querySelector('[data-mobile-client-card="true"]') instanceof HTMLElement
          ? (container.querySelector('[data-mobile-client-card="true"]') as HTMLElement)
          : null;
      const cardHeight = firstCard?.getBoundingClientRect().height ?? MOBILE_CARD_HEIGHT;
      const calculatedItems = Math.floor((listHeight + MOBILE_CARDS_GAP) / (cardHeight + MOBILE_CARDS_GAP));

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
  }, [clients.length, totalPages]);

  const handlePrevPage = () => {
    setCurrentPage(Math.max(safeCurrentPage - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(Math.min(safeCurrentPage + 1, totalPages));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const navigateToClientDetail = (clientId: number) => {
    navigate(`/clientes/${clientId}`, {
      state: buildReturnNavigationState('/clientes', 'Volver a clientes'),
    });
  };

  if (clients.length === 0) {
    return (
      <Card className="p-12 text-center border-0 shadow-md">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <PawPrint className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-gray-900 mb-2">No hay clientes registrados todavía</h3>
          <p className="text-sm text-gray-600 mb-6">
            Comienza registrando tu primer cliente para gestionar sus mascotas y reservas.
          </p>
          <Button
            onClick={onCreateClient}
            className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
          >
            Registrar primer cliente
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Tabla para desktop */}
      <Card className="hidden lg:block border-0 shadow-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-gray-700">Nombre del cliente</TableHead>
              <TableHead className="text-gray-700">Correo electrónico</TableHead>
              <TableHead className="text-gray-700">Teléfono</TableHead>
              <TableHead className="text-gray-700 text-center">Nº Mascotas</TableHead>
              <TableHead className="text-gray-700 text-center">Nº Reservas</TableHead>
              <TableHead className="text-gray-700">Fecha de registro</TableHead>
              <TableHead className="text-gray-700 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentClients.map((client) => (
              <TableRow key={client.id} className="hover:bg-gray-50">
                <TableCell className="text-gray-900">
                  <button
                    onClick={() => navigateToClientDetail(client.id)}
                    className="text-left hover:text-blue-600 hover:underline transition-colors focus:outline-none focus:text-blue-600"
                  >
                    {client.name}
                  </button>
                </TableCell>
                <TableCell className="text-gray-600">{client.email}</TableCell>
                <TableCell className="text-gray-600">{client.phone}</TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                    <PawPrint className="w-3.5 h-3.5" />
                    {client.petsCount}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                    <Calendar className="w-3.5 h-3.5" />
                    {client.reservationsCount}
                  </span>
                </TableCell>
                <TableCell className="text-gray-600">{formatDate(client.registeredAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      title="Ver ficha completa"
                      onClick={() => navigateToClientDetail(client.id)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(client.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Eliminar cliente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Tarjetas para móvil/tablet */}
      <div className="lg:hidden space-y-3">
        {currentClients.map((client) => (
          <Card key={client.id} data-mobile-client-card="true" className="p-4 border-0 shadow-md">
            <div className="space-y-3">
              {/* Header de la tarjeta */}
              <div className="flex items-start justify-between">
                <div>
                  <button
                    onClick={() => navigateToClientDetail(client.id)}
                    className="text-left hover:text-blue-600 transition-colors focus:outline-none focus:text-blue-600"
                  >
                    <h4 className="text-gray-900 mb-1 hover:underline">{client.name}</h4>
                  </button>
                  <p className="text-sm text-gray-600">{client.email}</p>
                </div>
              </div>

              {/* Información */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Teléfono</p>
                  <p className="text-gray-900">{client.phone}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Registro</p>
                  <p className="text-gray-900">{formatDate(client.registeredAt)}</p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                  <PawPrint className="w-3.5 h-3.5" />
                  {client.petsCount} {client.petsCount === 1 ? 'mascota' : 'mascotas'}
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                  <Calendar className="w-3.5 h-3.5" />
                  {client.reservationsCount} {client.reservationsCount === 1 ? 'reserva' : 'reservas'}
                </span>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => navigateToClientDetail(client.id)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(client.id)}
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div ref={paginationRef}>
          <Card className="p-4 border-0 shadow-md">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-600">
                Mostrando {startIndex + 1} a {Math.min(endIndex, clients.length)} de{' '}
                {clients.length} clientes
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={safeCurrentPage === 1}
                  className="h-9"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
