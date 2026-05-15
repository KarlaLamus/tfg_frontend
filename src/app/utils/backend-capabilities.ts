export const BACKEND_CRUD_SUPPORT = {
  pets: {
    create: true,
    update: true,
    delete: true,
  },
  reservations: {
    create: true,
    update: true,
    statusChanges: true,
    delete: true,
  },
  payments: {
    create: true,
    update: true,
    delete: true,
  },
  tracking: {
    create: true,
    update: true,
    delete: true,
  },
} as const;

export const BACKEND_WRITE_LIMITATIONS = {
  pets:
    'La edición de mascotas se envía con PUT /api/mascotas/{id}. Si la API falla, se muestra el error devuelto.',
  reservations:
    'Las reservas se envían al backend por POST, PUT y DELETE. Si falla, se muestra el error devuelto por la API.',
  payments:
    'La API de pagos usa PUT /api/pagos/{id}/pagar para registrar o editar pagos, PUT /api/pagos/{id}/anular para anular y DELETE /api/pagos/{id} para eliminar.',
  tracking:
    'Los seguimientos se envían al backend con varios formatos y rutas de compatibilidad. Si la API falla, se muestra el error devuelto.',
} as const;
