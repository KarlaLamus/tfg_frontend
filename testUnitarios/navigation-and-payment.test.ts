import { describe, expect, it } from 'vitest';
import { buildApiUrl } from '../src/app/utils/api-client';
import {
  buildReservationPaymentPath,
  getReservationSubtotalBeforeDiscount,
} from '../src/app/utils/reservation-payment-navigation';
import {
  buildReturnNavigationState,
  getSafeReturnNavigation,
} from '../src/app/utils/return-navigation';

describe('return-navigation', () => {
  it('construye el estado de retorno con estado extra', () => {
    expect(buildReturnNavigationState('/clientes/1', 'Volver', { focusSection: 'history' })).toEqual(
      {
        returnTo: '/clientes/1',
        returnLabel: 'Volver',
        focusSection: 'history',
      }
    );
  });

  it('usa el destino seguro si la ruta empieza por /', () => {
    expect(getSafeReturnNavigation({ returnTo: '/mascotas/4', returnLabel: 'Volver a mascota' }, '/clientes', 'Volver')).toEqual({
      destination: '/mascotas/4',
      label: 'Volver a mascota',
    });
  });

  it('usa fallback si la ruta de retorno no es segura', () => {
    expect(getSafeReturnNavigation({ returnTo: 'https://externo.com' }, '/clientes', 'Volver')).toEqual({
      destination: '/clientes',
      label: 'Volver',
    });
  });
});

describe('reservation-payment-navigation', () => {
  it('calcula el subtotal antes del descuento con precisión de dos decimales', () => {
    expect(getReservationSubtotalBeforeDiscount({ totalAmount: 91.23, discount: 8.77 })).toBe(100);
  });

  it('prioriza el desglose de alojamiento y servicios si está disponible', () => {
    expect(
      getReservationSubtotalBeforeDiscount({
        totalAmount: 0,
        discount: 0,
        lodgingAmount: 80,
        services: [
          { id: 1, name: 'Baño', price: 15, quantity: 2 },
          { id: 2, name: 'Cepillado', price: 10, quantity: 1 },
        ],
      })
    ).toBe(120);
  });

  it('construye la URL de pago con los parámetros esperados', () => {
    const path = buildReservationPaymentPath(
      {
        id: 'RES-076',
        client: { id: 1, name: 'Ana Pérez', email: '', phone: '' },
        totalAmount: 91.23,
        discount: 8.77,
      },
      {
        returnTo: '/reservas/RES-076',
        returnLabel: 'Volver a reserva',
      }
    );

    const url = new URL(`http://localhost${path}`);

    expect(url.pathname).toBe('/pagos');
    expect(url.searchParams.get('action')).toBe('new');
    expect(url.searchParams.get('reservationId')).toBe('RES-076');
    expect(url.searchParams.get('client')).toBe('Ana Pérez');
    expect(url.searchParams.get('amount')).toBe('100.00');
    expect(url.searchParams.get('discount')).toBe('8.77');
    expect(url.searchParams.get('returnTo')).toBe('/reservas/RES-076');
    expect(url.searchParams.get('returnLabel')).toBe('Volver a reserva');
  });
});

describe('api-client', () => {
  it('mantiene URLs absolutas sin cambios', () => {
    expect(buildApiUrl('https://example.com/test')).toBe('https://example.com/test');
  });

  it('construye URLs relativas contra la API base', () => {
    expect(buildApiUrl('/api/clientes')).toContain('/api/clientes');
    expect(buildApiUrl('api/clientes')).toContain('/api/clientes');
  });
});
