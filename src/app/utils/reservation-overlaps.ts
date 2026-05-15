import type { ReservationRecord } from './reservations-api';

const normalizeDateValue = (value: string) => value.split('T')[0] ?? value;

const toDate = (value: string) => new Date(`${normalizeDateValue(value)}T00:00:00`);

export const reservationDatesOverlap = (
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

export interface PetReservationOverlap {
  petId: number;
  petName: string;
  reservationId: string;
  checkIn: string;
  checkOut: string;
}

export const getPetReservationOverlaps = ({
  reservations,
  petIds,
  checkIn,
  checkOut,
  excludeReservationId,
}: {
  reservations: ReservationRecord[];
  petIds: number[];
  checkIn: string;
  checkOut: string;
  excludeReservationId?: string;
}): PetReservationOverlap[] => {
  if (!checkIn || !checkOut || petIds.length === 0) {
    return [];
  }

  const selectedPetIds = new Set(petIds);

  return reservations.flatMap((reservation) => {
    if (
      reservation.id === excludeReservationId ||
      reservation.status === 'cancelled' ||
      !reservationDatesOverlap(checkIn, checkOut, reservation.checkIn, reservation.checkOut)
    ) {
      return [];
    }

    return reservation.pets
      .filter((pet) => selectedPetIds.has(pet.id))
      .map((pet) => ({
        petId: pet.id,
        petName: pet.name,
        reservationId: reservation.id,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
      }));
  });
};
