import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  Calendar,
  User,
  DoorOpen,
  CreditCard,
  FileText,
  Dog,
  Cat,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ReservationStatusBadge } from '../components/reservations/reservation-status-badge';
import { ConfirmReservationModal } from '../components/reservations/confirm-reservation-modal';
import {
  buildReturnNavigationState,
  getSafeReturnNavigation,
  type ReturnNavigationState,
} from '../utils/return-navigation';
import {
  fetchReservationDetail,
  extractReservationNumericId,
  formatReservationCode,
  updateReservationStatusRequest,
  type ReservationRecord,
} from '../utils/reservations-api';
import {
  mergeReservationWithLocalOverride,
  saveLocalReservationOverride,
  useLocalReservationOverride,
} from '../utils/reservation-local-overrides';
import {
  buildReservationPaymentPath,
  type ReservationPaymentNavigationState,
} from '../utils/reservation-payment-navigation';

interface ReservationDetailLocationState extends ReturnNavigationState {
  reservation?: Partial<ReservationRecord>;
}

export default function ReservationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const navigationState = location.state as ReservationDetailLocationState | null;
  const { destination: backDestination, label: backLabel } = getSafeReturnNavigation(
    navigationState,
    '/reservas',
    'Volver a reservas'
  );
  const currentReservationId = id ?? '';
  const numericReservationId = extractReservationNumericId(currentReservationId);
  const normalizedReservationId = Number.isFinite(numericReservationId)
    ? formatReservationCode(numericReservationId)
    : currentReservationId;
  const localOverride = useLocalReservationOverride<ReservationRecord>(normalizedReservationId);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['reservation-detail', normalizedReservationId],
    queryFn: () => fetchReservationDetail(currentReservationId),
    enabled: Boolean(currentReservationId),
  });

  const reservation =
    localOverride && data
      ? mergeReservationWithLocalOverride(data, localOverride)
      : localOverride ?? data ?? null;

  useEffect(() => {
    if (!reservation) {
      return;
    }

    queryClient.setQueryData<ReservationRecord[]>(
      ['reservations-page'],
      (currentReservations = []) => {
        const hasReservation = currentReservations.some(
          (currentReservation) => currentReservation.id === reservation.id
        );

        if (!hasReservation) {
          return currentReservations;
        }

        return currentReservations.map((currentReservation) =>
          currentReservation.id === reservation.id
            ? {
                ...currentReservation,
                ...reservation,
              }
            : currentReservation
        );
      }
    );
  }, [queryClient, reservation]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const calculateDays = () => {
    if (!reservation) {
      return 0;
    }

    const start = new Date(reservation.checkIn);
    const end = new Date(reservation.checkOut);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (isLoading && !reservation) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(backDestination)}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>
        </div>
        <Card className="border-0 p-8 shadow-md">
          <p className="text-sm text-gray-600">Cargando detalle de la reserva...</p>
        </Card>
      </div>
    );
  }

  if (isError && !reservation) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(backDestination)}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>
        </div>
        <Card className="border-0 p-8 shadow-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              {error instanceof Error
                ? error.message
                : 'No se pudo cargar el detalle de la reserva.'}
            </p>
            <Button variant="outline" onClick={() => refetch()} className="border-gray-200">
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!reservation) {
    return null;
  }

  const servicesSubtotal = reservation.services.reduce(
    (sum, service) => sum + service.price * service.quantity,
    0
  );
  const subtotalBeforeDiscount =
    typeof reservation.lodgingAmount === 'number'
      ? reservation.lodgingAmount + servicesSubtotal
      : reservation.totalAmount + reservation.discount;
  const canPayReservation =
    reservation.paymentStatus !== 'paid' && reservation.status === 'confirmed';
  const canCreateTracking = reservation.status === 'in_progress' && reservation.pets.length > 0;
  const handleConfirmUnavailable = () => {
    setIsConfirmModalOpen(true);
  };

  const handleGoToPayment = () => {
    if (!canPayReservation) {
      toast.info('Pago no disponible', {
        description: 'Solo se pueden pagar reservas confirmadas pendientes de pago.',
      });
      return;
    }

    const paymentReturnPath = `/reservas/${reservation.id}`;
    const paymentState: ReservationPaymentNavigationState = {
      returnTo: paymentReturnPath,
      returnLabel: 'Volver a reserva',
      returnState: buildReturnNavigationState(backDestination, backLabel),
    };

    navigate(
      buildReservationPaymentPath(reservation, {
        returnTo: paymentState.returnTo,
        returnLabel: paymentState.returnLabel,
      }),
      { state: paymentState }
    );
  };

  const handleEditUnavailable = () => {
    navigate(`/reservas/${reservation.id}/editar`, {
      state: buildReturnNavigationState(`/reservas/${reservation.id}`, 'Volver a reserva'),
    });
  };

  const handleCreateTracking = (petId?: number) => {
    if (!canCreateTracking) {
      toast.info('Seguimiento no disponible', {
        description: 'Solo se pueden registrar seguimientos cuando la reserva está en curso.',
      });
      return;
    }

    const targetPetId = petId ?? (reservation.pets.length === 1 ? reservation.pets[0]?.id : null);

    if (!targetPetId) {
      toast.info('Selecciona la mascota', {
        description: 'Esta reserva tiene varias mascotas. Elige cuál quieres registrar.',
      });
      return;
    }

    navigate(`/seguimiento?petId=${targetPetId}&openNew=1`);
  };

  const handleConfirmReservation = async (updatedReservation: ReservationRecord) => {
    try {
      const savedReservation = await updateReservationStatusRequest(
        updatedReservation.numericId,
        updatedReservation.status
      );
      const nextReservation = savedReservation
        ? {
            ...updatedReservation,
            ...savedReservation,
            checkinData: updatedReservation.checkinData ?? savedReservation.checkinData,
            checkoutData: updatedReservation.checkoutData ?? savedReservation.checkoutData,
          }
        : updatedReservation;

      saveLocalReservationOverride(nextReservation);
      queryClient.setQueryData<ReservationRecord[]>(
        ['reservations-page'],
        (currentReservations = []) => {
          const hasReservation = currentReservations.some(
            (currentReservation) => currentReservation.id === nextReservation.id
          );

          if (!hasReservation) {
            return [nextReservation, ...currentReservations];
          }

          return currentReservations.map((currentReservation) =>
            currentReservation.id === nextReservation.id ? nextReservation : currentReservation
          );
        }
      );
      queryClient.setQueryData<ReservationRecord>(
        ['reservation-detail', nextReservation.id],
        nextReservation
      );
      void queryClient.invalidateQueries({ queryKey: ['reservations-page'] });
      void queryClient.invalidateQueries({ queryKey: ['reservation-detail', nextReservation.id] });
      toast.success('Reserva confirmada', {
        description: `${nextReservation.id} se ha confirmado correctamente.`,
      });
      setIsConfirmModalOpen(false);
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'No se pudo confirmar la reserva';
      toast.error('No se pudo confirmar la reserva', {
        description: message,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(backDestination)}
          className="text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h2 className="text-gray-900">Reserva {reservation.id}</h2>
            <ReservationStatusBadge status={reservation.status} />
          </div>
          <p className="text-sm text-gray-600">Creada el {formatDate(reservation.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          {canCreateTracking && reservation.pets.length === 1 && (
            <Button
              variant="outline"
              onClick={() => handleCreateTracking(reservation.pets[0].id)}
              className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
            >
              <Activity className="mr-2 h-4 w-4" />
              Registrar seguimiento
            </Button>
          )}
          {reservation.status === 'pending' && (
            <Button
              variant="outline"
              onClick={handleConfirmUnavailable}
              className="border-sky-200 text-sky-700 hover:bg-sky-50"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar reserva
            </Button>
          )}
          {canPayReservation && (
            <Button
              onClick={handleGoToPayment}
              className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Ir a pagar
            </Button>
          )}
          {(reservation.status === 'pending' ||
            reservation.status === 'confirmed' ||
            reservation.status === 'in_progress') && (
            <Button
              variant="outline"
              onClick={handleEditUnavailable}
            >
              Editar reserva
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-0 p-6 shadow-md">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="flex items-center gap-2 text-gray-900">
                <User className="h-5 w-5 text-blue-500" />
                Cliente
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigate(`/clientes/${reservation.client.id}`, {
                    state: buildReturnNavigationState(
                      `/reservas/${reservation.id}`,
                      'Volver a reserva'
                    ),
                  })
                }
                className="text-blue-600 hover:text-blue-700"
              >
                Ver perfil
              </Button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-sm text-gray-500">Nombre completo</p>
                <p className="text-gray-900">{reservation.client.name}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm text-gray-500">Email</p>
                  <p className="text-sm text-gray-900">
                    {reservation.client.email || 'No disponible'}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-sm text-gray-500">Telefono</p>
                  <p className="text-sm text-gray-900">
                    {reservation.client.phone || 'No disponible'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-0 p-6 shadow-md">
            <h3 className="mb-4 flex items-center gap-2 text-gray-900">
              <Dog className="h-5 w-5 text-green-500" />
              Mascotas hospedadas
            </h3>
            <div className="space-y-3">
              {reservation.pets.map((pet) => (
                <div
                  key={pet.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        pet.species === 'Perro'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-purple-100 text-purple-600'
                      }`}
                    >
                      {pet.species === 'Perro' ? (
                        <Dog className="h-5 w-5" />
                      ) : (
                        <Cat className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{pet.name}</p>
                      <p className="text-sm text-gray-600">
                        {pet.breed} · {pet.age} {pet.age === 1 ? 'año' : 'años'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateTracking(pet.id)}
                    className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    Seguimiento
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      navigate(`/mascotas/${pet.id}`, {
                        state: buildReturnNavigationState(
                          `/reservas/${reservation.id}`,
                          'Volver a reserva'
                        ),
                      })
                    }
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Ver ficha
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          {reservation.notes && (
            <Card className="border-0 p-6 shadow-md">
              <h3 className="mb-3 flex items-center gap-2 text-gray-900">
                <FileText className="h-5 w-5 text-amber-500" />
                Notas y observaciones
              </h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
                {reservation.notes}
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-0 p-6 shadow-md">
            <h3 className="mb-4 flex items-center gap-2 text-gray-900">
              <Calendar className="h-5 w-5 text-purple-500" />
              Detalles de estancia
            </h3>
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-sm text-gray-500">Entrada</p>
                <p className="text-gray-900">{formatDate(reservation.checkIn)}</p>
              </div>
              <div>
                <p className="mb-1 text-sm text-gray-500">Salida</p>
                <p className="text-gray-900">{formatDate(reservation.checkOut)}</p>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <p className="mb-1 text-sm text-gray-500">Duracion</p>
                <p className="font-medium text-gray-900">
                  {calculateDays()} {calculateDays() === 1 ? 'día' : 'días'}
                </p>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <p className="mb-1 flex items-center gap-1.5 text-sm text-gray-500">
                  <DoorOpen className="h-4 w-4" />
                  Sala asignada
                </p>
                <p className="font-medium text-gray-900">{reservation.room}</p>
              </div>
            </div>
          </Card>

          <Card className="border-0 p-6 shadow-md">
            <h3 className="mb-4 flex items-center gap-2 text-gray-900">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Resumen de pago
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
                <div>
                  <p className="text-sm text-gray-500">Estado de pago</p>
                  <p className="font-medium text-gray-900">
                    {reservation.paymentStatus === 'paid' ? 'Pagada' : 'Pendiente de pago'}
                  </p>
                </div>
                {canPayReservation && (
                  <Button
                    size="sm"
                    onClick={handleGoToPayment}
                    className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pagar
                  </Button>
                )}
              </div>
              {reservation.services.length > 0 ? (
                reservation.services.map((service) => (
                  <div key={`${service.id}-${service.name}`} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {service.name} x{service.quantity}
                    </span>
                    <span className="text-gray-900">
                      {formatAmount(service.price * service.quantity)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-600">No hay servicios asociados.</p>
              )}
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal antes de descuento</span>
                  <span className="text-gray-900">{formatAmount(subtotalBeforeDiscount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Descuento</span>
                  <span className="text-gray-900">
                    {reservation.discount > 0
                      ? `-${formatAmount(reservation.discount)}`
                      : formatAmount(0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Servicios</span>
                  <span className="text-gray-900">{formatAmount(servicesSubtotal)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-3">
                  <span className="font-medium text-gray-900">Total</span>
                  <span className="text-lg font-medium text-gray-900">
                    {formatAmount(reservation.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {isConfirmModalOpen && reservation.status === 'pending' && (
        <ConfirmReservationModal
          isOpen
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleConfirmReservation}
          onEditReservation={(reservationToEdit) =>
            navigate(`/reservas/${reservationToEdit.id}/editar`, {
              state: buildReturnNavigationState(
                `/reservas/${reservationToEdit.id}`,
                'Volver a reserva'
              ),
            })
          }
          reservation={reservation}
        />
      )}
    </div>
  );
}
