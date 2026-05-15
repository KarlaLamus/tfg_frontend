import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from './query-client';

export interface LocalClientCache<T extends { id: number }> {
  overrides: Record<string, T>;
  created: T[];
  deletedIds: number[];
}

export const CLIENT_LOCAL_CACHE_QUERY_KEY = ['local-cache', 'clients'] as const;

const createEmptyLocalClientCache = <T extends { id: number }>(): LocalClientCache<T> => ({
  overrides: {},
  created: [],
  deletedIds: [],
});

const getLocalClientCache = <T extends { id: number }>(): LocalClientCache<T> => {
  return (
    queryClient.getQueryData<LocalClientCache<T>>(CLIENT_LOCAL_CACHE_QUERY_KEY) ??
    createEmptyLocalClientCache<T>()
  );
};

const setLocalClientCache = <T extends { id: number }>(
  updater: (currentCache: LocalClientCache<T>) => LocalClientCache<T>
) => {
  queryClient.setQueryData<LocalClientCache<T>>(CLIENT_LOCAL_CACHE_QUERY_KEY, (currentCache) =>
    updater(currentCache ?? createEmptyLocalClientCache<T>())
  );
};

export const useLocalClientCache = <T extends { id: number }>() =>
  useQuery({
    queryKey: CLIENT_LOCAL_CACHE_QUERY_KEY,
    queryFn: () => createEmptyLocalClientCache<T>(),
    initialData: () => getLocalClientCache<T>(),
    staleTime: Infinity,
    gcTime: Infinity,
  });

export const getLocalClientOverrides = <T extends { id: number }>(
  localCache: LocalClientCache<T> = getLocalClientCache<T>()
) => {
  return Object.fromEntries(
    Object.entries(localCache.overrides).map(([clientId, clientData]) => [Number(clientId), clientData])
  ) as Record<number, T>;
};

export const getLocalClientOverride = <T extends { id: number }>(
  clientId: number,
  localCache: LocalClientCache<T> = getLocalClientCache<T>()
) => {
  return localCache.overrides[String(clientId)];
};

export const getLocallyCreatedClients = <T extends { id: number }>(
  localCache: LocalClientCache<T> = getLocalClientCache<T>()
) => {
  return localCache.created;
};

export const isClientLocallyCreated = (
  clientId: number,
  localCache: LocalClientCache<{ id: number }> = getLocalClientCache<{ id: number }>()
) => {
  return localCache.created.some((client) => client.id === clientId);
};

export const getLocallyDeletedClientIds = (
  localCache: LocalClientCache<{ id: number }> = getLocalClientCache<{ id: number }>()
) => {
  return localCache.deletedIds;
};

export const saveLocalClientOverride = <T extends { id: number }>(client: T) => {
  setLocalClientCache<T>((currentCache) => ({
    ...currentCache,
    overrides: {
      ...currentCache.overrides,
      [String(client.id)]: client,
    },
    created: currentCache.created.map((createdClient) =>
      createdClient.id === client.id ? client : createdClient
    ),
    deletedIds: currentCache.deletedIds.filter((deletedId) => deletedId !== client.id),
  }));
};

export const saveLocallyCreatedClient = <T extends { id: number }>(client: T) => {
  setLocalClientCache<T>((currentCache) => ({
    ...currentCache,
    created: [
      ...currentCache.created.filter((createdClient) => createdClient.id !== client.id),
      client,
    ],
    deletedIds: currentCache.deletedIds.filter((deletedId) => deletedId !== client.id),
  }));
};

export const markClientAsLocallyDeleted = (clientId: number) => {
  setLocalClientCache<{ id: number }>((currentCache) => ({
    ...currentCache,
    overrides: Object.fromEntries(
      Object.entries(currentCache.overrides).filter(([storedClientId]) => Number(storedClientId) !== clientId)
    ),
    created: currentCache.created.filter((client) => client.id !== clientId),
    deletedIds: Array.from(new Set([...currentCache.deletedIds, clientId])),
  }));
};

export const adjustLocalClientRelationshipCounts = <
  T extends { id: number; petsCount?: number; reservationsCount?: number },
>(
  clientId: number,
  {
    petsCountDelta = 0,
    reservationsCountDelta = 0,
  }: {
    petsCountDelta?: number;
    reservationsCountDelta?: number;
  }
) => {
  setLocalClientCache<T>((currentCache) => {
    const applyCountDelta = (client: T): T => ({
      ...client,
      ...(typeof client.petsCount === 'number'
        ? { petsCount: Math.max(client.petsCount + petsCountDelta, 0) }
        : {}),
      ...(typeof client.reservationsCount === 'number'
        ? { reservationsCount: Math.max(client.reservationsCount + reservationsCountDelta, 0) }
        : {}),
    });

    return {
      ...currentCache,
      overrides: Object.fromEntries(
        Object.entries(currentCache.overrides).map(([storedClientId, client]) => [
          storedClientId,
          Number(storedClientId) === clientId ? applyCountDelta(client) : client,
        ])
      ),
      created: currentCache.created.map((client) =>
        client.id === clientId ? applyCountDelta(client) : client
      ),
    };
  });
};

export const applyLocalClientChanges = <T extends { id: number }>(
  clients: T[],
  localCache: LocalClientCache<T> = getLocalClientCache<T>()
) => {
  const createdClients = getLocallyCreatedClients(localCache);
  const deletedClientIds = new Set(getLocallyDeletedClientIds(localCache));

  const baseClients = clients
    .filter((client) => !deletedClientIds.has(client.id))
    .map((client) => localCache.overrides[String(client.id)] ?? client);
  const knownIds = new Set(baseClients.map((client) => client.id));
  const localOnlyClients = createdClients.filter(
    (client) => !deletedClientIds.has(client.id) && !knownIds.has(client.id)
  );

  return [...baseClients, ...localOnlyClients];
};

export const useAppliedLocalClientChanges = <T extends { id: number }>(clients: T[]) => {
  const { data: localCache = createEmptyLocalClientCache<T>() } = useLocalClientCache<T>();

  return useMemo(() => applyLocalClientChanges(clients, localCache), [clients, localCache]);
};

export const useLocalClientSnapshot = <T extends { id: number }>(clientId: number) => {
  const { data: localCache = createEmptyLocalClientCache<T>() } = useLocalClientCache<T>();

  return useMemo(
    () =>
      getLocalClientOverride(clientId, localCache) ??
      getLocallyCreatedClients(localCache).find((client) => client.id === clientId) ??
      null,
    [clientId, localCache]
  );
};
