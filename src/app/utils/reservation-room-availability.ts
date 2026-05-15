import type { ReservationRecord } from './reservations-api';

export type ReservationRoomSpeciesType = 'dog' | 'cat';
export type ReservationPetSpeciesType = ReservationRoomSpeciesType | 'unknown';

export interface ReservationAvailabilityRoom {
  id: number;
  label: string;
  type: ReservationRoomSpeciesType;
  capacity: number;
  status: 'operational' | 'maintenance';
  currentOccupancy?: number;
}

export interface ReservationRoomAvailabilityOption {
  roomId: number;
  roomLabel: string;
  roomType: ReservationRoomSpeciesType;
  capacity: number;
  occupiedSlots: number;
  freeSlots: number;
  isOperational: boolean;
  isCompatibleSpecies: boolean;
  hasEnoughSpace: boolean;
  isSelectable: boolean;
}

export type ReservationPetsSpeciesGroup = 'dog' | 'cat' | 'mixed' | 'unknown';

const normalizeDateValue = (value: string) => value.split('T')[0] ?? value;
const normalizeRoomLabel = (value: string) => value.trim().toLowerCase();
const MIXED_DOG_ROOM_PREFIX = 'Perros:';
const MIXED_CAT_ROOM_PREFIX = 'Gatos:';

const toDate = (value: string) => new Date(`${normalizeDateValue(value)}T00:00:00`);
const toDayValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const datesOverlap = (
  firstCheckIn: string,
  firstCheckOut: string,
  secondCheckIn: string,
  secondCheckOut: string
) => {
  const firstStart = toDate(firstCheckIn);
  const firstEnd = toDate(firstCheckOut);
  const secondStart = toDate(secondCheckIn);
  const secondEnd = toDate(secondCheckOut);

  return firstStart < secondEnd && secondStart < firstEnd;
};

const dateRangeIncludesDay = (checkIn: string, checkOut: string, day: string) => {
  const start = toDate(checkIn);
  const end = toDate(checkOut);
  const targetDay = toDate(day);

  return start <= targetDay && targetDay < end;
};

export const getPetsSpeciesGroup = (
  pets: Array<{ species: 'Perro' | 'Gato' | string }>
): ReservationPetsSpeciesGroup => {
  if (pets.length === 0) {
    return 'unknown';
  }

  const uniqueSpecies = new Set(
    pets.map((pet) => (pet.species === 'Gato' ? 'cat' : pet.species === 'Perro' ? 'dog' : 'unknown'))
  );

  if (uniqueSpecies.has('unknown')) {
    return 'unknown';
  }

  if (uniqueSpecies.size > 1) {
    return 'mixed';
  }

  return uniqueSpecies.has('cat') ? 'cat' : 'dog';
};

export const mapPetSpeciesToRoomType = (
  species: 'Perro' | 'Gato' | string
): ReservationPetSpeciesType => {
  if (species === 'Gato') {
    return 'cat';
  }

  if (species === 'Perro') {
    return 'dog';
  }

  return 'unknown';
};

export const parseMixedRoomAssignment = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return {
      isMixed: false,
      dogRoom: '',
      catRoom: '',
    };
  }

  const segments = trimmedValue.split('|').map((segment) => segment.trim());
  const dogSegment = segments.find((segment) => segment.startsWith(MIXED_DOG_ROOM_PREFIX));
  const catSegment = segments.find((segment) => segment.startsWith(MIXED_CAT_ROOM_PREFIX));

  if (!dogSegment || !catSegment) {
    return {
      isMixed: false,
      dogRoom: '',
      catRoom: '',
    };
  }

  return {
    isMixed: true,
    dogRoom: dogSegment.replace(MIXED_DOG_ROOM_PREFIX, '').trim(),
    catRoom: catSegment.replace(MIXED_CAT_ROOM_PREFIX, '').trim(),
  };
};

export const buildMixedRoomAssignment = ({
  dogRoom,
  catRoom,
}: {
  dogRoom: string;
  catRoom: string;
}) => {
  const normalizedDogRoom = dogRoom.trim();
  const normalizedCatRoom = catRoom.trim();

  if (!normalizedDogRoom || !normalizedCatRoom) {
    return '';
  }

  return `${MIXED_DOG_ROOM_PREFIX} ${normalizedDogRoom} | ${MIXED_CAT_ROOM_PREFIX} ${normalizedCatRoom}`;
};

const countReservationPetsBySpecies = (
  reservation: ReservationRecord,
  roomType: ReservationRoomSpeciesType
) =>
  reservation.pets.filter((pet) => mapPetSpeciesToRoomType(pet.species) === roomType).length;

const countReservationPetsAssignedToRoom = (
  reservation: ReservationRecord,
  room: ReservationAvailabilityRoom
) => {
  const mixedAssignment = parseMixedRoomAssignment(reservation.room ?? '');

  if (mixedAssignment.isMixed) {
    const roomLabelForSpecies =
      room.type === 'dog' ? mixedAssignment.dogRoom : mixedAssignment.catRoom;

    if (normalizeRoomLabel(roomLabelForSpecies) !== normalizeRoomLabel(room.label)) {
      return 0;
    }

    return countReservationPetsBySpecies(reservation, room.type);
  }

  if (normalizeRoomLabel(reservation.room) !== normalizeRoomLabel(room.label)) {
    return 0;
  }

  return reservation.pets.length;
};

export const formatRoomTypeLabel = (type: ReservationRoomSpeciesType) =>
  type === 'cat' ? 'Gatos' : 'Perros';

export const formatSpeciesGroupLabel = (speciesGroup: ReservationPetsSpeciesGroup) => {
  switch (speciesGroup) {
    case 'cat':
      return 'gatos';
    case 'dog':
      return 'perros';
    case 'mixed':
      return 'perros y gatos';
    default:
      return 'mascotas';
  }
};

export const getRoomAvailabilityForReservation = ({
  rooms,
  reservations,
  pets,
  checkIn,
  checkOut,
  excludeReservationId,
}: {
  rooms: ReservationAvailabilityRoom[];
  reservations: ReservationRecord[];
  pets: Array<{ species: 'Perro' | 'Gato' | string }>;
  checkIn: string;
  checkOut: string;
  excludeReservationId?: string;
}): ReservationRoomAvailabilityOption[] => {
  const speciesGroup = getPetsSpeciesGroup(pets);
  const todayDate = toDayValue(new Date());
  const reservationWindowIncludesToday = checkIn && checkOut
    ? dateRangeIncludesDay(checkIn, checkOut, todayDate)
    : false;
  const excludedReservation =
    excludeReservationId
      ? reservations.find((reservation) => reservation.id === excludeReservationId) ?? null
      : null;

  if (!checkIn || !checkOut || speciesGroup === 'unknown' || speciesGroup === 'mixed') {
    return rooms.map((room) => ({
      roomId: room.id,
      roomLabel: room.label,
      roomType: room.type,
      capacity: room.capacity,
      occupiedSlots: 0,
      freeSlots: room.capacity,
      isOperational: room.status === 'operational',
      isCompatibleSpecies: speciesGroup === 'unknown' ? true : false,
      hasEnoughSpace: false,
      isSelectable: false,
    }));
  }

  return rooms.map((room) => {
    const derivedOccupiedSlots = reservations.reduce((sum, reservation) => {
      const mixedAssignment = parseMixedRoomAssignment(reservation.room ?? '');

      if (
        reservation.id === excludeReservationId ||
        reservation.status === 'cancelled' ||
        reservation.status === 'completed' ||
        !reservation.room ||
        reservation.room === 'Sin sala asignada'
      ) {
        return sum;
      }

      if (!datesOverlap(checkIn, checkOut, reservation.checkIn, reservation.checkOut)) {
        return sum;
      }

      if (mixedAssignment.isMixed) {
        const roomLabelForSpecies =
          room.type === 'dog' ? mixedAssignment.dogRoom : mixedAssignment.catRoom;

        if (normalizeRoomLabel(roomLabelForSpecies) !== normalizeRoomLabel(room.label)) {
          return sum;
        }

        return sum + countReservationPetsBySpecies(reservation, room.type);
      }

      if (normalizeRoomLabel(reservation.room) !== normalizeRoomLabel(room.label)) {
        return sum;
      }

      return sum + reservation.pets.length;
    }, 0);

    const roomCurrentOccupancy = Math.max(Number(room.currentOccupancy ?? 0), 0);
    const excludedReservationOccupancyToday =
      reservationWindowIncludesToday &&
      excludedReservation &&
      excludedReservation.status !== 'cancelled' &&
      excludedReservation.status !== 'completed' &&
      dateRangeIncludesDay(excludedReservation.checkIn, excludedReservation.checkOut, todayDate)
        ? countReservationPetsAssignedToRoom(excludedReservation, room)
        : 0;
    const adjustedCurrentOccupancy = Math.max(
      roomCurrentOccupancy - excludedReservationOccupancyToday,
      0
    );
    const occupiedSlots = reservationWindowIncludesToday
      ? Math.max(derivedOccupiedSlots, adjustedCurrentOccupancy)
      : derivedOccupiedSlots;

    const freeSlots = Math.max(room.capacity - occupiedSlots, 0);
    const isCompatibleSpecies = room.type === speciesGroup;
    const hasEnoughSpace = freeSlots >= pets.length;
    const isOperational = room.status === 'operational';

    return {
      roomId: room.id,
      roomLabel: room.label,
      roomType: room.type,
      capacity: room.capacity,
      occupiedSlots,
      freeSlots,
      isOperational,
      isCompatibleSpecies,
      hasEnoughSpace,
      isSelectable: isOperational && isCompatibleSpecies && hasEnoughSpace,
    };
  });
};
