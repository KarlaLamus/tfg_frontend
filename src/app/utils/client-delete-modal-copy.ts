interface ClientDeleteModalCopy {
  confirmDisabled: boolean;
  description: string;
  question: string;
  warningTitle?: string;
}

const formatRegisteredPetsCount = (petsCount: number) =>
  `${petsCount} mascota${petsCount === 1 ? '' : 's'} registrada${petsCount === 1 ? '' : 's'}`;

export const buildClientDeleteModalCopy = (
  clientName?: string,
  petsCount = 0
): ClientDeleteModalCopy => {
  const resolvedClientName = clientName?.trim() || 'este cliente';

  if (petsCount > 0) {
    return {
      confirmDisabled: true,
      description: `Este cliente tiene ${formatRegisteredPetsCount(petsCount)}.`,
      question: `No puedes eliminar ${resolvedClientName} mientras tenga mascotas registradas.`,
      warningTitle:
        'Para eliminar este cliente, primero borra sus mascotas registradas y vuelve a intentarlo.',
    };
  }

  return {
    confirmDisabled: false,
    description: 'Este cliente no tiene mascotas registradas. Esta acción no se puede deshacer.',
    question: `¿Seguro que quieres eliminar ${resolvedClientName}?`,
  };
};
