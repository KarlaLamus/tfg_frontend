import type { ReservationRecord } from './reservations-api';

interface ReservationPaymentPathOptions {
  returnTo?: string;
  returnLabel?: string;
}

export interface ReservationPaymentNavigationState {
  returnTo?: string;
  returnLabel?: string;
  returnState?: unknown;
}

export const getReservationSubtotalBeforeDiscount = (
  reservation: Pick<ReservationRecord, 'totalAmount' | 'discount' | 'lodgingAmount' | 'services'>
) => {
  const servicesSubtotal = (reservation.services ?? []).reduce(
    (sum, service) => sum + service.price * service.quantity,
    0
  );
  const subtotalFromBreakdown =
    typeof reservation.lodgingAmount === 'number' && Number.isFinite(reservation.lodgingAmount)
      ? reservation.lodgingAmount + servicesSubtotal
      : NaN;
  const subtotalFromTotal = reservation.totalAmount + reservation.discount;
  const resolvedSubtotal =
    Number.isFinite(subtotalFromBreakdown) && subtotalFromBreakdown > 0
      ? subtotalFromBreakdown
      : subtotalFromTotal;

  return Number(Math.max(resolvedSubtotal, 0).toFixed(2));
};

export const buildReservationPaymentPath = (
  reservation: Pick<
    ReservationRecord,
    'id' | 'client' | 'totalAmount' | 'discount' | 'lodgingAmount' | 'services'
  >,
  options?: ReservationPaymentPathOptions
) => {
  const searchParams = new URLSearchParams({
    action: 'new',
    reservationId: reservation.id,
    client: reservation.client.name,
    amount: getReservationSubtotalBeforeDiscount(reservation).toFixed(2),
    discount: reservation.discount.toFixed(2),
  });

  if (options?.returnTo) {
    searchParams.set('returnTo', options.returnTo);
  }

  if (options?.returnLabel) {
    searchParams.set('returnLabel', options.returnLabel);
  }

  return `/pagos?${searchParams.toString()}`;
};
