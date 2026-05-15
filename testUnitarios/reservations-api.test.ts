import { describe, expect, it } from 'vitest';
import {
  buildReservationNotes,
  canCancelReservation,
  canChangeReservationStatusAfterCheckIn,
  extractReservationNumericId,
  formatReservationCode,
  getReservationCheckOutRequiredMessage,
  hasReservationActiveCheckIn,
  mapBackendReservationStatusToUi,
  type ReservationCheckData,
} from '../src/app/utils/reservations-api';

const checkinData: ReservationCheckData = {
  fechaHora: '2026-05-04T10:00:00',
  empleadoId: 4,
  observaciones: 'Check-in correcto',
};

describe('reservations-api lifecycle guards', () => {
  it('detecta check-in activo por estado en curso', () => {
    expect(hasReservationActiveCheckIn({ status: 'in_progress' })).toBe(true);
  });

  it('detecta check-in activo por datos de check-in sin check-out', () => {
    expect(
      hasReservationActiveCheckIn({
        status: 'confirmed',
        checkinData,
        checkoutData: null,
      })
    ).toBe(true);
  });

  it('no marca check-in activo si ya hay check-out', () => {
    expect(
      hasReservationActiveCheckIn({
        status: 'completed',
        checkinData,
        checkoutData: {
          fechaHora: '2026-05-05T12:00:00',
          empleadoId: 4,
          observaciones: 'Check-out correcto',
        },
      })
    ).toBe(false);
  });

  it('permite cancelar una reserva pendiente o confirmada sin check-in', () => {
    expect(canCancelReservation({ status: 'pending' })).toBe(true);
    expect(canCancelReservation({ status: 'confirmed' })).toBe(true);
  });

  it('impide cancelar reservas canceladas, finalizadas o con check-in activo', () => {
    expect(canCancelReservation({ status: 'cancelled' })).toBe(false);
    expect(canCancelReservation({ status: 'completed' })).toBe(false);
    expect(canCancelReservation({ status: 'confirmed', checkinData, checkoutData: null })).toBe(
      false
    );
  });

  it('solo permite mantener en curso o pasar a completada si ya hubo check-in', () => {
    const reservation = { status: 'confirmed' as const, checkinData, checkoutData: null };

    expect(canChangeReservationStatusAfterCheckIn(reservation, 'in_progress')).toBe(true);
    expect(canChangeReservationStatusAfterCheckIn(reservation, 'completed')).toBe(true);
    expect(canChangeReservationStatusAfterCheckIn(reservation, 'cancelled')).toBe(false);
    expect(canChangeReservationStatusAfterCheckIn(reservation, 'pending')).toBe(false);
  });
});

describe('reservations-api helpers', () => {
  it('genera el mensaje de check-out requerido', () => {
    expect(getReservationCheckOutRequiredMessage('cancelar')).toContain('No puedes cancelar');
  });

  it('mapea estados del backend a la UI', () => {
    expect(mapBackendReservationStatusToUi('CONFIRMADA')).toBe('confirmed');
    expect(mapBackendReservationStatusToUi('EN_CURSO')).toBe('in_progress');
    expect(mapBackendReservationStatusToUi('FINALIZADA')).toBe('completed');
    expect(mapBackendReservationStatusToUi('CANCELADA')).toBe('cancelled');
    expect(mapBackendReservationStatusToUi('PENDIENTE')).toBe('pending');
  });

  it('formatea correctamente el código de reserva', () => {
    expect(formatReservationCode(7)).toBe('RES-007');
    expect(formatReservationCode(123)).toBe('RES-123');
  });

  it('extrae el id numérico desde números o códigos de reserva', () => {
    expect(extractReservationNumericId(15)).toBe(15);
    expect(extractReservationNumericId('RES-076')).toBe(76);
    expect(extractReservationNumericId('abc-45-z9')).toBe(9);
  });

  it('construye las notas combinando cliente e internas', () => {
    expect(buildReservationNotes('Llamar antes', 'Llegará tarde')).toBe(
      'Cliente: Llamar antes\n\nInternas: Llegará tarde'
    );
  });

  it('omite secciones vacías al construir notas', () => {
    expect(buildReservationNotes('', 'Solo internas')).toBe('Internas: Solo internas');
    expect(buildReservationNotes('', '')).toBe('');
  });
});
