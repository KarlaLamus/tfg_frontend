import { formatReservationCode } from './reservations-api';
import { API_BASE_URL, apiFetch } from './api-client';

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';
export type PaymentStatus = 'paid' | 'pending' | 'cancelled';

export interface PaymentRecord {
  id: string;
  backendId: number | null;
  reservationId: string;
  numericReservationId: number;
  client: string;
  date: string;
  method: PaymentMethod;
  amount: number;
  discount: number;
  total: number;
  status: PaymentStatus;
  isLocalOnly?: boolean;
}

export interface PaymentPayInput {
  reservationId?: string;
  amount: number;
  discount: number;
  method: PaymentMethod;
}

class PaymentApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PaymentApiRequestError';
    this.status = status;
  }
}

interface BackendPaymentListItem {
  idPago: number | null;
  idreserva?: number | null;
  idReserva?: number | null;
  reservaId?: number | null;
  nombreCliente: string;
  fechaPago: string | null;
  metodo: string | null;
  importe: number;
  descuento: number;
  total: number;
  estado: string;
}

export const PAYMENTS_API_URL = API_BASE_URL;
export const PAYMENTS_QUERY_KEY = ['payments-page'];

const formatPaymentCode = (id: number) => `P-${String(id).padStart(3, '0')}`;

const mapBackendMethodToUi = (method: string | null): PaymentMethod => {
  switch ((method ?? '').toUpperCase()) {
    case 'TARJETA':
      return 'card';
    case 'EFECTIVO':
      return 'cash';
    case 'TRANSFERENCIA':
      return 'transfer';
    default:
      return 'other';
  }
};

const mapUiMethodToBackend = (method: PaymentMethod) => {
  switch (method) {
    case 'card':
      return 'TARJETA';
    case 'cash':
      return 'EFECTIVO';
    case 'transfer':
      return 'TRANSFERENCIA';
    case 'other':
    default:
      return 'OTRO';
  }
};

const hasBackendRegisteredPayment = (payment: Pick<BackendPaymentListItem, 'estado' | 'fechaPago'>) =>
  payment.estado.toUpperCase() === 'PAGADO' && Boolean(payment.fechaPago?.trim());

const mapBackendStatusToUi = (payment: Pick<BackendPaymentListItem, 'estado' | 'fechaPago'>): PaymentStatus => {
  if (payment.estado.toUpperCase() === 'PAGADO' && !hasBackendRegisteredPayment(payment)) {
    return 'pending';
  }

  switch (payment.estado.toUpperCase()) {
    case 'PAGADO':
      return 'paid';
    case 'CANCELADO':
    case 'ANULADO':
      return 'cancelled';
    case 'PENDIENTE':
    default:
      return 'pending';
  }
};

const mapBackendDiscountToAmount = (amount: number, rawDiscount: number) => {
  if (rawDiscount > 0 && rawDiscount <= 1) {
    return Math.max(amount * rawDiscount, 0);
  }

  return Math.max(rawDiscount, 0);
};

const buildApiErrorMessage = (rawBody: string, status: number, fallbackMessage: string) => {
  if (!rawBody.trim()) {
    return `${fallbackMessage} (HTTP ${status})`;
  }

  try {
    const parsedBody = JSON.parse(rawBody) as {
      message?: string;
      error?: string;
      detalle?: string;
      details?: string;
    };
    const detail =
      parsedBody.message?.trim() ||
      parsedBody.detalle?.trim() ||
      parsedBody.details?.trim() ||
      parsedBody.error?.trim();

    if (detail) {
      return `${fallbackMessage}. ${detail} (HTTP ${status})`;
    }
  } catch {
    return rawBody.trim();
  }

  return `${fallbackMessage} (HTTP ${status})`;
};

const mapPaymentPayInputToBackend = (payment: PaymentPayInput) => ({
  metodo: mapUiMethodToBackend(payment.method),
});

const mapPaymentPayInputToBackendWithTotals = (payment: PaymentPayInput) => ({
  ...mapPaymentPayInputToBackend(payment),
  importe: payment.amount,
  descuento: payment.discount,
  total: Number(Math.max(payment.amount - payment.discount, 0).toFixed(2)),
});

const mapPaymentPayInputToBackendExtended = (payment: PaymentPayInput) => {
  const numericReservationId =
    Number(String(payment.reservationId ?? '').match(/(\d+)/)?.[0] ?? 0) || undefined;

  return {
    ...mapPaymentPayInputToBackendWithTotals(payment),
    ...(numericReservationId
      ? {
          idreserva: numericReservationId,
          idReserva: numericReservationId,
          reservaId: numericReservationId,
        }
      : {}),
  };
};

const extractPaymentReservationNumericId = (paymentId: number, payment: PaymentPayInput) =>
  Number(String(payment.reservationId ?? '').match(/(\d+)/)?.[0] ?? 0) || paymentId;

const extractBackendPaymentReservationNumericId = (payment: BackendPaymentListItem) => {
  const candidates = [payment.idreserva, payment.idReserva, payment.reservaId];

  for (const candidate of candidates) {
    const numericCandidate = Number(candidate);

    if (Number.isFinite(numericCandidate) && numericCandidate > 0) {
      return numericCandidate;
    }
  }

  return 0;
};

const isPersistedBackendPayment = (payment: PaymentRecord) => payment.backendId != null;

const mapBackendPaymentToRecord = (payment: BackendPaymentListItem): PaymentRecord => {
  const numericReservationId = extractBackendPaymentReservationNumericId(payment);
  const reservationId = numericReservationId > 0 ? formatReservationCode(numericReservationId) : '';
  const amount = Number(payment.importe ?? 0);
  const explicitTotal = Number(payment.total ?? NaN);
  const rawDiscount = Number(payment.descuento ?? 0);
  const discount = mapBackendDiscountToAmount(amount, rawDiscount);
  const derivedTotal = Number(Math.max(amount - discount, 0).toFixed(2));
  const total =
    Number.isFinite(explicitTotal) &&
    explicitTotal >= 0 &&
    Math.abs(explicitTotal - derivedTotal) <= 0.01
      ? explicitTotal
      : derivedTotal;

  return {
    id: payment.idPago != null ? formatPaymentCode(payment.idPago) : '',
    backendId: payment.idPago,
    reservationId,
    numericReservationId,
    client: payment.nombreCliente,
    date: payment.fechaPago ?? '',
    method: mapBackendMethodToUi(payment.metodo),
    amount,
    discount,
    total,
    status: mapBackendStatusToUi(payment),
  };
};

const getPaymentTimestamp = (payment: Pick<PaymentRecord, 'date'>) => {
  if (!payment.date) {
    return 0;
  }

  const timestamp = new Date(payment.date).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const comparePaymentsByRecency = (firstPayment: PaymentRecord, secondPayment: PaymentRecord) => {
  const timestampDifference =
    getPaymentTimestamp(secondPayment) - getPaymentTimestamp(firstPayment);

  if (timestampDifference !== 0) {
    return timestampDifference;
  }

  const backendIdDifference =
    (secondPayment.backendId ?? Number.MIN_SAFE_INTEGER) -
    (firstPayment.backendId ?? Number.MIN_SAFE_INTEGER);

  if (backendIdDifference !== 0) {
    return backendIdDifference;
  }

  return secondPayment.id.localeCompare(firstPayment.id);
};

const keepLatestPaymentPerReservation = (payments: PaymentRecord[]) => {
  const latestPayments = new Map<string, PaymentRecord>();

  [...payments]
    .sort(comparePaymentsByRecency)
    .forEach((payment) => {
      if (!latestPayments.has(payment.reservationId)) {
        latestPayments.set(payment.reservationId, payment);
      }
    });

  return Array.from(latestPayments.values());
};

export const fetchPaymentsPageData = async (): Promise<PaymentRecord[]> => {
  const response = await apiFetch(`${PAYMENTS_API_URL}/api/pagos`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('No se pudieron cargar los pagos');
  }

  const data: BackendPaymentListItem[] = await response.json();

  return keepLatestPaymentPerReservation(
    data.map(mapBackendPaymentToRecord).filter(isPersistedBackendPayment)
  );
};

export const payPaymentRequest = async (
  paymentId: number,
  payment: PaymentPayInput
): Promise<PaymentRecord> => {
  const payloadVariants = [
    { label: 'payload mínimo', body: mapPaymentPayInputToBackend(payment) },
    { label: 'payload con totales', body: mapPaymentPayInputToBackendWithTotals(payment) },
    { label: 'payload extendido', body: mapPaymentPayInputToBackendExtended(payment) },
  ];
  const numericReservationId = extractPaymentReservationNumericId(paymentId, payment);
  const fallbackRequestIds = new Set<number>([paymentId]);

  try {
    const matchingPayment = (await fetchPaymentsPageData()).find(
      (currentPayment) =>
        currentPayment.numericReservationId === numericReservationId &&
        currentPayment.backendId != null
    );

    if (matchingPayment?.backendId) {
      fallbackRequestIds.add(matchingPayment.backendId);
    }
  } catch {
    // Si no se puede refrescar la lista, seguimos con el id recibido.
  }

  const requestIds = Array.from(fallbackRequestIds);
  const attemptErrors: string[] = [];

  for (const requestId of requestIds) {
    for (const payloadVariant of payloadVariants) {
      const response = await apiFetch(`${PAYMENTS_API_URL}/api/pagos/${requestId}/pagar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payloadVariant.body),
      });

      const rawBody = await response.text();

      if (!response.ok) {
        const paidPayment = response.status >= 500
          ? (await fetchPaymentsPageData()).find(
              (currentPayment) =>
                currentPayment.numericReservationId === numericReservationId &&
                currentPayment.status === 'paid'
            )
          : null;

        if (paidPayment) {
          return paidPayment;
        }

        const errorMessage = buildApiErrorMessage(
          rawBody,
          response.status,
          'No se pudo registrar el pago'
        );
        attemptErrors.push(`id ${requestId}, ${payloadVariant.label}: ${errorMessage}`);

        if ([401, 403].includes(response.status)) {
          throw new PaymentApiRequestError(response.status, errorMessage);
        }

        continue;
      }

      if (!rawBody.trim()) {
        const paidPayment = payment.reservationId
          ? (await fetchPaymentsPageData()).find(
              (currentPayment) =>
                currentPayment.reservationId === payment.reservationId &&
                currentPayment.status === 'paid'
            )
          : null;

        if (paidPayment) {
          return paidPayment;
        }

        attemptErrors.push(`id ${requestId}, ${payloadVariant.label}: la API no devolvió datos`);
        continue;
      }

      const mappedPayment = mapBackendPaymentToRecord(JSON.parse(rawBody) as BackendPaymentListItem);

      if (isPersistedBackendPayment(mappedPayment)) {
        return mappedPayment;
      }

      const paidPayment = payment.reservationId
        ? (await fetchPaymentsPageData()).find(
            (currentPayment) =>
              currentPayment.reservationId === payment.reservationId &&
              currentPayment.status === 'paid'
          )
        : null;

      if (paidPayment) {
        return paidPayment;
      }

      attemptErrors.push(`id ${requestId}, ${payloadVariant.label}: la API no devolvió un idPago persistido`);
    }
  }

  throw new Error(
    attemptErrors.length > 0
      ? `No se pudo registrar el pago. ${attemptErrors.join(' | ')}`
      : 'No se pudo registrar el pago'
  );
};

export const cancelPaymentRequest = async (paymentId: number): Promise<PaymentRecord> => {
  const response = await apiFetch(`${PAYMENTS_API_URL}/api/pagos/${paymentId}/anular`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
    },
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(rawBody, response.status, 'No se pudo anular el pago'));
  }

  if (!rawBody.trim()) {
    throw new Error('La API no devolvio datos del pago anulado');
  }

  return mapBackendPaymentToRecord(JSON.parse(rawBody) as BackendPaymentListItem);
};

export const deletePaymentRequest = async (paymentId: number) => {
  const response = await apiFetch(`${PAYMENTS_API_URL}/api/pagos/${paymentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('No se pudo eliminar el pago');
  }
};
