import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EditablePet } from '../components/pets/edit-pet-modal';
import { queryClient } from './query-client';

export interface LocalPetCache {
  overrides: Record<string, EditablePet>;
  created: EditablePet[];
  deletedIds: number[];
}

export const PET_LOCAL_CACHE_QUERY_KEY = ['local-cache', 'pets'] as const;

const createEmptyLocalPetCache = (): LocalPetCache => ({
  overrides: {},
  created: [],
  deletedIds: [],
});

const getLocalPetCache = (): LocalPetCache => {
  return queryClient.getQueryData<LocalPetCache>(PET_LOCAL_CACHE_QUERY_KEY) ?? createEmptyLocalPetCache();
};

const setLocalPetCache = (updater: (currentCache: LocalPetCache) => LocalPetCache) => {
  queryClient.setQueryData<LocalPetCache>(PET_LOCAL_CACHE_QUERY_KEY, (currentCache) =>
    updater(currentCache ?? createEmptyLocalPetCache())
  );
};

export const useLocalPetCache = () =>
  useQuery({
    queryKey: PET_LOCAL_CACHE_QUERY_KEY,
    queryFn: createEmptyLocalPetCache,
    initialData: getLocalPetCache,
    staleTime: Infinity,
    gcTime: Infinity,
  });

export const getLocalPetOverrides = (localCache: LocalPetCache = getLocalPetCache()) => {
  return Object.fromEntries(
    Object.entries(localCache.overrides).map(([petId, petData]) => [Number(petId), petData])
  ) as Record<number, EditablePet>;
};

export const getLocalPetOverride = (
  petId: number,
  localCache: LocalPetCache = getLocalPetCache()
) => {
  return localCache.overrides[String(petId)];
};

export const saveLocalPetOverride = (pet: EditablePet) => {
  setLocalPetCache((currentCache) => ({
    ...currentCache,
    overrides: {
      ...currentCache.overrides,
      [String(pet.id)]: pet,
    },
    created: currentCache.created.map((createdPet) => (createdPet.id === pet.id ? pet : createdPet)),
    deletedIds: currentCache.deletedIds.filter((deletedId) => deletedId !== pet.id),
  }));
};

export const removeLocalPetOverride = (petId: number) => {
  setLocalPetCache((currentCache) => ({
    ...currentCache,
    overrides: Object.fromEntries(
      Object.entries(currentCache.overrides).filter(([storedPetId]) => Number(storedPetId) !== petId)
    ),
  }));
};

export const getLocallyDeletedPetIds = (localCache: LocalPetCache = getLocalPetCache()): number[] => {
  return localCache.deletedIds;
};

export const getLocallyCreatedPets = (localCache: LocalPetCache = getLocalPetCache()): EditablePet[] => {
  return localCache.created;
};

export const getLocalPetIdsForOwner = (
  ownerId: number,
  localCache: LocalPetCache = getLocalPetCache()
) => {
  return Array.from(
    new Set(
      [...Object.values(localCache.overrides), ...localCache.created]
        .filter((pet) => pet.ownerId === ownerId)
        .map((pet) => pet.id)
    )
  );
};

export const isPetLocallyCreated = (
  petId: number,
  localCache: LocalPetCache = getLocalPetCache()
) => {
  return localCache.created.some((pet) => pet.id === petId);
};

export const saveLocallyCreatedPet = (pet: EditablePet) => {
  setLocalPetCache((currentCache) => ({
    ...currentCache,
    created: [...currentCache.created.filter((item) => item.id !== pet.id), pet],
    deletedIds: currentCache.deletedIds.filter((deletedId) => deletedId !== pet.id),
  }));
};

export const isPetLocallyDeleted = (
  petId: number,
  localCache: LocalPetCache = getLocalPetCache()
) => {
  return localCache.deletedIds.includes(petId);
};

export const markPetAsLocallyDeleted = (petId: number) => {
  setLocalPetCache((currentCache) => ({
    ...currentCache,
    overrides: Object.fromEntries(
      Object.entries(currentCache.overrides).filter(([storedPetId]) => Number(storedPetId) !== petId)
    ),
    created: currentCache.created.filter((pet) => pet.id !== petId),
    deletedIds: Array.from(new Set([...currentCache.deletedIds, petId])),
  }));
};

export const clearLocalPetState = (petId: number) => {
  setLocalPetCache((currentCache) => ({
    ...currentCache,
    overrides: Object.fromEntries(
      Object.entries(currentCache.overrides).filter(([storedPetId]) => Number(storedPetId) !== petId)
    ),
    created: currentCache.created.filter((pet) => pet.id !== petId),
    deletedIds: currentCache.deletedIds.filter((deletedId) => deletedId !== petId),
  }));
};

export const clearLocalPetsForOwner = (ownerId: number) => {
  setLocalPetCache((currentCache) => {
    const ownedPetIds = new Set(getLocalPetIdsForOwner(ownerId, currentCache));

    return {
      ...currentCache,
      overrides: Object.fromEntries(
        Object.entries(currentCache.overrides).filter(
          ([, pet]) => pet.ownerId !== ownerId
        )
      ),
      created: currentCache.created.filter((pet) => pet.ownerId !== ownerId),
      deletedIds: currentCache.deletedIds.filter((deletedId) => !ownedPetIds.has(deletedId)),
    };
  });
};

export const applyLocalPetChanges = (
  pets: EditablePet[],
  localCache: LocalPetCache = getLocalPetCache()
) => {
  const deletedPetIds = new Set(getLocallyDeletedPetIds(localCache));

  const basePets = pets
    .filter((pet) => !deletedPetIds.has(pet.id))
    .map((pet) => localCache.overrides[String(pet.id)] ?? pet);
  const knownIds = new Set(basePets.map((pet) => pet.id));
  const localOnlyPets = localCache.created.filter(
    (pet) => !deletedPetIds.has(pet.id) && !knownIds.has(pet.id)
  );

  return [...basePets, ...localOnlyPets];
};

export const useAppliedLocalPetChanges = (pets: EditablePet[]) => {
  const { data: localCache = createEmptyLocalPetCache() } = useLocalPetCache();

  return useMemo(() => applyLocalPetChanges(pets, localCache), [localCache, pets]);
};

export const useLocalPetSnapshot = (petId: number) => {
  const { data: localCache = createEmptyLocalPetCache() } = useLocalPetCache();

  return useMemo(
    () =>
      getLocalPetOverride(petId, localCache) ??
      getLocallyCreatedPets(localCache).find((pet) => pet.id === petId) ??
      null,
    [localCache, petId]
  );
};
