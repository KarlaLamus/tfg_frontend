import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Dog, Cat } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AddPetModal } from '../components/pets/add-pet-modal';
import {
  EditPetModal,
  type EditablePet,
  type EditablePetSubmission,
} from '../components/pets/edit-pet-modal';
import { PetsTable } from '../components/pets/pets-table';
import { DeleteConfirmationModal } from '../components/ui/delete-confirmation-modal';
import { smartSearch } from '../utils/search';
import {
  isPetLocallyCreated,
  markPetAsLocallyDeleted,
  removeLocalPetOverride,
  saveLocalPetOverride,
  useLocalPetCache,
  useAppliedLocalPetChanges,
} from '../utils/pet-local-overrides';
import { CLIENTS_QUERY_KEY } from '../utils/clients-api';
import {
  deletePetRequest,
  fetchPetsPageData,
  mapEditablePetToPetInput,
  PETS_QUERY_KEY,
  updatePetRequest,
} from '../utils/pets-api';
import { buildPetDeleteModalCopy } from '../utils/pet-delete-modal-copy';
import {
  PAYMENTS_QUERY_KEY,
} from '../utils/payments-api';
import {
  fetchReservationsPageData,
  type ReservationRecord,
} from '../utils/reservations-api';
import { useAppliedLocalReservationOverrides } from '../utils/reservation-local-overrides';
import {
  RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY,
  RESERVATION_FORM_CLIENT_PETS_QUERY_KEY,
  RESERVATIONS_QUERY_KEY,
  TRACKING_QUERY_KEY,
  syncDeletedPetReferences,
} from '../utils/deletion-sync';

type Pet = EditablePet;

export default function PetsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<'all' | 'Perro' | 'Gato'>('all');
  const [isAddPetModalOpen, setIsAddPetModalOpen] = useState(false);
  const [isEditPetModalOpen, setIsEditPetModalOpen] = useState(false);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [petPendingDelete, setPetPendingDelete] = useState<Pet | null>(null);
  const [isDeletingPet, setIsDeletingPet] = useState(false);

  const {
    data: backendPets = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: PETS_QUERY_KEY,
    queryFn: fetchPetsPageData,
  });
  const { data: reservationsPageData = [] } = useQuery({
    queryKey: RESERVATIONS_QUERY_KEY,
    queryFn: fetchReservationsPageData,
  });

  const { data: localPetCache } = useLocalPetCache();
  const pets = useAppliedLocalPetChanges(backendPets);
  const allReservations = useAppliedLocalReservationOverrides<ReservationRecord>(
    reservationsPageData
  );

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new') {
      setIsAddPetModalOpen(true);

      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams);
    }
  }, [searchParams, setSearchParams]);

  const filteredPets = useMemo(() => {
    return pets.filter((pet) => {
      const matchesSearch = smartSearch(
        searchTerm,
        pet.name,
        pet.breed,
        pet.owner,
        pet.room ?? ''
      );
      const matchesSpecies = speciesFilter === 'all' || pet.species === speciesFilter;
      return matchesSearch && matchesSpecies;
    });
  }, [pets, searchTerm, speciesFilter]);
  const reservationsCountByPetId = useMemo(() => {
    const counts = new Map<number, number>();

    allReservations.forEach((reservation) => {
      const uniquePetIds = new Set(reservation.pets.map((reservationPet) => reservationPet.id));

      uniquePetIds.forEach((petId) => {
        counts.set(petId, (counts.get(petId) ?? 0) + 1);
      });
    });

    return counts;
  }, [allReservations]);

  const getPetReservationsCount = (petId: number) => reservationsCountByPetId.get(petId) ?? 0;

  const handleNewPet = () => {
    setIsAddPetModalOpen(true);
  };

  const handleSaveEditedPet = async (updatedPet: EditablePetSubmission) => {
    if (!updatedPet.ownerId) {
      throw new Error('No se pudo identificar al dueño de la mascota');
    }

    const { photoFile = null, ...persistedPet } = updatedPet;

    const updateResult = await updatePetRequest(updatedPet.id, mapEditablePetToPetInput(persistedPet), {
      photoFile,
    });

    if (updateResult.photoSavedToBackend && !persistedPet.photoUrl) {
      removeLocalPetOverride(updatedPet.id);
    } else {
      saveLocalPetOverride(persistedPet);
    }

    queryClient.setQueryData<Pet[]>(PETS_QUERY_KEY, (currentPets = []) =>
      currentPets.map((pet) => (pet.id === persistedPet.id ? persistedPet : pet))
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: PETS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['client-detail'] }),
      queryClient.invalidateQueries({ queryKey: ['pet-detail', String(updatedPet.id)] }),
      queryClient.invalidateQueries({ queryKey: RESERVATION_FORM_CLIENT_PETS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY }),
    ]);
    setSelectedPet(null);
  };

  const handleDeletePet = (id: number) => {
    const petToDelete = pets.find((pet) => pet.id === id);

    if (!petToDelete) {
      return;
    }

    setPetPendingDelete(petToDelete);
  };

  const handleConfirmDeletePet = async () => {
    if (!petPendingDelete) {
      return;
    }

    if (getPetReservationsCount(petPendingDelete.id) > 0) {
      toast.error('No se puede eliminar la mascota', {
        description: 'Esta mascota tiene reservas asociadas.',
      });
      return;
    }

    setIsDeletingPet(true);

    try {
      if (isPetLocallyCreated(petPendingDelete.id, localPetCache)) {
        markPetAsLocallyDeleted(petPendingDelete.id);
      } else {
        await deletePetRequest(petPendingDelete.id);
      }

      syncDeletedPetReferences(queryClient, petPendingDelete.id, petPendingDelete.ownerId);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PETS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['client-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['reservation-detail'] }),
        queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: TRACKING_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RESERVATION_FORM_CLIENT_PETS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RESERVATION_EDITOR_CLIENT_PETS_QUERY_KEY }),
      ]);

      toast.success('Mascota eliminada', {
        description: 'Se ha eliminado correctamente.',
      });
      setPetPendingDelete(null);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la mascota';
      toast.error('No se pudo eliminar la mascota', {
        description: message,
      });
    } finally {
      setIsDeletingPet(false);
    }
  };

  const deleteModalCopy = buildPetDeleteModalCopy(
    petPendingDelete?.name,
    petPendingDelete ? getPetReservationsCount(petPendingDelete.id) : 0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-1 text-gray-900">Mascotas</h2>
          <p className="text-sm text-gray-600">
            Gestiona todas las mascotas registradas en el sistema
          </p>
        </div>
        <Button
          onClick={handleNewPet}
          className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva mascota
        </Button>
      </div>

      <Card className="border-0 p-4 shadow-md">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por nombre, raza o dueño..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant={speciesFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSpeciesFilter('all')}
              className={
                speciesFilter === 'all'
                  ? 'bg-gradient-to-r from-blue-500 to-green-500 text-white'
                  : ''
              }
            >
              Todas
            </Button>
            <Button
              variant={speciesFilter === 'Perro' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSpeciesFilter('Perro')}
              className={
                speciesFilter === 'Perro'
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : ''
              }
            >
              <Dog className="mr-2 h-4 w-4" />
              Perros
            </Button>
            <Button
              variant={speciesFilter === 'Gato' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSpeciesFilter('Gato')}
              className={
                speciesFilter === 'Gato'
                  ? 'bg-purple-500 text-white hover:bg-purple-600'
                  : ''
              }
            >
              <Cat className="mr-2 h-4 w-4" />
              Gatos
            </Button>
          </div>
        </div>
      </Card>

      {isLoading && (
        <Card className="border-0 p-6 shadow-md">
          <p className="text-sm text-gray-600">Cargando mascotas...</p>
        </Card>
      )}

      {isError && (
        <Card className="space-y-4 border-0 p-6 shadow-md">
          <div className="space-y-2">
            <h3 className="text-gray-900">No se pudieron cargar las mascotas</h3>
            <p className="text-sm text-gray-600">
              {error instanceof Error ? error.message : 'Error inesperado al cargar el listado'}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="border-gray-200">
            Reintentar
          </Button>
        </Card>
      )}

      {!isLoading && !isError && (
        <>
          <PetsTable
            pets={filteredPets}
            onDelete={handleDeletePet}
            hasActiveFilters={Boolean(searchTerm) || speciesFilter !== 'all'}
            onCreatePet={handleNewPet}
          />
        </>
      )}

      {isAddPetModalOpen && (
        <AddPetModal
          key="pets-create"
          isOpen={isAddPetModalOpen}
          onClose={() => setIsAddPetModalOpen(false)}
        />
      )}
      {isEditPetModalOpen && selectedPet && (
        <EditPetModal
          key={selectedPet.id}
          isOpen={isEditPetModalOpen}
          onClose={() => {
            setIsEditPetModalOpen(false);
            setSelectedPet(null);
          }}
          onSave={handleSaveEditedPet}
          pet={selectedPet}
        />
      )}

      <DeleteConfirmationModal
        isOpen={Boolean(petPendingDelete)}
        onClose={() => setPetPendingDelete(null)}
        onConfirm={handleConfirmDeletePet}
        title="Eliminar mascota"
        entityLabel="mascota"
        itemName={petPendingDelete?.name}
        question={deleteModalCopy.question}
        description={deleteModalCopy.description}
        isDeleting={isDeletingPet}
        warningTitle={deleteModalCopy.warningTitle}
        confirmDisabled={deleteModalCopy.confirmDisabled}
      />
    </div>
  );
}
