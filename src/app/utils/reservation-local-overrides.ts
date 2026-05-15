import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from './query-client';

export interface LocalReservationCache<T extends { id: string }> {
  overrides: Record<string, T>;
}

export const RESERVATION_LOCAL_CACHE_QUERY_KEY = ['local-cache', 'reservations'] as const;

const createEmptyLocalReservationCache = <T extends { id: string }>(): LocalReservationCache<T> => ({
  overrides: {},
});

const getLocalReservationCache = <T extends { id: string }>(): LocalReservationCache<T> => {
  return (
    queryClient.getQueryData<LocalReservationCache<T>>(RESERVATION_LOCAL_CACHE_QUERY_KEY) ??
    createEmptyLocalReservationCache<T>()
  );
};

const setLocalReservationCache = <T extends { id: string }>(
  updater: (currentCache: LocalReservationCache<T>) => LocalReservationCache<T>
) => {
  queryClient.setQueryData<LocalReservationCache<T>>(
    RESERVATION_LOCAL_CACHE_QUERY_KEY,
    (currentCache) => updater(currentCache ?? createEmptyLocalReservationCache<T>())
  );
};

export const useLocalReservationCache = <T extends { id: string }>() =>
  useQuery({
    queryKey: RESERVATION_LOCAL_CACHE_QUERY_KEY,
    queryFn: () => createEmptyLocalReservationCache<T>(),
    initialData: () => getLocalReservationCache<T>(),
    staleTime: Infinity,
    gcTime: Infinity,
  });

export const getLocalReservationOverrides = <T extends { id: string }>(
  localCache: LocalReservationCache<T> = getLocalReservationCache<T>()
) => {
  return localCache.overrides;
};

export const getLocalReservationOverride = <T extends { id: string }>(
  reservationId: string,
  localCache: LocalReservationCache<T> = getLocalReservationCache<T>()
) => {
  return localCache.overrides[reservationId];
};

export const saveLocalReservationOverride = <T extends { id: string }>(reservation: T) => {
  setLocalReservationCache<T>((currentCache) => ({
    overrides: {
      ...currentCache.overrides,
      [reservation.id]: reservation,
    },
  }));
};

export const removeLocalReservationOverride = <T extends { id: string }>(reservationId: string) => {
  setLocalReservationCache<T>((currentCache) => ({
    overrides: Object.fromEntries(
      Object.entries(currentCache.overrides).filter(
        ([storedReservationId]) => storedReservationId !== reservationId
      )
    ),
  }));
};

export const updateLocalReservationOverrides = <T extends { id: string }>(
  updater: (reservation: T) => T | null
) => {
  setLocalReservationCache<T>((currentCache) => ({
    overrides: Object.fromEntries(
      Object.values(currentCache.overrides)
        .map((reservation) => updater(reservation))
        .filter((reservation): reservation is T => reservation !== null)
        .map((reservation) => [reservation.id, reservation])
    ),
  }));
};

export const mergeReservationWithLocalOverride = <T extends { id: string }>(
  reservation: T,
  localReservation: T
) => {
  const mergedReservation = {
    ...reservation,
    ...localReservation,
  } as T & { paymentStatus?: unknown };

  if (
    'paymentStatus' in reservation &&
    (reservation as T & { paymentStatus?: unknown }).paymentStatus !== undefined
  ) {
    mergedReservation.paymentStatus = (
      reservation as T & { paymentStatus?: unknown }
    ).paymentStatus;
  }

  return mergedReservation as T;
};

export const applyLocalReservationOverrides = <T extends { id: string }>(
  reservations: T[],
  localCache: LocalReservationCache<T> = getLocalReservationCache<T>()
) => {
  const mergedReservations = reservations.map((reservation) => {
    const localReservation = localCache.overrides[reservation.id];

    if (!localReservation) {
      return reservation;
    }

    return mergeReservationWithLocalOverride(reservation, localReservation);
  });
  const existingIds = new Set(mergedReservations.map((reservation) => reservation.id));
  const newLocalReservations = Object.values(localCache.overrides).filter(
    (reservation) => !existingIds.has(reservation.id)
  );

  return [...newLocalReservations, ...mergedReservations];
};

export const useAppliedLocalReservationOverrides = <T extends { id: string }>(
  reservations: T[]
) => {
  const { data: localCache = createEmptyLocalReservationCache<T>() } = useLocalReservationCache<T>();

  return useMemo(
    () => applyLocalReservationOverrides(reservations, localCache),
    [localCache, reservations]
  );
};

export const useLocalReservationOverride = <T extends { id: string }>(reservationId: string) => {
  const { data: localCache = createEmptyLocalReservationCache<T>() } = useLocalReservationCache<T>();

  return useMemo(
    () => getLocalReservationOverride(reservationId, localCache) ?? null,
    [localCache, reservationId]
  );
};
