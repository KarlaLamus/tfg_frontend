import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, Pencil, XCircle, FileText, Euro, Tag, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { PaymentMethodBadge } from './payment-method-badge';
import { PaymentStatusBadge } from './payment-status-badge';
import { buildReturnNavigationState } from '../../utils/return-navigation';
import type { PaymentRecord } from '../../utils/payments-api';

interface PaymentsTableProps {
  payments: PaymentRecord[];
  onView: (payment: PaymentRecord) => void;
  onEdit: (payment: PaymentRecord) => void;
  onCancel: (payment: PaymentRecord) => void;
  onDelete: (payment: PaymentRecord) => void;
  onPrint: (payment: PaymentRecord) => void;
  getEditDisabledReason: (payment: PaymentRecord) => string | null;
  getCancelDisabledReason: (payment: PaymentRecord) => string | null;
  getDeleteDisabledReason: (payment: PaymentRecord) => string | null;
}

const ITEMS_PER_PAGE = 20;

export function PaymentsTable({
  payments,
  onView,
  onEdit,
  onCancel,
  onDelete,
  onPrint,
  getEditDisabledReason,
  getCancelDisabledReason,
  getDeleteDisabledReason,
}: PaymentsTableProps) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(payments.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPayments = payments.slice(startIndex, endIndex);

  const handleOpenReservation = (reservationId: string) => {
    navigate(`/reservas/${reservationId}`, {
      state: buildReturnNavigationState('/pagos', 'Volver a pagos'),
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) {
      return 'No registrado';
    }

    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <>
      {/* Tabla desktop */}
      <Card className="hidden lg:block border-0 shadow-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="text-gray-700">ID Pago</TableHead>
              <TableHead className="text-gray-700">Reserva</TableHead>
              <TableHead className="text-gray-700">Cliente</TableHead>
              <TableHead className="text-gray-700">Fecha</TableHead>
              <TableHead className="text-gray-700">Método</TableHead>
              <TableHead className="text-gray-700">Importe</TableHead>
              <TableHead className="text-gray-700">Descuento</TableHead>
              <TableHead className="text-gray-700">Total final</TableHead>
              <TableHead className="text-gray-700">Estado</TableHead>
              <TableHead className="text-gray-700 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentPayments.map((payment) => {
              const editDisabledReason = getEditDisabledReason(payment);
              const cancelDisabledReason = getCancelDisabledReason(payment);
              const deleteDisabledReason = getDeleteDisabledReason(payment);

              return (
                <TableRow key={payment.id} className="hover:bg-gray-50">
                  <TableCell className="text-gray-600 text-sm">{payment.id}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleOpenReservation(payment.reservationId)}
                      className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                    >
                      {payment.reservationId}
                    </button>
                  </TableCell>
                  <TableCell className="text-gray-900">{payment.client}</TableCell>
                  <TableCell className="text-gray-600 text-sm">
                    {formatDate(payment.date)}
                  </TableCell>
                  <TableCell>
                    <PaymentMethodBadge method={payment.method} size="sm" />
                  </TableCell>
                  <TableCell className="text-gray-900 font-medium">
                    {formatPrice(payment.amount)}
                  </TableCell>
                  <TableCell>
                    {payment.discount > 0 ? (
                      <span className="text-purple-600 font-medium">
                        -{formatPrice(payment.discount)}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-900 font-bold">
                    {formatPrice(payment.total)}
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={payment.status} size="sm" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(payment)}
                        className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(payment)}
                        className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        title={editDisabledReason ?? 'Editar'}
                        disabled={editDisabledReason !== null}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancel(payment)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title={cancelDisabledReason ?? 'Anular'}
                        disabled={cancelDisabledReason !== null}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(payment)}
                        className="h-8 w-8 p-0 text-red-700 hover:text-red-800 hover:bg-red-50"
                        title={deleteDisabledReason ?? 'Eliminar'}
                        disabled={deleteDisabledReason !== null}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPrint(payment)}
                        className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        title="Comprobante"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Tarjetas móvil */}
      <div className="lg:hidden space-y-3">
        {currentPayments.map((payment) => {
          const editDisabledReason = getEditDisabledReason(payment);
          const cancelDisabledReason = getCancelDisabledReason(payment);
          const deleteDisabledReason = getDeleteDisabledReason(payment);

          return (
            <Card key={payment.id} className="p-4 border-0 shadow-md">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-gray-900 mb-1">{payment.id}</h4>
                    <button
                      onClick={() => handleOpenReservation(payment.reservationId)}
                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {payment.reservationId}
                    </button>
                  </div>
                  <PaymentStatusBadge status={payment.status} size="sm" />
                </div>

                {/* Cliente y fecha */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 mb-1">Cliente</p>
                    <p className="text-gray-900">{payment.client}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Fecha</p>
                    <p className="text-gray-900">{formatDate(payment.date)}</p>
                  </div>
                </div>

                {/* Método de pago */}
                <div>
                  <p className="text-sm text-gray-500 mb-1.5">Método de pago</p>
                  <PaymentMethodBadge method={payment.method} />
                </div>

                {/* Importes */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center gap-1.5">
                      <Euro className="w-3.5 h-3.5" />
                      Importe
                    </span>
                    <span className="text-gray-900 font-medium">
                      {formatPrice(payment.amount)}
                    </span>
                  </div>
                  {payment.discount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        Descuento
                      </span>
                      <span className="text-purple-600 font-medium">
                        -{formatPrice(payment.discount)}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-gray-900 font-medium">Total final</span>
                    <span className="text-gray-900 font-bold text-base">
                      {formatPrice(payment.total)}
                    </span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onView(payment)}
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(payment)}
                    className="text-gray-600 hover:bg-gray-50"
                    disabled={editDisabledReason !== null}
                    title={editDisabledReason ?? 'Editar'}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCancel(payment)}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    disabled={cancelDisabledReason !== null}
                    title={cancelDisabledReason ?? 'Anular'}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Anular
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(payment)}
                    className="text-red-700 border-red-200 hover:bg-red-50"
                    disabled={deleteDisabledReason !== null}
                    title={deleteDisabledReason ?? 'Eliminar'}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPrint(payment)}
                    className="text-gray-600 hover:bg-gray-50"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Comprobante
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {totalPages > 1 && (
        <Card className="border-0 p-4 shadow-md">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-gray-600">
              Mostrando {startIndex + 1} a {Math.min(endIndex, payments.length)} de {payments.length} pagos
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(safeCurrentPage - 1, 1))}
                disabled={safeCurrentPage === 1}
                className="h-9 w-full sm:w-auto"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <p className="text-center text-sm text-gray-600 sm:hidden">
                Página {safeCurrentPage} de {totalPages}
              </p>
              <div className="hidden items-center gap-1 sm:flex">
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
                onClick={() => setCurrentPage(Math.min(safeCurrentPage + 1, totalPages))}
                disabled={safeCurrentPage === totalPages}
                className="h-9 w-full sm:w-auto"
              >
                Siguiente
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
