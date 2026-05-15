import type { QueryClient } from '@tanstack/react-query';
import type { EditablePet } from '../components/pets/edit-pet-modal';
import { adjustLocalClientRelationshipCounts } from './client-local-overrides';
import { CLIENTS_QUERY_KEY } from './clients-api';
import {
  clearLocalPetState,
  clearLocalPetsForOwner,
  getLocalPetIdsForOwner,
} from './pet-local-overrides';
import { PAYMENTS_QUERY_KEY, type PaymentRecord } from './payments-api';
import { PETS_QUERY_KEY } from './pets-api';
import {
  getLocalReservationOverrides,
  updateLocalReservationOverrides,
} from './reservation-local-overrides';
import type { ReservationRecord } from './reservations-api';
import type { TrackingPageData } from './tracking-api';

export const RESERVATIONS_QUERY_KEY = ['reservations-page'] as const;
export const TRACKING_QUERY_KEY = ['tracking-page'] as const;
export const RESERVATION_FORM_ROOMS_QUERY_KEY = ['reservation-form-rooms'] as const;
export const RESERVATION_FORM_CLIENT_PETS_QUERY_KEY = ['reservation-form-client-pets'] as const;
export const RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY = ['reservation-editor-client-pets'] as const;
export const SERVICES_QUERY_KEY = ['services-page'] as const;

const NO_ASSIGNED_ROOM_LABEL = 'Sin sala asignada';

const getKnownReservations = (queryClient: QueryClient) => {
  const reservationsFromCache =
    queryClient.getQueryData<ReservationRecord[]>(RESERVATIONS_QUERY_KEY) ?? [];
  const localReservations = Object.values(getLocalReservationOverrides<ReservationRecord>());
  const reservationsById = new Map<string, ReservationRecord>();

  reservationsFromCache.forEach((reservation) => {
    reservationsById.set(reservation.id, reservation);
  });

  localReservations.forEach((reservation) => {
    reservationsById.set(reservation.id, reservation);
  });

  return Array.from(reservationsById.values());
};

const removeReservationDetailQueries = (queryClient: QueryClient, reservationIds: string[]) => {
  reservationIds.forEach((reservationId) => {
    queryClient.removeQueries({
      queryKey: ['reservation-detail', reservationId],
      exact: true,
    });
  });
};

const applyReservationTransform = (
  queryClient: QueryClient,
  transform: (reservation: ReservationRecord) => ReservationRecord | null
) => {
  const knownReservations = getKnownReservations(queryClient);
  const transformedById = new Map<string, ReservationRecord | null>();
  const removedReservations: ReservationRecord[] = [];
  const updatedReservations: ReservationRecord[] = [];

  knownReservations.forEach((reservation) => {
    const nextReservation = transform(reservation);
    transformedById.set(reservation.id, nextReservation);

    if (nextReservation === null) {
      removedReservations.push(reservation);
      return;
    }

    if (nextReservation !== reservation) {
      updatedReservations.push(nextReservation);
    }
  });

  updateLocalReservationOverrides<ReservationRecord>(
    (reservation) => transformedById.get(reservation.id) ?? reservation
  );

  if (queryClient.getQueryData<ReservationRecord[]>(RESERVATIONS_QUERY_KEY) !== undefined) {
    queryClient.setQueryData<ReservationRecord[]>(
      RESERVATIONS_QUERY_KEY,
      (currentReservations = []) =>
        currentReservations.flatMap((reservation) => {
          const nextReservation = transformedById.get(reservation.id) ?? reservation;
          return nextReservation ? [nextReservation] : [];
        })
    );
  }

  updatedReservations.forEach((reservation) => {
    queryClient.setQueryData<ReservationRecord>(
      ['reservation-detail', reservation.id],
      reservation
    );
  });

  removeReservationDetailQueries(
    queryClient,
    removedReservations.map((reservation) => reservation.id)
  );

  return { removedReservations, updatedReservations };
};

const removePaymentsForReservationIds = (queryClient: QueryClient, reservationIds: string[]) => {
  if (reservationIds.length === 0) {
    return;
  }

  if (queryClient.getQueryData<PaymentRecord[]>(PAYMENTS_QUERY_KEY) === undefined) {
    return;
  }

  const reservationIdsSet = new Set(reservationIds);

  queryClient.setQueryData<PaymentRecord[]>(PAYMENTS_QUERY_KEY, (currentPayments = []) =>
    currentPayments.filter((payment) => !reservationIdsSet.has(payment.reservationId))
  );
};

export const syncDeletedClientReferences = (queryClient: QueryClient, clientId: number) => {
  const petsFromCache = queryClient.getQueryData<EditablePet[]>(PETS_QUERY_KEY) ?? [];
  const ownedPetIds = Array.from(
    new Set([
      ...petsFromCache.filter((pet) => pet.ownerId === clientId).map((pet) => pet.id),
      ...getLocalPetIdsForOwner(clientId),
    ])
  );

  const { removedReservations } = applyReservationTransform(
    queryClient,
    (reservation) => (reservation.client.id === clientId ? null : reservation)
  );

  clearLocalPetsForOwner(clientId);
  queryClient.removeQueries({ queryKey: ['client-detail', String(clientId)], exact: true });
  queryClient.removeQueries({ queryKey: RESERVATION_FORM_CLIENT_PETS_QUERY_KEY });
  queryClient.removeQueries({ queryKey: RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY });

  if (queryClient.getQueryData<EditablePet[]>(PETS_QUERY_KEY) !== undefined) {
    queryClient.setQueryData<EditablePet[]>(PETS_QUERY_KEY, (currentPets = []) =>
      currentPets.filter((pet) => pet.ownerId !== clientId)
    );
  }

  if (queryClient.getQueryData(CLIENTS_QUERY_KEY) !== undefined) {
    queryClient.setQueryData(CLIENTS_QUERY_KEY, (currentClients: Array<{ id: number }> = []) =>
      currentClients.filter((client) => client.id !== clientId)
    );
  }

  ownedPetIds.forEach((petId) => {
    queryClient.removeQueries({
      queryKey: ['pet-detail', String(petId)],
      exact: true,
    });
  });

  removePaymentsForReservationIds(
    queryClient,
    removedReservations.map((reservation) => reservation.id)
  );

  if (queryClient.getQueryData<TrackingPageData>(TRACKING_QUERY_KEY) !== undefined) {
    const ownedPetIdsSet = new Set(ownedPetIds);

    queryClient.setQueryData<TrackingPageData>(TRACKING_QUERY_KEY, (currentData) => {
      if (!currentData) {
        return currentData;
      }

      return {
        pets: currentData.pets.filter(
          (pet) => pet.client.id !== clientId && !ownedPetIdsSet.has(pet.id)
        ),
        trackingByPetId: Object.fromEntries(
          Object.entries(currentData.trackingByPetId).filter(
            ([petId]) => !ownedPetIdsSet.has(Number(petId))
          )
        ),
      };
    });
  }
};

export const syncDeletedPetReferences = (
  queryClient: QueryClient,
  petId: number,
  ownerId?: number
) => {
  const cachedPet =
    queryClient
      .getQueryData<EditablePet[]>(PETS_QUERY_KEY)
      ?.find((pet) => pet.id === petId) ?? null;
  const resolvedOwnerId = ownerId ?? cachedPet?.ownerId;
  const { removedReservations } = applyReservationTransform(queryClient, (reservation) => {
    if (!reservation.pets.some((pet) => pet.id === petId)) {
      return reservation;
    }

    const nextPets = reservation.pets.filter((pet) => pet.id !== petId);
    return nextPets.length > 0 ? { ...reservation, pets: nextPets } : null;
  });

  clearLocalPetState(petId);
  queryClient.removeQueries({
    queryKey: ['pet-detail', String(petId)],
    exact: true,
  });
  queryClient.removeQueries({ queryKey: RESERVATION_FORM_CLIENT_PETS_QUERY_KEY });
  queryClient.removeQueries({ queryKey: RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY });

  if (queryClient.getQueryData<EditablePet[]>(PETS_QUERY_KEY) !== undefined) {
    queryClient.setQueryData<EditablePet[]>(PETS_QUERY_KEY, (currentPets = []) =>
      currentPets.filter((pet) => pet.id !== petId)
    );
  }

  if (queryClient.getQueryData<TrackingPageData>(TRACKING_QUERY_KEY) !== undefined) {
    queryClient.setQueryData<TrackingPageData>(TRACKING_QUERY_KEY, (currentData) => {
      if (!currentData) {
        return currentData;
      }

      return {
        pets: currentData.pets.filter((pet) => pet.id !== petId),
        trackingByPetId: Object.fromEntries(
          Object.entries(currentData.trackingByPetId).filter(
            ([trackedPetId]) => Number(trackedPetId) !== petId
          )
        ),
      };
    });
  }

  if (resolvedOwnerId != null) {
    const removedReservationsCount = removedReservations.filter(
      (reservation) => reservation.client.id === resolvedOwnerId
    ).length;

    if (queryClient.getQueryData(CLIENTS_QUERY_KEY) !== undefined) {
      queryClient.setQueryData<
        Array<{ id: number; petsCount: number; reservationsCount: number }>
      >(CLIENTS_QUERY_KEY, (currentClients = []) =>
        currentClients.map((client) =>
          client.id === resolvedOwnerId
            ? {
                ...client,
                petsCount: Math.max(client.petsCount - 1, 0),
                reservationsCount: Math.max(
                  client.reservationsCount - removedReservationsCount,
                  0
                ),
              }
            : client
        )
      );
    }

    adjustLocalClientRelationshipCounts(resolvedOwnerId, {
      petsCountDelta: -1,
      reservationsCountDelta: -removedReservationsCount,
    });
  }

  removePaymentsForReservationIds(
    queryClient,
    removedReservations.map((reservation) => reservation.id)
  );
};

export const syncDeletedRoomReferences = (queryClient: QueryClient, roomName: string) => {
  applyReservationTransform(queryClient, (reservation) =>
    reservation.room === roomName
      ? {
          ...reservation,
          room: NO_ASSIGNED_ROOM_LABEL,
        }
      : reservation
  );

  if (queryClient.getQueryData<TrackingPageData>(TRACKING_QUERY_KEY) !== undefined) {
    queryClient.setQueryData<TrackingPageData>(TRACKING_QUERY_KEY, (currentData) => {
      if (!currentData) {
        return currentData;
      }

      return {
        ...currentData,
        pets: currentData.pets.map((pet) =>
          pet.reservation.room === roomName
            ? {
                ...pet,
                reservation: {
                  ...pet.reservation,
                  room: NO_ASSIGNED_ROOM_LABEL,
                },
              }
            : pet
        ),
      };
    });
  }
};
