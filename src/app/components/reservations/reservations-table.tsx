import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Eye,
  Pencil,
  CheckCircle2,
  CreditCard,
  LogIn,
  LogOut,
  XCircle,
  Dog,
  Cat,
  User,
  Calendar,
  DoorOpen,
  ChevronLeft,
  ChevronRight,
  Activity,
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
import { ReservationStatusBadge } from './reservation-status-badge';
import {
  buildReturnNavigationState,
  type ReturnNavigationState,
} from '../../utils/return-navigation';
import {
  buildReservationPaymentPath,
  type ReservationPaymentNavigationState,
} from '../../utils/reservation-payment-navigation';
import { DeleteConfirmationModal } from '../ui/delete-confirmation-modal';
import { ConfirmReservationModal } from './confirm-reservation-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  canCancelReservation,
  getReservationCheckOutRequiredMessage,
  hasReservationActiveCheckIn,
  type ReservationRecord,
} from '../../utils/reservations-api';

interface ReservationsTableProps {
  reservations: ReservationRecord[];
  onUpdateReservation: (reservation: ReservationRecord) => Promise<void> | void;
  showClientColumn?: boolean;
  returnNavigationState?: ReturnNavigationState;
}

const DESKTOP_BREAKPOINT = 1024;
const DESKTOP_FIXED_HEIGHT = 470;
const MOBILE_FIXED_HEIGHT = 620;
const DESKTOP_ROW_HEIGHT = 60;
const MOBILE_CARD_HEIGHT = 264;
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

const normalizeDateValue = (value: string) => value.split('T')[0] ?? value;

const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export function ReservationsTable({
  reservations,
  onUpdateReservation,
  showClientColumn = true,
  returnNavigationState,
}: ReservationsTableProps) {
  const navigate = useNavigate();
  const resolvedReturnNavigationState =
    returnNavigationState ?? buildReturnNavigationState('/reservas', 'Volver a reservas');
  const [reservationPendingConfirmation, setReservationPendingConfirmation] =
    useState<ReservationRecord | null>(null);
  const [reservationPendingCancel, setReservationPendingCancel] =
    useState<ReservationRecord | null>(null);
  const [reservationPendingPayment, setReservationPendingPayment] =
    useState<{ reservation: ReservationRecord; action: 'checkin' | 'checkout' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(getFallbackItemsPerPage);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paginationRef = useRef<HTMLDivElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(reservations.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentReservations = reservations.slice(startIndex, endIndex);
  const todayDateInputValue = formatDateForInput(new Date());

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
        container.querySelector('[data-mobile-reservation-card="true"]') instanceof HTMLElement
          ? (container.querySelector('[data-mobile-reservation-card="true"]') as HTMLElement)
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
  }, [reservations.length, totalPages]);

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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const canConfirmReservation = (reservation: ReservationRecord) => reservation.status === 'pending';
  const hasCheckInAvailableStatus = (reservation: ReservationRecord) =>
    reservation.status === 'confirmed';
  const isCheckInTooEarly = (reservation: ReservationRecord) =>
    normalizeDateValue(reservation.checkIn) > todayDateInputValue;
  const canCheckIn = (reservation: ReservationRecord) =>
    hasCheckInAvailableStatus(reservation) && !isCheckInTooEarly(reservation);
  const canCheckOut = (status: ReservationRecord['status']) => status === 'in_progress';
  const isReservationPaid = (reservation: ReservationRecord) => reservation.paymentStatus === 'paid';
  const canOpenPayment = (reservation: ReservationRecord) =>
    reservation.paymentStatus !== 'paid' && reservation.status === 'confirmed';
  const canExecuteCheckIn = (reservation: ReservationRecord) =>
    canCheckIn(reservation) && isReservationPaid(reservation);
  const canExecuteCheckOut = (reservation: ReservationRecord) =>
    canCheckOut(reservation.status) && isReservationPaid(reservation);
  const canCreateTracking = (reservation: ReservationRecord) =>
    reservation.status === 'in_progress' && reservation.pets.length > 0;

  const handleViewReservation = (reservation: ReservationRecord) => {
    navigate(`/reservas/${reservation.id}`, {
      state: resolvedReturnNavigationState,
    });
  };

  const handleEditReservation = (reservation: ReservationRecord) => {
    navigate(`/reservas/${reservation.id}/editar`, {
      state: resolvedReturnNavigationState,
    });
  };

  const handleGoToPayment = (reservation: ReservationRecord) => {
    if (!canOpenPayment(reservation)) {
      toast.info('Pago no disponible', {
        description: 'Solo se pueden pagar reservas confirmadas pendientes de pago.',
      });
      return;
    }

    const returnState = resolvedReturnNavigationState;
    const paymentState: ReservationPaymentNavigationState = {
      returnTo: returnState.returnTo ?? '/reservas',
      returnLabel: returnState.returnLabel ?? 'Volver a reservas',
      returnState,
    };

    navigate(
      buildReservationPaymentPath(reservation, {
        returnTo: paymentState.returnTo,
        returnLabel: paymentState.returnLabel,
      }),
      { state: paymentState }
    );
  };

  const handleOpenTracking = (reservation: ReservationRecord) => {
    if (!canCreateTracking(reservation)) {
      toast.info('Seguimiento no disponible', {
        description: 'Solo se pueden registrar seguimientos en reservas en curso.',
      });
      return;
    }

    if (reservation.pets.length === 1) {
      navigate(`/seguimiento?petId=${reservation.pets[0].id}&openNew=1`);
      return;
    }

    navigate(`/reservas/${reservation.id}`, {
      state: resolvedReturnNavigationState,
    });
    toast.info('Selecciona la mascota', {
      description:
        'La reserva tiene varias mascotas. Elige desde el detalle de la reserva cuál quieres registrar.',
    });
  };

  const handleOpenConfirmReservation = (reservation: ReservationRecord) => {
    if (!canConfirmReservation(reservation)) {
      return;
    }

    setReservationPendingConfirmation(reservation);
  };

  const handleConfirmReservation = async (updatedReservation: ReservationRecord) => {
    try {
      await onUpdateReservation(updatedReservation);
      toast.success('Reserva confirmada', {
        description: `${updatedReservation.id} se ha confirmado correctamente.`,
      });
      setReservationPendingConfirmation(null);
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'No se pudo confirmar la reserva';
      toast.error('No se pudo confirmar la reserva', {
        description: message,
      });
    }
  };

  const handleCheckIn = async (reservation: ReservationRecord) => {
    if (!hasCheckInAvailableStatus(reservation)) {
      return;
    }

    if (isCheckInTooEarly(reservation)) {
      toast.error('Check-in no disponible', {
        description: `No puedes hacer el check-in antes del ${formatDate(reservation.checkIn)}.`,
      });
      return;
    }

    if (!isReservationPaid(reservation)) {
      setReservationPendingPayment({ reservation, action: 'checkin' });
      return;
    }

    try {
      await onUpdateReservation({
        ...reservation,
        status: 'in_progress',
        checkinData: {
          fechaHora: new Date().toISOString(),
          empleadoId: 1,
          observaciones: 'Check-in registrado desde el listado.',
        },
      });
      toast.success('Check-in registrado', {
        description: `${reservation.id} está ahora en curso.`,
      });
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'No se pudo registrar el check-in';
      toast.error('No se pudo registrar el check-in', {
        description: message,
      });
    }
  };

  const handleResolvePendingPayment = () => {
    if (!reservationPendingPayment) {
      return;
    }

    handleGoToPayment(reservationPendingPayment.reservation);
    setReservationPendingPayment(null);
  };

  const handleCheckOut = async (reservation: ReservationRecord) => {
    if (!canCheckOut(reservation.status)) {
      return;
    }

    if (!isReservationPaid(reservation)) {
      setReservationPendingPayment({ reservation, action: 'checkout' });
      return;
    }

    try {
      await onUpdateReservation({
        ...reservation,
        status: 'completed',
        checkoutData: {
          fechaHora: new Date().toISOString(),
          empleadoId: 1,
          observaciones: 'Check-out registrado desde el listado.',
        },
      });
      toast.success('Check-out registrado', {
        description: `${reservation.id} se ha finalizado correctamente.`,
      });
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'No se pudo registrar el check-out';
      toast.error('No se pudo registrar el check-out', {
        description: message,
      });
    }
  };

  const handleCancelReservation = (reservation: ReservationRecord) => {
    if (!canCancelReservation(reservation)) {
      if (hasReservationActiveCheckIn(reservation)) {
        toast.error('Cancelación no disponible', {
          description: getReservationCheckOutRequiredMessage('cancelar'),
        });
      }
      return;
    }

    setReservationPendingCancel(reservation);
  };

  const handleConfirmCancelReservation = async () => {
    if (!reservationPendingCancel) {
      return;
    }

    const updatedReservation: ReservationRecord = {
      ...reservationPendingCancel,
      status: 'cancelled',
    };

    try {
      await onUpdateReservation(updatedReservation);
      toast.success('Reserva cancelada', {
        description: 'Se ha cancelado correctamente.',
      });
      setReservationPendingCancel(null);
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'No se pudo cancelar la reserva';
      toast.error('No se pudo cancelar la reserva', {
        description: message,
      });
    }
  };

  return (
    <>
      <div ref={containerRef} className="min-w-0 space-y-4">
        <Card className="hidden min-w-0 overflow-hidden border-0 shadow-md lg:block">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="w-[110px] text-gray-700">ID Reserva</TableHead>
                {showClientColumn && (
                  <TableHead className="w-[220px] text-gray-700">Cliente</TableHead>
                )}
                <TableHead className="w-[170px] text-gray-700">Mascotas</TableHead>
                <TableHead className="w-[110px] text-gray-700">Entrada</TableHead>
                <TableHead className="w-[110px] text-gray-700">Salida</TableHead>
                <TableHead className="w-[170px] text-gray-700">Sala / Box</TableHead>
                <TableHead className="w-[130px] text-gray-700">Estado</TableHead>
                <TableHead className="w-[110px] text-gray-700">Importe</TableHead>
                <TableHead className="w-[272px] text-right text-gray-700">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentReservations.map((reservation) => (
                <TableRow key={reservation.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium text-gray-900">{reservation.id}</TableCell>
                  {showClientColumn && (
                    <TableCell>
                      <div className="min-w-0">
                        <button
                          onClick={() =>
                            navigate(`/clientes/${reservation.client.id}`, {
                              state: resolvedReturnNavigationState,
                            })
                          }
                          className="block w-full truncate text-left text-blue-600 hover:text-blue-700 hover:underline"
                          title={reservation.client.name}
                        >
                          {reservation.client.name}
                        </button>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="align-top">
                    <div className="flex max-w-full flex-wrap items-center gap-2">
                      {reservation.pets.map((pet) => (
                        <button
                          key={pet.id}
                          onClick={() =>
                            navigate(`/mascotas/${pet.id}`, {
                              state: resolvedReturnNavigationState,
                            })
                          }
                          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100"
                          title={pet.name}
                        >
                          {pet.species === 'Perro' ? (
                            <Dog className="h-3.5 w-3.5 text-blue-500" />
                          ) : (
                            <Cat className="h-3.5 w-3.5 text-purple-500" />
                          )}
                          {pet.name}
                        </button>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(reservation.checkIn)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(reservation.checkOut)}
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-600" title={reservation.room}>
                        {reservation.room}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ReservationStatusBadge status={reservation.status} size="sm" />
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">
                    {formatAmount(reservation.totalAmount)}
                  </TableCell>
                  <TableCell className="w-[272px]">
                    <div className="flex min-w-[252px] items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewReservation(reservation)}
                        className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditReservation(reservation)}
                        className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        title="Editar reserva"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenConfirmReservation(reservation)}
                        disabled={!canConfirmReservation(reservation)}
                        className={`h-8 w-8 p-0 ${
                          canConfirmReservation(reservation)
                            ? 'text-sky-600 hover:bg-sky-50 hover:text-sky-700'
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        title={
                          canConfirmReservation(reservation)
                            ? 'Confirmar reserva'
                            : 'Confirmacion no disponible'
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleGoToPayment(reservation)}
                        disabled={!canOpenPayment(reservation)}
                        className={`h-8 w-8 p-0 ${
                          canOpenPayment(reservation)
                            ? 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        title={
                          canOpenPayment(reservation)
                            ? 'Ir a pagar'
                            : 'Solo se pueden pagar reservas confirmadas pendientes de pago'
                        }
                      >
                        <CreditCard className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCheckIn(reservation)}
                        disabled={!canExecuteCheckIn(reservation)}
                        className={`h-8 w-8 p-0 ${
                          canExecuteCheckIn(reservation)
                            ? 'text-green-600 hover:bg-green-50 hover:text-green-700'
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        title={
                          canCheckIn(reservation)
                            ? isReservationPaid(reservation)
                              ? 'Registrar check-in'
                              : 'La reserva debe estar pagada antes del check-in'
                            : hasCheckInAvailableStatus(reservation) && isCheckInTooEarly(reservation)
                              ? `No se puede hacer check-in antes del ${formatDate(reservation.checkIn)}`
                            : 'Check-in no disponible'
                        }
                      >
                        <LogIn className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenTracking(reservation)}
                        disabled={!canCreateTracking(reservation)}
                        className={`h-8 w-8 p-0 ${
                          canCreateTracking(reservation)
                            ? 'text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700'
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        title={
                          canCreateTracking(reservation)
                            ? reservation.pets.length === 1
                              ? 'Registrar seguimiento'
                              : 'Elegir mascota para seguimiento'
                            : 'Seguimiento no disponible'
                        }
                      >
                        <Activity className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCheckOut(reservation)}
                        disabled={!canExecuteCheckOut(reservation)}
                        className={`h-8 w-8 p-0 ${
                          canExecuteCheckOut(reservation)
                            ? 'text-orange-600 hover:bg-orange-50 hover:text-orange-700'
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        title={
                          canCheckOut(reservation.status)
                            ? isReservationPaid(reservation)
                              ? 'Registrar check-out'
                              : 'La reserva debe estar pagada antes del check-out'
                            : 'Check-out no disponible'
                        }
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelReservation(reservation)}
                        disabled={!canCancelReservation(reservation)}
                        className={`h-8 w-8 p-0 ${
                          canCancelReservation(reservation)
                            ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                            : 'text-gray-300 cursor-not-allowed'
                        }`}
                        title={
                          canCancelReservation(reservation)
                            ? 'Cancelar reserva'
                            : hasReservationActiveCheckIn(reservation)
                              ? 'Primero debes registrar el check-out para cancelar la reserva'
                              : 'Cancelacion no disponible'
                        }
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="space-y-3 lg:hidden">
          {currentReservations.map((reservation) => (
            <Card
              key={reservation.id}
              data-mobile-reservation-card="true"
              className="border-0 p-4 shadow-md"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="mb-1 text-sm text-gray-500">ID Reserva</p>
                    <p className="font-medium text-gray-900">{reservation.id}</p>
                  </div>
                  <ReservationStatusBadge status={reservation.status} />
                </div>

                {showClientColumn && (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-sm text-gray-500">
                      <User className="h-3.5 w-3.5" />
                      Cliente
                    </p>
                    <button
                      onClick={() =>
                        navigate(`/clientes/${reservation.client.id}`, {
                          state: resolvedReturnNavigationState,
                        })
                      }
                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {reservation.client.name}
                    </button>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-sm text-gray-500">Mascotas</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {reservation.pets.map((pet) => (
                      <button
                        key={pet.id}
                        onClick={() =>
                          navigate(`/mascotas/${pet.id}`, {
                            state: resolvedReturnNavigationState,
                          })
                        }
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700"
                      >
                        {pet.species === 'Perro' ? (
                          <Dog className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <Cat className="h-3.5 w-3.5 text-purple-500" />
                        )}
                        {pet.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-sm text-gray-500">
                      <Calendar className="h-3.5 w-3.5" />
                      Entrada
                    </p>
                    <p className="text-sm text-gray-900">{formatDate(reservation.checkIn)}</p>
                  </div>
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-sm text-gray-500">
                      <Calendar className="h-3.5 w-3.5" />
                      Salida
                    </p>
                    <p className="text-sm text-gray-900">{formatDate(reservation.checkOut)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-sm text-gray-500">
                      <DoorOpen className="h-3.5 w-3.5" />
                      Sala / Box
                    </p>
                    <p className="text-sm text-gray-900">{reservation.room}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-sm text-gray-500">Importe</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatAmount(reservation.totalAmount)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 border-t border-gray-100 pt-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewReservation(reservation)}
                    className="justify-start border-blue-200 text-blue-600 hover:bg-blue-50 sm:justify-center"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditReservation(reservation)}
                    className="justify-start text-gray-600 hover:bg-gray-50 sm:justify-center"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenConfirmReservation(reservation)}
                    disabled={!canConfirmReservation(reservation)}
                    className="justify-start border-sky-200 text-sky-600 hover:bg-sky-50 disabled:border-gray-200 disabled:text-gray-300 sm:justify-center"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirmar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGoToPayment(reservation)}
                    disabled={!canOpenPayment(reservation)}
                    className="justify-start border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:border-gray-200 disabled:text-gray-300 sm:justify-center"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pagar
                  </Button>
                  {hasCheckInAvailableStatus(reservation) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCheckIn(reservation)}
                      disabled={!canExecuteCheckIn(reservation)}
                      className="justify-start border-green-200 text-green-600 hover:bg-green-50 sm:justify-center"
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Check-in
                    </Button>
                  ) : canCheckOut(reservation.status) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCheckOut(reservation)}
                      disabled={!canExecuteCheckOut(reservation)}
                      className="justify-start border-orange-200 text-orange-600 hover:bg-orange-50 sm:justify-center"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Check-out
                    </Button>
                  ) : (
                    <div />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenTracking(reservation)}
                    disabled={!canCreateTracking(reservation)}
                    className="justify-start border-cyan-200 text-cyan-600 hover:bg-cyan-50 disabled:border-gray-200 disabled:text-gray-300 sm:justify-center"
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    Seguimiento
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancelReservation(reservation)}
                    disabled={!canCancelReservation(reservation)}
                    className="justify-start border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 sm:justify-center"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar
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
                  Mostrando {startIndex + 1} a {Math.min(endIndex, reservations.length)} de{' '}
                  {reservations.length} reservas
                </p>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
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
                    onClick={handleNextPage}
                    disabled={safeCurrentPage === totalPages}
                    className="h-9 w-full sm:w-auto"
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

      <DeleteConfirmationModal
        isOpen={Boolean(reservationPendingCancel)}
        onClose={() => setReservationPendingCancel(null)}
        onConfirm={handleConfirmCancelReservation}
        title="Cancelar reserva"
        entityLabel="reserva"
        itemName={reservationPendingCancel?.id}
        description="La reserva permanecera en el historial con estado cancelada."
        question={
          reservationPendingCancel
            ? `¿Seguro que quieres cancelar ${reservationPendingCancel.id}?`
            : undefined
        }
        confirmLabel="Cancelar reserva"
      />

      {reservationPendingConfirmation && (
        <ConfirmReservationModal
          isOpen
          onClose={() => setReservationPendingConfirmation(null)}
          onConfirm={handleConfirmReservation}
          onEditReservation={handleEditReservation}
          reservation={reservationPendingConfirmation}
        />
      )}

      <AlertDialog
        open={Boolean(reservationPendingPayment)}
        onOpenChange={(open) => {
          if (!open) {
            setReservationPendingPayment(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reserva pendiente de pago</AlertDialogTitle>
            <AlertDialogDescription>
              {reservationPendingPayment
                ? `${reservationPendingPayment.reservation.id} aun no esta marcada como pagada. No se puede hacer ${
                    reservationPendingPayment.action === 'checkout' ? 'check-out' : 'check-in'
                  } hasta regularizar el pago.`
                : 'No se puede continuar hasta regularizar el pago.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResolvePendingPayment}
              className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
            >
              Ir a pagar la reserva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
