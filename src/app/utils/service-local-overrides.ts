import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from './query-client';

export interface LocalServiceCache<T extends { id: number }> {
  overrides: Record<string, T>;
  created: T[];
  deletedIds: number[];
}

export const SERVICE_LOCAL_CACHE_QUERY_KEY = ['local-cache', 'services'] as const;

const createEmptyLocalServiceCache = <T extends { id: number }>(): LocalServiceCache<T> => ({
  overrides: {},
  created: [],
  deletedIds: [],
});

const getLocalServiceCache = <T extends { id: number }>(): LocalServiceCache<T> => {
  return (
    queryClient.getQueryData<LocalServiceCache<T>>(SERVICE_LOCAL_CACHE_QUERY_KEY) ??
    createEmptyLocalServiceCache<T>()
  );
};

const setLocalServiceCache = <T extends { id: number }>(
  updater: (currentCache: LocalServiceCache<T>) => LocalServiceCache<T>
) => {
  queryClient.setQueryData<LocalServiceCache<T>>(SERVICE_LOCAL_CACHE_QUERY_KEY, (currentCache) =>
    updater(currentCache ?? createEmptyLocalServiceCache<T>())
  );
};

export const useLocalServiceCache = <T extends { id: number }>() =>
  useQuery({
    queryKey: SERVICE_LOCAL_CACHE_QUERY_KEY,
    queryFn: () => createEmptyLocalServiceCache<T>(),
    initialData: () => getLocalServiceCache<T>(),
    staleTime: Infinity,
    gcTime: Infinity,
  });

export const getLocalServiceOverrides = <T extends { id: number }>(
  localCache: LocalServiceCache<T> = getLocalServiceCache<T>()
) => {
  return Object.fromEntries(
    Object.entries(localCache.overrides).map(([serviceId, serviceData]) => [Number(serviceId), serviceData])
  ) as Record<number, T>;
};

export const getLocallyCreatedServices = <T extends { id: number }>(
  localCache: LocalServiceCache<T> = getLocalServiceCache<T>()
) => {
  return localCache.created;
};

export const getLocallyDeletedServiceIds = (
  localCache: LocalServiceCache<{ id: number }> = getLocalServiceCache<{ id: number }>()
) => {
  return localCache.deletedIds;
};

export const saveLocalServiceOverride = <T extends { id: number }>(service: T) => {
  setLocalServiceCache<T>((currentCache) => ({
    ...currentCache,
    overrides: {
      ...currentCache.overrides,
      [String(service.id)]: service,
    },
    created: currentCache.created.map((createdService) =>
      createdService.id === service.id ? service : createdService
    ),
    deletedIds: currentCache.deletedIds.filter((deletedId) => deletedId !== service.id),
  }));
};

export const saveLocallyCreatedService = <T extends { id: number }>(service: T) => {
  setLocalServiceCache<T>((currentCache) => ({
    ...currentCache,
    created: [...currentCache.created.filter((item) => item.id !== service.id), service],
    deletedIds: currentCache.deletedIds.filter((deletedId) => deletedId !== service.id),
  }));
};

export const markServiceAsLocallyDeleted = (serviceId: number) => {
  setLocalServiceCache<{ id: number }>((currentCache) => ({
    ...currentCache,
    overrides: Object.fromEntries(
      Object.entries(currentCache.overrides).filter(
        ([storedServiceId]) => Number(storedServiceId) !== serviceId
      )
    ),
    created: currentCache.created.filter((service) => service.id !== serviceId),
    deletedIds: Array.from(new Set([...currentCache.deletedIds, serviceId])),
  }));
};

export const applyLocalServiceChanges = <T extends { id: number }>(
  services: T[],
  localCache: LocalServiceCache<T> = getLocalServiceCache<T>()
) => {
  const deletedServiceIds = new Set(getLocallyDeletedServiceIds(localCache));

  const baseServices = services
    .filter((service) => !deletedServiceIds.has(service.id))
    .map((service) => localCache.overrides[String(service.id)] ?? service);
  const knownIds = new Set(baseServices.map((service) => service.id));
  const localOnlyServices = localCache.created.filter(
    (service) => !deletedServiceIds.has(service.id) && !knownIds.has(service.id)
  );

  return [...baseServices, ...localOnlyServices];
};

export const useAppliedLocalServiceChanges = <T extends { id: number }>(services: T[]) => {
  const { data: localCache = createEmptyLocalServiceCache<T>() } = useLocalServiceCache<T>();

  return useMemo(() => applyLocalServiceChanges(services, localCache), [localCache, services]);
};
