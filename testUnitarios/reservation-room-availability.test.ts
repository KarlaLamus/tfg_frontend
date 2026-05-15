import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReservationRecord } from '../src/app/utils/reservations-api';
import {
  buildMixedRoomAssignment,
  formatRoomTypeLabel,
  formatSpeciesGroupLabel,
  getPetsSpeciesGroup,
  getRoomAvailabilityForReservation,
  mapPetSpeciesToRoomType,
  parseMixedRoomAssignment,
  type ReservationAvailabilityRoom,
} from '../src/app/utils/reservation-room-availability';

const createReservation = (overrides: Partial<ReservationRecord> = {}): ReservationRecord => ({
  numericId: 1,
  id: 'RES-001',
  client: {
    id: 1,
    name: 'Cliente Test',
    email: '',
    phone: '',
  },
  pets: [
    {
      id: 1,
      name: 'Toby',
      species: 'Perro',
      breed: 'Labrador',
      age: 4,
    },
  ],
  checkIn: '2026-05-10',
  checkOut: '2026-05-12',
  room: 'Sala Perros S1',
  status: 'confirmed',
  totalAmount: 100,
  notes: '',
  customerNotes: '',
  internalNotes: '',
  services: [],
  createdAt: '',
  respondedAt: '',
  duration: 2,
  discount: 0,
  lodgingAmount: 100,
  paymentStatus: 'pending',
  checkinData: null,
  checkoutData: null,
  ...overrides,
});

describe('reservation-room-availability helpers', () => {
  it('detecta el grupo de especies de las mascotas', () => {
    expect(getPetsSpeciesGroup([])).toBe('unknown');
    expect(getPetsSpeciesGroup([{ species: 'Perro' }])).toBe('dog');
    expect(getPetsSpeciesGroup([{ species: 'Gato' }])).toBe('cat');
    expect(getPetsSpeciesGroup([{ species: 'Perro' }, { species: 'Gato' }])).toBe('mixed');
    expect(getPetsSpeciesGroup([{ species: 'Conejo' }])).toBe('unknown');
  });

  it('mapea la especie de mascota al tipo de sala', () => {
    expect(mapPetSpeciesToRoomType('Perro')).toBe('dog');
    expect(mapPetSpeciesToRoomType('Gato')).toBe('cat');
    expect(mapPetSpeciesToRoomType('Conejo')).toBe('unknown');
  });

  it('construye y parsea asignaciones mixtas', () => {
    const assignment = buildMixedRoomAssignment({
      dogRoom: 'Sala Perros S1',
      catRoom: 'Sala Gatos S1',
    });

    expect(assignment).toBe('Perros: Sala Perros S1 | Gatos: Sala Gatos S1');
    expect(parseMixedRoomAssignment(assignment)).toEqual({
      isMixed: true,
      dogRoom: 'Sala Perros S1',
      catRoom: 'Sala Gatos S1',
    });
  });

  it('devuelve asignación vacía si falta alguna sala en una reserva mixta', () => {
    expect(
      buildMixedRoomAssignment({
        dogRoom: 'Sala Perros S1',
        catRoom: '',
      })
    ).toBe('');
  });

  it('formatea las etiquetas de tipo de sala y especie', () => {
    expect(formatRoomTypeLabel('dog')).toBe('Perros');
    expect(formatRoomTypeLabel('cat')).toBe('Gatos');
    expect(formatSpeciesGroupLabel('dog')).toBe('perros');
    expect(formatSpeciesGroupLabel('cat')).toBe('gatos');
    expect(formatSpeciesGroupLabel('mixed')).toBe('perros y gatos');
    expect(formatSpeciesGroupLabel('unknown')).toBe('mascotas');
  });
});

describe('reservation-room-availability availability rules', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const rooms: ReservationAvailabilityRoom[] = [
    {
      id: 1,
      label: 'Sala Perros S1',
      type: 'dog',
      capacity: 2,
      status: 'operational',
      currentOccupancy: 0,
    },
    {
      id: 2,
      label: 'Sala Gatos S1',
      type: 'cat',
      capacity: 2,
      status: 'operational',
      currentOccupancy: 0,
    },
    {
      id: 3,
      label: 'Sala Perros M1',
      type: 'dog',
      capacity: 3,
      status: 'maintenance',
      currentOccupancy: 0,
    },
  ];

  it('marca una sala operativa y compatible como seleccionable si hay hueco', () => {
    const [dogRoom] = getRoomAvailabilityForReservation({
      rooms,
      reservations: [],
      pets: [{ species: 'Perro' }],
      checkIn: '2026-05-11',
      checkOut: '2026-05-13',
    });

    expect(dogRoom.freeSlots).toBe(2);
    expect(dogRoom.hasEnoughSpace).toBe(true);
    expect(dogRoom.isSelectable).toBe(true);
  });

  it('descuenta plazas por reservas solapadas en la misma sala', () => {
    const [dogRoom] = getRoomAvailabilityForReservation({
      rooms,
      reservations: [
        createReservation({
          pets: [
            { id: 1, name: 'Toby', species: 'Perro', breed: 'Labrador', age: 4 },
            { id: 2, name: 'Luna', species: 'Perro', breed: 'Beagle', age: 2 },
          ],
        }),
      ],
      pets: [{ species: 'Perro' }],
      checkIn: '2026-05-11',
      checkOut: '2026-05-12',
    });

    expect(dogRoom.occupiedSlots).toBe(2);
    expect(dogRoom.freeSlots).toBe(0);
    expect(dogRoom.isSelectable).toBe(false);
  });

  it('no cuenta reservas canceladas o completadas para la ocupación', () => {
    const [dogRoom] = getRoomAvailabilityForReservation({
      rooms,
      reservations: [
        createReservation({ status: 'cancelled' }),
        createReservation({ id: 'RES-002', numericId: 2, status: 'completed' }),
      ],
      pets: [{ species: 'Perro' }],
      checkIn: '2026-05-11',
      checkOut: '2026-05-12',
    });

    expect(dogRoom.occupiedSlots).toBe(0);
    expect(dogRoom.isSelectable).toBe(true);
  });

  it('cuenta correctamente reservas mixtas por especie y por sala asignada', () => {
    const mixedReservation = createReservation({
      id: 'RES-002',
      numericId: 2,
      room: buildMixedRoomAssignment({
        dogRoom: 'Sala Perros S1',
        catRoom: 'Sala Gatos S1',
      }),
      pets: [
        { id: 1, name: 'Toby', species: 'Perro', breed: 'Labrador', age: 4 },
        { id: 2, name: 'Misu', species: 'Gato', breed: 'Europeo', age: 3 },
      ],
    });

    const availability = getRoomAvailabilityForReservation({
      rooms,
      reservations: [mixedReservation],
      pets: [{ species: 'Perro' }],
      checkIn: '2026-05-11',
      checkOut: '2026-05-12',
    });

    expect(availability[0]?.occupiedSlots).toBe(1);
    expect(availability[1]?.occupiedSlots).toBe(1);
  });

  it('excluye la propia reserva al recalcular disponibilidad en edición', () => {
    const availability = getRoomAvailabilityForReservation({
      rooms,
      reservations: [createReservation()],
      pets: [{ species: 'Perro' }],
      checkIn: '2026-05-10',
      checkOut: '2026-05-12',
      excludeReservationId: 'RES-001',
    });

    expect(availability[0]?.occupiedSlots).toBe(0);
    expect(availability[0]?.isSelectable).toBe(true);
  });

  it('usa la ocupación actual de la sala cuando el rango incluye hoy', () => {
    const availability = getRoomAvailabilityForReservation({
      rooms: [
        {
          id: 1,
          label: 'Sala Perros S1',
          type: 'dog',
          capacity: 2,
          status: 'operational',
          currentOccupancy: 2,
        },
      ],
      reservations: [],
      pets: [{ species: 'Perro' }],
      checkIn: '2026-05-10',
      checkOut: '2026-05-12',
    });

    expect(availability[0]?.occupiedSlots).toBe(2);
    expect(availability[0]?.freeSlots).toBe(0);
    expect(availability[0]?.isSelectable).toBe(false);
  });

  it('ajusta la ocupación actual restando la propia reserva cuando se está editando', () => {
    const availability = getRoomAvailabilityForReservation({
      rooms: [
        {
          id: 1,
          label: 'Sala Perros S1',
          type: 'dog',
          capacity: 2,
          status: 'operational',
          currentOccupancy: 2,
        },
      ],
      reservations: [
        createReservation({
          pets: [{ id: 1, name: 'Toby', species: 'Perro', breed: 'Labrador', age: 4 }],
        }),
      ],
      pets: [{ species: 'Perro' }],
      checkIn: '2026-05-10',
      checkOut: '2026-05-12',
      excludeReservationId: 'RES-001',
    });

    expect(availability[0]?.occupiedSlots).toBe(1);
    expect(availability[0]?.freeSlots).toBe(1);
    expect(availability[0]?.isSelectable).toBe(true);
  });

  it('devuelve salas no seleccionables si las mascotas son mixtas o desconocidas', () => {
    const mixedAvailability = getRoomAvailabilityForReservation({
      rooms,
      reservations: [],
      pets: [{ species: 'Perro' }, { species: 'Gato' }],
      checkIn: '2026-05-11',
      checkOut: '2026-05-12',
    });
    const unknownAvailability = getRoomAvailabilityForReservation({
      rooms,
      reservations: [],
      pets: [{ species: 'Conejo' }],
      checkIn: '2026-05-11',
      checkOut: '2026-05-12',
    });

    expect(mixedAvailability.every((room) => room.isSelectable === false)).toBe(true);
    expect(unknownAvailability.every((room) => room.isSelectable === false)).toBe(true);
  });

  it('marca como no seleccionable una sala en mantenimiento aunque tenga hueco', () => {
    const availability = getRoomAvailabilityForReservation({
      rooms,
      reservations: [],
      pets: [{ species: 'Perro' }],
      checkIn: '2026-05-11',
      checkOut: '2026-05-12',
    });

    expect(availability[2]?.isOperational).toBe(false);
    expect(availability[2]?.isSelectable).toBe(false);
  });
});
