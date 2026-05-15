interface PetDeleteModalCopy {
  confirmDisabled: boolean;
  description: string;
  question: string;
  warningTitle?: string;
}

const formatReservationsCount = (reservationsCount: number) =>
  `${reservationsCount} reserva${reservationsCount === 1 ? '' : 's'} registrada${reservationsCount === 1 ? '' : 's'}`;

export const buildPetDeleteModalCopy = (
  petName?: string,
  reservationsCount = 0
): PetDeleteModalCopy => {
  const resolvedPetName = petName?.trim() || 'esta mascota';

  if (reservationsCount > 0) {
    return {
      confirmDisabled: true,
      description: `Esta mascota tiene ${formatReservationsCount(reservationsCount)}.`,
      question: `No puedes eliminar ${resolvedPetName} mientras tenga reservas asociadas.`,
      warningTitle: 'Esta mascota no se puede eliminar mientras tenga reservas asociadas.',
    };
  }

  return {
    confirmDisabled: false,
    description: 'Esta mascota no tiene reservas registradas. Esta acción no se puede deshacer.',
    question: `¿Seguro que quieres eliminar ${resolvedPetName}?`,
  };
};
