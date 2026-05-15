import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Plus, DollarSign, TrendingUp, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { DeleteConfirmationModal } from '../components/ui/delete-confirmation-modal';
import { PaymentsFilters } from '../components/payments/payments-filters';
import { PaymentsTable } from '../components/payments/payments-table';
import { NewPaymentModal } from '../components/payments/new-payment-modal';
import type { PaymentFormData } from '../components/payments/new-payment-modal';
import { ViewPaymentModal } from '../components/payments/view-payment-modal';
import { smartSearch, searchById } from '../utils/search';
import {
  useAppliedLocalReservationOverrides,
} from '../utils/reservation-local-overrides';
import {
  fetchReservationsPageData,
  getReservationCheckOutRequiredMessage,
  hasReservationActiveCheckIn,
  type ReservationRecord,
} from '../utils/reservations-api';
import {
  getReservationSubtotalBeforeDiscount,
  type ReservationPaymentNavigationState,
} from '../utils/reservation-payment-navigation';
import {
  PAYMENTS_QUERY_KEY,
  cancelPaymentRequest,
  deletePaymentRequest,
  fetchPaymentsPageData,
  payPaymentRequest,
  type PaymentRecord,
} from '../utils/payments-api';

const RESERVATIONS_QUERY_KEY = ['reservations-page'];

const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const toStartOfDay = (value: string) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const buildPrintableReceipt = (payment: PaymentRecord) => {
  const formatAmount = (value: number) =>
    new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);

  const formatDate = (value: string) =>
    value
      ? new Date(value).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : 'No registrado';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Comprobante ${payment.id}</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 32px;
        color: #111827;
      }
      .header {
        margin-bottom: 24px;
      }
      .muted {
        color: #6b7280;
      }
      .card {
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 24px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .total {
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
        font-size: 24px;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Comprobante de pago ${payment.id}</h1>
      <p class="muted">Reserva ${payment.reservationId}</p>
    </div>

    <div class="card">
      <div class="grid">
        <div>
          <p class="muted">Cliente</p>
          <p>${payment.client}</p>
        </div>
        <div>
          <p class="muted">Fecha</p>
          <p>${formatDate(payment.date)}</p>
        </div>
        <div>
          <p class="muted">Metodo</p>
          <p>${payment.method}</p>
        </div>
        <div>
          <p class="muted">Estado</p>
          <p>${payment.status}</p>
        </div>
        <div>
          <p class="muted">Importe</p>
          <p>${formatAmount(payment.amount)}</p>
        </div>
        <div>
          <p class="muted">Descuento</p>
          <p>${formatAmount(payment.discount)}</p>
        </div>
      </div>

      <div class="total">Total final: ${formatAmount(payment.total)}</div>
    </div>
  </body>
</html>`;
};

export default function PaymentsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigationState = location.state as ReservationPaymentNavigationState | null;

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') ?? '');
  const [methodFilter, setMethodFilter] = useState<string>(() => searchParams.get('method') ?? 'all');
  const [dateFilter, setDateFilter] = useState<string>(() => searchParams.get('date') ?? 'all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<PaymentRecord | null>(null);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [paymentPendingCancel, setPaymentPendingCancel] = useState<PaymentRecord | null>(null);
  const [isCancellingPayment, setIsCancellingPayment] = useState(false);
  const [paymentPendingDelete, setPaymentPendingDelete] = useState<PaymentRecord | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);

  const {
    data: backendPayments = [],
    isLoading: isPaymentsLoading,
    isError: isPaymentsError,
    error: paymentsError,
    refetch: refetchPayments,
  } = useQuery({
    queryKey: PAYMENTS_QUERY_KEY,
    queryFn: fetchPaymentsPageData,
  });

  const {
    data: backendReservations = [],
    isLoading: isReservationsLoading,
    isError: isReservationsError,
    error: reservationsError,
    refetch: refetchReservations,
  } = useQuery({
    queryKey: RESERVATIONS_QUERY_KEY,
    queryFn: fetchReservationsPageData,
  });

  const reservations = useAppliedLocalReservationOverrides<ReservationRecord>(backendReservations);
  const payments = useMemo(() => {
    return [...backendPayments].sort((firstPayment, secondPayment) => {
      const firstTimestamp = firstPayment.date ? new Date(firstPayment.date).getTime() : 0;
      const secondTimestamp = secondPayment.date ? new Date(secondPayment.date).getTime() : 0;

      if (firstTimestamp !== secondTimestamp) {
        return secondTimestamp - firstTimestamp;
      }

      return secondPayment.numericReservationId - firstPayment.numericReservationId;
    });
  }, [backendPayments]);
  const paymentsByReservationId = useMemo(
    () =>
      payments.reduce((paymentsMap, payment) => {
        if (!paymentsMap.has(payment.reservationId)) {
          paymentsMap.set(payment.reservationId, payment);
        }

        return paymentsMap;
      }, new Map<string, PaymentRecord>()),
    [payments]
  );
  const reservationsById = useMemo(
    () => new Map(reservations.map((reservation) => [reservation.id, reservation])),
    [reservations]
  );
  const getPaymentReservation = (payment: PaymentRecord) =>
    reservationsById.get(payment.reservationId) ?? null;

  const getPaymentLifecycleBlockReason = (
    payment: PaymentRecord,
    action: 'editar' | 'anular' | 'eliminar'
  ) => {
    const reservation = getPaymentReservation(payment);

    if (reservation && hasReservationActiveCheckIn(reservation)) {
      if (action === 'editar') {
        return 'No puedes editar un pago después del check-in. Primero debes registrar el check-out.';
      }

      return getReservationCheckOutRequiredMessage(action === 'anular' ? 'cancelar' : 'eliminar');
    }

    return null;
  };

  const getEditPaymentDisabledReason = (payment: PaymentRecord) => {
    if (payment.status === 'cancelled' || payment.status === 'pending') {
      return 'Solo se pueden editar pagos ya registrados.';
    }

    return getPaymentLifecycleBlockReason(payment, 'editar');
  };

  const getCancelPaymentDisabledReason = (payment: PaymentRecord) => {
    if (payment.status !== 'paid') {
      return 'Solo se pueden anular pagos registrados como pagados.';
    }

    return getPaymentLifecycleBlockReason(payment, 'anular');
  };

  const getDeletePaymentDisabledReason = (payment: PaymentRecord) => {
    if (payment.backendId == null) {
      return 'La API no devolvió un id de pago eliminable para esta fila.';
    }

    if (payment.status === 'paid') {
      return 'Primero debes anular el pago antes de eliminarlo.';
    }

    return getPaymentLifecycleBlockReason(payment, 'eliminar');
  };

  const canRegisterReservationPayment = (reservation: ReservationRecord | null | undefined) =>
    reservation != null &&
    reservation.status === 'confirmed' &&
    reservation.paymentStatus !== 'paid';

  const getPaymentDraftAmounts = (
    reservation: ReservationRecord | null | undefined,
    payment: PaymentRecord | null | undefined
  ) => {
    const normalizedPaymentAmount =
      typeof payment?.amount === 'number' && Number.isFinite(payment.amount) ? payment.amount : 0;
    const normalizedPaymentDiscount =
      typeof payment?.discount === 'number' && Number.isFinite(payment.discount) && payment.discount >= 0
        ? payment.discount
        : 0;

    if (payment?.status === 'pending' && normalizedPaymentAmount > 0) {
      return {
        amount: Number(normalizedPaymentAmount.toFixed(2)),
        discount: Number(normalizedPaymentDiscount.toFixed(2)),
      };
    }

    const reservationSubtotal = reservation ? getReservationSubtotalBeforeDiscount(reservation) : 0;
    const reservationDiscount =
      typeof reservation?.discount === 'number' && Number.isFinite(reservation.discount)
        ? reservation.discount
        : 0;

    if (reservationSubtotal > 0) {
      return {
        amount: reservationSubtotal,
        discount: Number(reservationDiscount.toFixed(2)),
      };
    }

    return {
      amount: Number(normalizedPaymentAmount.toFixed(2)),
      discount: Number(normalizedPaymentDiscount.toFixed(2)),
    };
  };

  const reservationOptions = useMemo(
    () => {
      const optionsByReservation = new Map<
        string,
        {
          id: string;
          client: string;
          amount: number;
          discount: number;
        }
      >();

      reservations
        .filter((reservation) => canRegisterReservationPayment(reservation))
        .forEach((reservation) => {
          const payment = paymentsByReservationId.get(reservation.id);
          const draftAmounts = getPaymentDraftAmounts(reservation, payment);

          if (payment?.status === 'paid') {
            return;
          }

          optionsByReservation.set(reservation.id, {
            id: reservation.id,
            client: reservation.client.name,
            amount: draftAmounts.amount,
            discount: draftAmounts.discount,
          });
        });

      payments
        .filter((payment) => payment.status === 'pending')
        .forEach((payment) => {
          const reservation = reservationsById.get(payment.reservationId);

          if (!canRegisterReservationPayment(reservation)) {
            return;
          }

          if (optionsByReservation.has(payment.reservationId)) {
            return;
          }

          const draftAmounts = getPaymentDraftAmounts(reservation, payment);

          optionsByReservation.set(payment.reservationId, {
            id: payment.reservationId,
            client: payment.client,
            amount: draftAmounts.amount,
            discount: draftAmounts.discount,
          });
        });

      return Array.from(optionsByReservation.values());
    },
    [payments, paymentsByReservationId, reservations, reservationsById]
  );

  const getReservationRequestId = (
    reservationId: string,
    fallbackPayment?: PaymentRecord | null
  ) => {
    const payment = fallbackPayment ?? paymentsByReservationId.get(reservationId) ?? null;

    return payment?.numericReservationId ?? Number(String(reservationId).match(/(\d+)/)?.[0] ?? 0);
  };

  const getExistingPaymentRequestId = (
    reservationId: string,
    fallbackPayment?: PaymentRecord | null
  ) => {
    const payment = fallbackPayment ?? paymentsByReservationId.get(reservationId) ?? null;

    return payment?.backendId ?? getReservationRequestId(reservationId, fallbackPayment);
  };

  const upsertPaymentInCache = (payment: PaymentRecord) => {
    if (payment.backendId == null) {
      return;
    }

    queryClient.setQueryData<PaymentRecord[]>(PAYMENTS_QUERY_KEY, (currentPayments = []) => {
      const nextPayments = currentPayments.filter(
        (currentPayment) =>
          currentPayment.id !== payment.id &&
          currentPayment.reservationId !== payment.reservationId &&
          currentPayment.backendId !== payment.backendId
      );

      return [payment, ...nextPayments];
    });
  };

  const withForcedPaymentStatus = (
    payment: PaymentRecord,
    nextStatus: PaymentRecord['status']
  ): PaymentRecord => ({
    ...payment,
    status: nextStatus,
  });

  const buildFallbackSavedPayment = (
    paymentData: PaymentFormData,
    existingPayment?: PaymentRecord | null
  ): PaymentRecord => ({
    id: existingPayment?.id ?? `TEMP-${paymentData.reservationId}`,
    backendId: existingPayment?.backendId ?? null,
    reservationId: paymentData.reservationId,
    numericReservationId: getReservationRequestId(paymentData.reservationId, existingPayment),
    client: paymentData.client.trim(),
    date: existingPayment?.date || new Date().toISOString(),
    method: paymentData.method,
    amount: paymentData.amount,
    discount: paymentData.discount,
    total: Number(Math.max(paymentData.amount - paymentData.discount, 0).toFixed(2)),
    status: 'paid',
  });

  const isValidReservationCode = (value?: string | null) => /^RES-\d+$/i.test(value?.trim() ?? '');

  const mergeSavedPaymentWithFallback = (
    fallbackPayment: PaymentRecord,
    nextPayment: PaymentRecord,
    forcedStatus: PaymentRecord['status']
  ): PaymentRecord => ({
    ...fallbackPayment,
    ...nextPayment,
    id: nextPayment.id || fallbackPayment.id,
    backendId: nextPayment.backendId ?? fallbackPayment.backendId,
    reservationId: isValidReservationCode(nextPayment.reservationId)
      ? nextPayment.reservationId
      : fallbackPayment.reservationId,
    numericReservationId:
      Number.isFinite(nextPayment.numericReservationId) && nextPayment.numericReservationId > 0
        ? nextPayment.numericReservationId
        : fallbackPayment.numericReservationId,
    client: nextPayment.client || fallbackPayment.client,
    date: nextPayment.date || fallbackPayment.date,
    method: nextPayment.method || fallbackPayment.method,
    amount:
      Number.isFinite(nextPayment.amount) && nextPayment.amount > 0
        ? nextPayment.amount
        : fallbackPayment.amount,
    discount:
      Number.isFinite(nextPayment.discount) && nextPayment.discount >= 0
        ? nextPayment.discount
        : fallbackPayment.discount,
    total: Number.isFinite(nextPayment.total) &&
      nextPayment.total >= 0 &&
      Math.abs(
        nextPayment.total - Math.max((nextPayment.amount || fallbackPayment.amount) - (nextPayment.discount ?? fallbackPayment.discount), 0)
      ) <= 0.01
        ? nextPayment.total
        : fallbackPayment.total,
    status: forcedStatus,
  });

  const resolveAlreadyPaidPayment = (reservationId: string) => {
    const payment = paymentsByReservationId.get(reservationId);

    return payment?.status === 'paid' ? payment : null;
  };

  const createPaymentInitialValues = useMemo<Partial<PaymentFormData>>(() => {
    const reservationId = searchParams.get('reservationId') ?? '';
    const reservation = reservations.find((item) => item.id === reservationId);
    const payment = reservationId ? paymentsByReservationId.get(reservationId) ?? null : null;
    const draftAmounts = getPaymentDraftAmounts(reservation, payment);
    const rawAmount = Number(searchParams.get('amount') ?? 0);
    const rawDiscount = Number(searchParams.get('discount') ?? 0);

    return {
      reservationId,
      client: reservation?.client.name ?? searchParams.get('client') ?? '',
      amount:
        draftAmounts.amount > 0
          ? draftAmounts.amount
          : Number.isFinite(rawAmount)
            ? rawAmount
            : 0,
      discount:
        draftAmounts.amount > 0 || draftAmounts.discount > 0
          ? draftAmounts.discount
          : Number.isFinite(rawDiscount)
            ? rawDiscount
            : 0,
    };
  }, [paymentsByReservationId, reservations, searchParams]);

  const createModalKey = useMemo(
    () =>
      [
        searchParams.get('action') ?? 'idle',
        createPaymentInitialValues.reservationId ?? 'manual',
        createPaymentInitialValues.amount ?? '0',
        createPaymentInitialValues.discount ?? '0',
      ].join(':'),
    [createPaymentInitialValues, searchParams]
  );

  const editModalInitialValues = useMemo<Partial<PaymentFormData>>(() => {
    if (!editingPayment) {
      return {};
    }

    return {
      reservationId: editingPayment.reservationId,
      client: editingPayment.client,
      amount: editingPayment.amount,
      discount: editingPayment.discount,
      method: editingPayment.method,
    };
  }, [editingPayment]);

  const clearPaymentSearchParams = () => {
    const nextSearchParams = new URLSearchParams(searchParams);

    ['action', 'reservationId', 'client', 'amount', 'discount', 'returnTo', 'returnLabel'].forEach(
      (key) => nextSearchParams.delete(key)
    );

    setSearchParams(nextSearchParams);
  };

  useEffect(() => {
    const isCreateAction = searchParams.get('action') === 'new';
    const reservationId = searchParams.get('reservationId');

    if (!isCreateAction) {
      setIsCreateModalOpen(false);
      return;
    }

    if (reservationId && isReservationsLoading) {
      return;
    }

    if (reservationId) {
      const reservation = reservationsById.get(reservationId);

      if (!canRegisterReservationPayment(reservation)) {
        setIsCreateModalOpen(false);
        clearPaymentSearchParams();
        return;
      }
    }

    setIsCreateModalOpen(true);
  }, [isReservationsLoading, reservationsById, searchParams]);

  const syncReservationPaymentStatus = (
    reservationId: string,
    nextStatus: 'paid' | 'pending'
  ) => {
    const reservationsInCache =
      queryClient.getQueryData<ReservationRecord[]>(RESERVATIONS_QUERY_KEY) ?? [];
    const cachedReservation =
      reservationsInCache.find((reservation) => reservation.id === reservationId) ??
      reservations.find((reservation) => reservation.id === reservationId) ??
      queryClient.getQueryData<ReservationRecord>(['reservation-detail', reservationId]) ??
      null;

    if (!cachedReservation) {
      return;
    }

    const updatedReservation: ReservationRecord = {
      ...cachedReservation,
      paymentStatus: nextStatus,
    };

    queryClient.setQueryData<ReservationRecord[]>(RESERVATIONS_QUERY_KEY, (currentReservations = []) => {
      const hasReservation = currentReservations.some(
        (reservation) => reservation.id === reservationId
      );

      if (!hasReservation) {
        return [updatedReservation, ...currentReservations];
      }

      return currentReservations.map((reservation) =>
        reservation.id === reservationId ? updatedReservation : reservation
      );
    });

    queryClient.setQueryData<ReservationRecord>(
      ['reservation-detail', reservationId],
      updatedReservation
    );
    queryClient.setQueriesData<ReservationRecord>(
      { queryKey: ['reservation-detail'] },
      (currentReservation) =>
        currentReservation?.id === reservationId
          ? { ...currentReservation, paymentStatus: nextStatus }
          : currentReservation
    );
  };

  const handleNewPayment = () => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('action', 'new');
    setSearchParams(nextSearchParams);
  };

  const handleCloseCreateModal = () => {
    const returnTo = searchParams.get('returnTo');
    setIsCreateModalOpen(false);

    if (returnTo) {
      clearPaymentSearchParams();
      navigate(returnTo, navigationState?.returnState ? { state: navigationState.returnState } : undefined);
      return;
    }

    clearPaymentSearchParams();
  };

  const handleCreatePayment = async (paymentData: PaymentFormData) => {
    try {
      const reservation = reservationsById.get(paymentData.reservationId);

      if (!canRegisterReservationPayment(reservation)) {
        toast.info('Pago no disponible', {
          description: 'Solo se pueden registrar pagos de reservas confirmadas pendientes de pago.',
        });
        handleCloseCreateModal();
        return;
      }

      const alreadyPaidPayment = resolveAlreadyPaidPayment(paymentData.reservationId);

      if (alreadyPaidPayment) {
        upsertPaymentInCache(alreadyPaidPayment);
        syncReservationPaymentStatus(alreadyPaidPayment.reservationId, 'paid');
        toast.info('La reserva ya estaba pagada', {
          description: `${alreadyPaidPayment.reservationId} ya tiene un pago registrado.`,
        });
        handleCloseCreateModal();
        return;
      }

      const paymentRequestId = getExistingPaymentRequestId(paymentData.reservationId);

      if (!paymentRequestId) {
        throw new Error('No se pudo identificar la reserva asociada al pago');
      }

      const fallbackPayment = buildFallbackSavedPayment(paymentData);
      const savedPayment = mergeSavedPaymentWithFallback(
        fallbackPayment,
        await payPaymentRequest(paymentRequestId, paymentData),
        'paid'
      );
      upsertPaymentInCache(savedPayment);
      syncReservationPaymentStatus(savedPayment.reservationId, 'paid');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({
          queryKey: ['reservation-detail', savedPayment.reservationId],
        }),
      ]);
      toast.success('Pago registrado', {
        description: `${savedPayment.reservationId} se ha marcado como pagada.`,
      });
      handleCloseCreateModal();
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : 'No se pudo registrar el pago';
      toast.error('No se pudo registrar el pago', {
        description: message,
      });
    }
  };

  const handleSaveEditedPayment = async (paymentData: PaymentFormData) => {
    if (!editingPayment) {
      return;
    }

    try {
      const paymentRequestId = getExistingPaymentRequestId(paymentData.reservationId, editingPayment);

      if (!paymentRequestId) {
        throw new Error('No se pudo identificar el pago a editar');
      }

      const fallbackPayment = buildFallbackSavedPayment(paymentData, editingPayment);
      const savedPayment = mergeSavedPaymentWithFallback(
        fallbackPayment,
        await payPaymentRequest(paymentRequestId, paymentData),
        'paid'
      );
      upsertPaymentInCache(savedPayment);
      syncReservationPaymentStatus(savedPayment.reservationId, 'paid');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({
          queryKey: ['reservation-detail', savedPayment.reservationId],
        }),
      ]);
      toast.success('Pago actualizado', {
        description: `${savedPayment.id} se ha actualizado correctamente.`,
      });
      setEditingPayment(null);
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'No se pudo actualizar el pago';
      toast.error('No se pudo actualizar el pago', {
        description: message,
      });
    }
  };

  const handleEditPayment = (payment: PaymentRecord) => {
    const disabledReason = getEditPaymentDisabledReason(payment);

    if (disabledReason) {
      toast.info('Edición no disponible', {
        description: disabledReason,
      });
      return;
    }

    setEditingPayment(payment);
  };

  const handleRequestCancelPayment = (payment: PaymentRecord) => {
    const disabledReason = getCancelPaymentDisabledReason(payment);

    if (disabledReason) {
      toast.info('Anulación no disponible', {
        description: disabledReason,
      });
      return;
    }

    setPaymentPendingCancel(payment);
  };

  const handleRequestDeletePayment = (payment: PaymentRecord) => {
    const disabledReason = getDeletePaymentDisabledReason(payment);

    if (disabledReason) {
      toast.info('Eliminación no disponible', {
        description: disabledReason,
      });
      return;
    }

    setPaymentPendingDelete(payment);
  };

  const handleConfirmCancelPayment = async () => {
    if (!paymentPendingCancel) {
      return;
    }

    const disabledReason = getCancelPaymentDisabledReason(paymentPendingCancel);

    if (disabledReason) {
      toast.info('Anulación no disponible', {
        description: disabledReason,
      });
      setPaymentPendingCancel(null);
      return;
    }

    setIsCancellingPayment(true);

    try {
      const paymentRequestId = getExistingPaymentRequestId(
        paymentPendingCancel.reservationId,
        paymentPendingCancel
      );

      if (!paymentRequestId) {
        throw new Error('No se pudo identificar el pago a anular');
      }

      const cancelledPayment = mergeSavedPaymentWithFallback(
        withForcedPaymentStatus(paymentPendingCancel, 'cancelled'),
        await cancelPaymentRequest(paymentRequestId),
        'cancelled'
      );
      upsertPaymentInCache(cancelledPayment);

      syncReservationPaymentStatus(paymentPendingCancel.reservationId, 'pending');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({
          queryKey: ['reservation-detail', paymentPendingCancel.reservationId],
        }),
      ]);

      toast.success('Pago anulado', {
        description: 'Se ha anulado correctamente.',
      });
      setPaymentPendingCancel(null);
    } catch (cancelError) {
      const message =
        cancelError instanceof Error ? cancelError.message : 'No se pudo anular el pago';
      toast.error('No se pudo anular el pago', {
        description: message,
      });
    } finally {
      setIsCancellingPayment(false);
    }
  };

  const removePaymentFromCache = (payment: PaymentRecord) => {
    queryClient.setQueryData<PaymentRecord[]>(PAYMENTS_QUERY_KEY, (currentPayments = []) =>
      currentPayments.filter(
        (currentPayment) =>
          currentPayment.id !== payment.id &&
          currentPayment.backendId !== payment.backendId &&
          currentPayment.reservationId !== payment.reservationId
      )
    );
  };

  const handleConfirmDeletePayment = async () => {
    if (!paymentPendingDelete) {
      return;
    }

    const disabledReason = getDeletePaymentDisabledReason(paymentPendingDelete);

    if (disabledReason) {
      toast.info('Eliminación no disponible', {
        description: disabledReason,
      });
      setPaymentPendingDelete(null);
      return;
    }

    if (paymentPendingDelete.backendId == null) {
      toast.info('Eliminación no disponible', {
        description: 'La API no devolvió un id de pago eliminable para esta fila.',
      });
      setPaymentPendingDelete(null);
      return;
    }

    setIsDeletingPayment(true);

    try {
      await deletePaymentRequest(paymentPendingDelete.backendId);
      removePaymentFromCache(paymentPendingDelete);
      syncReservationPaymentStatus(paymentPendingDelete.reservationId, 'pending');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({
          queryKey: ['reservation-detail', paymentPendingDelete.reservationId],
        }),
      ]);
      toast.success('Pago eliminado', {
        description: `${paymentPendingDelete.id} se ha eliminado correctamente.`,
      });
      setPaymentPendingDelete(null);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el pago';
      toast.error('No se pudo eliminar el pago', {
        description: message,
      });
    } finally {
      setIsDeletingPayment(false);
    }
  };

  const handlePrintPayment = (payment: PaymentRecord) => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=840,height=960');

    if (!printWindow) {
      toast.error('No se pudo abrir el comprobante', {
        description: 'Permite las ventanas emergentes para imprimir el pago.',
      });
      return;
    }

    printWindow.document.write(buildPrintableReceipt(payment));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 150);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setMethodFilter('all');
    setDateFilter('all');
    const nextSearchParams = new URLSearchParams(searchParams);
    ['search', 'method', 'status', 'date'].forEach((key) => nextSearchParams.delete(key));
    setSearchParams(nextSearchParams);
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      searchTerm === '' ||
      searchById(searchTerm, payment.id) ||
      searchById(searchTerm, payment.reservationId) ||
      smartSearch(searchTerm, payment.client);

    const matchesMethod = methodFilter === 'all' || payment.method === methodFilter;

    let matchesDate = true;

    if (dateFilter !== 'all') {
      if (!payment.date) {
        matchesDate = false;
      } else {
        const today = getToday();
        const paymentDate = toStartOfDay(payment.date);
        const dayDifference = Math.floor(
          (today.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (dateFilter === 'today') {
          matchesDate = today.getTime() === paymentDate.getTime();
        } else if (dateFilter === 'last_7_days') {
          matchesDate = dayDifference >= 0 && dayDifference <= 7;
        } else if (dateFilter === 'last_30_days') {
          matchesDate = dayDifference >= 0 && dayDifference <= 30;
        } else if (dateFilter === 'this_month') {
          matchesDate =
            paymentDate.getMonth() === today.getMonth() &&
            paymentDate.getFullYear() === today.getFullYear();
        }
      }
    }

    return matchesSearch && matchesMethod && matchesDate;
  });

  const totalPayments = payments.length;
  const totalCollected = payments
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + payment.total, 0);
  const totalDiscounts = payments.reduce((sum, payment) => sum + payment.discount, 0);

  if (isPaymentsLoading || isReservationsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="mb-1 text-gray-900">Gestión de pagos</h2>
            <p className="text-sm text-gray-600">Cargando pagos y reservas...</p>
          </div>
        </div>
        <Card className="border-0 p-8 shadow-md">
          <p className="text-sm text-gray-600">Cargando listado de pagos...</p>
        </Card>
      </div>
    );
  }

  if (isPaymentsError || isReservationsError) {
    const resolvedError = paymentsError ?? reservationsError;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-1 text-gray-900">Gestión de pagos</h2>
          <p className="text-sm text-gray-600">
            No se pudieron cargar los datos.{' '}
            {resolvedError instanceof Error ? resolvedError.message : 'Inténtalo de nuevo.'}
          </p>
        </div>
        <Card className="border-0 p-8 shadow-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">No se pudo conectar con el backend.</p>
            <Button
              variant="outline"
              onClick={() => {
                void refetchPayments();
                void refetchReservations();
              }}
              className="border-gray-200"
            >
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-1 text-gray-900">Gestión de pagos</h2>
          <p className="text-sm text-gray-600">
            Administra los pagos asociados a las reservas del hotel de mascotas
          </p>
        </div>
        <Button
          onClick={handleNewPayment}
          className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo pago
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-gray-600">Pagos registrados</p>
              <p className="text-2xl font-bold text-gray-900">{totalPayments}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-gray-600">Importe cobrado</p>
              <p className="text-2xl font-bold text-green-600">
                {totalCollected.toFixed(2)} €
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-sm text-gray-600">Descuentos aplicados</p>
              <p className="text-2xl font-bold text-purple-600">
                {totalDiscounts.toFixed(2)} €
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600">
              <Tag className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>
      </div>

      <PaymentsFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        methodFilter={methodFilter}
        onMethodChange={setMethodFilter}
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        onClearFilters={handleClearFilters}
      />

      <PaymentsTable
        payments={filteredPayments}
        onView={setViewingPayment}
        onEdit={handleEditPayment}
        onCancel={handleRequestCancelPayment}
        onDelete={handleRequestDeletePayment}
        onPrint={handlePrintPayment}
        getEditDisabledReason={getEditPaymentDisabledReason}
        getCancelDisabledReason={getCancelPaymentDisabledReason}
        getDeleteDisabledReason={getDeletePaymentDisabledReason}
      />

      {filteredPayments.length === 0 && (
        <Card className="border-0 p-12 text-center shadow-md">
          <div className="mx-auto max-w-md">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <DollarSign className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-gray-900">No se encontraron pagos</h3>
            <p className="mb-6 text-sm text-gray-600">
              {searchTerm || methodFilter !== 'all' || dateFilter !== 'all'
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Comienza registrando el primer pago en el sistema'}
            </p>
            {!searchTerm && methodFilter === 'all' && dateFilter === 'all' && (
              <Button
                onClick={handleNewPayment}
                className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo pago
              </Button>
            )}
          </div>
        </Card>
      )}

      <NewPaymentModal
        key={createModalKey}
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSubmit={handleCreatePayment}
        reservationOptions={reservationOptions}
        initialValues={createPaymentInitialValues}
        mode="create"
      />

      <NewPaymentModal
        key={editingPayment ? `edit:${editingPayment.id}` : 'edit:closed'}
        isOpen={editingPayment !== null}
        onClose={() => setEditingPayment(null)}
        onSubmit={handleSaveEditedPayment}
        reservationOptions={reservationOptions}
        initialValues={editModalInitialValues}
        mode="edit"
      />

      <ViewPaymentModal
        isOpen={viewingPayment !== null}
        payment={viewingPayment}
        onClose={() => setViewingPayment(null)}
      />

      <DeleteConfirmationModal
        isOpen={paymentPendingCancel !== null}
        onClose={() => setPaymentPendingCancel(null)}
        onConfirm={handleConfirmCancelPayment}
        title="Anular pago"
        entityLabel="pago"
        itemName={paymentPendingCancel?.id}
        question={
          paymentPendingCancel
            ? `¿Seguro que quieres anular ${paymentPendingCancel.id}?`
            : undefined
        }
        description="La reserva volverá a quedar como pendiente de pago."
        confirmLabel="Anular pago"
        isDeleting={isCancellingPayment}
      />

      <DeleteConfirmationModal
        isOpen={paymentPendingDelete !== null}
        onClose={() => setPaymentPendingDelete(null)}
        onConfirm={handleConfirmDeletePayment}
        title="Eliminar pago"
        entityLabel="pago"
        itemName={paymentPendingDelete?.id}
        question={
          paymentPendingDelete
            ? `¿Seguro que quieres eliminar ${paymentPendingDelete.id}?`
            : undefined
        }
        description="El registro se eliminará mediante DELETE y la reserva volverá a quedar pendiente de pago."
        confirmLabel="Eliminar pago"
        isDeleting={isDeletingPayment}
      />
    </div>
  );
}
