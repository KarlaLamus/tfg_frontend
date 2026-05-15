import { useMemo, type ComponentType } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  DoorOpen,
  PawPrint,
  ShieldAlert,
  Siren,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { cn } from '../components/ui/utils';
import { useAuth } from '../auth/auth-context';
import { CLIENTS_QUERY_KEY, fetchClients } from '../utils/clients-api';
import { useAppliedLocalClientChanges } from '../utils/client-local-overrides';
import { PAYMENTS_QUERY_KEY, fetchPaymentsPageData } from '../utils/payments-api';
import { useAppliedLocalPetChanges } from '../utils/pet-local-overrides';
import { fetchPetsPageData, PETS_QUERY_KEY } from '../utils/pets-api';
import { useAppliedLocalReservationOverrides } from '../utils/reservation-local-overrides';
import {
  fetchReservationsPageData,
  type ReservationRecord,
} from '../utils/reservations-api';
import {
  mapPetSpeciesToRoomType,
  parseMixedRoomAssignment,
} from '../utils/reservation-room-availability';
import {
  fetchRoomsPageData,
  ROOMS_QUERY_KEY,
  type RoomRecord,
} from '../utils/rooms-api';
import { fetchTrackingPageData } from '../utils/tracking-api';

const RESERVATIONS_QUERY_KEY = ['reservations-page'];
const TRACKING_QUERY_KEY = ['tracking-page'];

type DashboardPeriod = 'today' | '7d' | '30d' | 'month';

interface PeriodBounds {
  start: Date;
  end: Date;
  label: string;
}

interface TrackingIncidentItem {
  petId: number;
  petName: string;
  clientName: string;
  room: string;
  createdAt: string;
  incidentText: string;
  reservationId: string;
  employeeName: string;
}

interface MetricCardProps {
  eyebrow: string;
  title: string;
  value: string;
  helper: string;
  icon: ComponentType<{ className?: string }>;
  accentClass: string;
  iconClass: string;
  iconWrapClass: string;
  trendLabel?: string;
  onClick?: () => void;
  isLoading?: boolean;
}

const startOfDay = (date: Date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const endOfDay = (date: Date) => {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
};

const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const parseDateValue = (value?: string | null) => {
  if (!value?.trim()) {
    return null;
  }

  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const isSameCalendarDay = (value: string, referenceDate: Date) => {
  const parsedDate = parseDateValue(value);

  if (!parsedDate) {
    return false;
  }

  return startOfDay(parsedDate).getTime() === startOfDay(referenceDate).getTime();
};

const isBeforeToday = (value: string, todayIso: string) => value < todayIso;

const toLocalDateKey = (value?: string | Date | null) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value.split('T')[0] ?? '' : '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const buildPeriodBounds = (period: DashboardPeriod, referenceDate: Date): PeriodBounds => {
  const today = startOfDay(referenceDate);

  switch (period) {
    case 'today':
      return {
        start: today,
        end: endOfDay(referenceDate),
        label: 'hoy',
      };
    case '7d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return {
        start,
        end: endOfDay(referenceDate),
        label: 'los últimos 7 días',
      };
    }
    case '30d': {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return {
        start,
        end: endOfDay(referenceDate),
        label: 'los últimos 30 días',
      };
    }
    case 'month':
    default:
      return {
        start: new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1),
        end: endOfDay(referenceDate),
        label: 'el mes en curso',
      };
  }
};

const buildPreviousPeriodBounds = (periodBounds: PeriodBounds): PeriodBounds => {
  const rangeDuration = periodBounds.end.getTime() - periodBounds.start.getTime();
  const previousEnd = new Date(periodBounds.start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - rangeDuration);

  return {
    start: startOfDay(previousStart),
    end: endOfDay(previousEnd),
    label: 'el periodo anterior',
  };
};

const isWithinBounds = (value: string, bounds: PeriodBounds) => {
  const parsedDate = parseDateValue(value);

  if (!parsedDate) {
    return false;
  }

  return parsedDate >= bounds.start && parsedDate <= bounds.end;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const formatCompactDate = (date: Date) =>
  date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });

const formatTrendLabel = (currentValue: number, previousValue: number) => {
  if (previousValue === 0) {
    return currentValue === 0 ? 'Sin cambios' : 'Nuevo en este periodo';
  }

  const percentage = ((currentValue - previousValue) / previousValue) * 100;
  const roundedPercentage = Math.round(percentage);
  const prefix = roundedPercentage > 0 ? '+' : '';

  return `${prefix}${roundedPercentage}% frente al periodo anterior`;
};

const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));

const normalizeRoomLabel = (value: string) => value.trim().toLowerCase();

const countReservationPetsAssignedToRoom = (
  reservation: ReservationRecord,
  room: Pick<RoomRecord, 'code' | 'type'>
) => {
  if (!reservation.room || reservation.room === 'Sin sala asignada') {
    return 0;
  }

  const mixedAssignment = parseMixedRoomAssignment(reservation.room);

  if (mixedAssignment.isMixed) {
    const assignedRoomLabel =
      room.type === 'dog' ? mixedAssignment.dogRoom : mixedAssignment.catRoom;

    if (normalizeRoomLabel(assignedRoomLabel) !== normalizeRoomLabel(room.code)) {
      return 0;
    }

    return reservation.pets.filter((pet) => mapPetSpeciesToRoomType(pet.species) === room.type)
      .length;
  }

  if (normalizeRoomLabel(reservation.room) !== normalizeRoomLabel(room.code)) {
    return 0;
  }

  return reservation.pets.length;
};

function MetricCard({
  eyebrow,
  title,
  value,
  helper,
  icon: Icon,
  accentClass,
  iconClass,
  iconWrapClass,
  trendLabel,
  onClick,
  isLoading = false,
}: MetricCardProps) {
  const content = (
    <Card
      className={cn(
        'relative h-full overflow-hidden border border-slate-200 p-5 shadow-sm transition-all',
        onClick ? 'hover:border-slate-300 hover:shadow-md' : ''
      )}
    >
      <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-70', accentClass)} />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500">{eyebrow}</p>
            <h3 className="mt-1 text-sm text-gray-700">{title}</h3>
          </div>
          <div>
            <p className="text-3xl font-semibold tracking-tight text-gray-950">
              {isLoading ? '...' : value}
            </p>
            <p className="mt-1 text-sm leading-5 text-gray-500">{helper}</p>
          </div>
          {trendLabel && (
            <Badge className="border-0 bg-slate-100 px-2.5 py-1 text-slate-700" variant="outline">
              <TrendingUp className="h-3.5 w-3.5" />
              {trendLabel}
            </Badge>
          )}
        </div>
        <div className={cn('rounded-2xl p-3', iconWrapClass)}>
          <Icon className={cn('h-6 w-6', iconClass)} />
        </div>
      </div>
    </Card>
  );

  if (!onClick) {
    return content;
  }

  return (
    <button type="button" onClick={onClick} className="block h-full w-full text-left">
      {content}
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole(['admin']);
  const selectedPeriod: DashboardPeriod = 'today';

  const {
    data: backendClients = [],
    isLoading: isLoadingClients,
    isError: isClientsError,
  } = useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: fetchClients,
  });
  const {
    data: backendPets = [],
    isLoading: isLoadingPets,
    isError: isPetsError,
  } = useQuery({
    queryKey: PETS_QUERY_KEY,
    queryFn: fetchPetsPageData,
  });
  const {
    data: backendReservations = [],
    isLoading: isLoadingReservations,
    isError: isReservationsError,
  } = useQuery({
    queryKey: RESERVATIONS_QUERY_KEY,
    queryFn: fetchReservationsPageData,
  });
  const {
    data: payments = [],
    isLoading: isLoadingPayments,
    isError: isPaymentsError,
  } = useQuery({
    queryKey: PAYMENTS_QUERY_KEY,
    queryFn: fetchPaymentsPageData,
  });
  const {
    data: trackingData,
    isLoading: isLoadingTracking,
    isError: isTrackingError,
  } = useQuery({
    queryKey: TRACKING_QUERY_KEY,
    queryFn: fetchTrackingPageData,
  });
  const {
    data: rooms = [],
    isLoading: isLoadingRooms,
    isError: isRoomsError,
  } = useQuery({
    queryKey: ROOMS_QUERY_KEY,
    queryFn: fetchRoomsPageData,
  });

  const clients = useAppliedLocalClientChanges(backendClients);
  const pets = useAppliedLocalPetChanges(backendPets);
  const reservations = useAppliedLocalReservationOverrides<ReservationRecord>(backendReservations);
  const firstName = user?.name.trim().split(/\s+/)[0] ?? 'Equipo';
  const failedSources = useMemo(
    () =>
      [
        isClientsError ? 'clientes' : null,
        isPetsError ? 'mascotas' : null,
        isReservationsError ? 'reservas' : null,
        isPaymentsError ? 'pagos' : null,
        isTrackingError ? 'seguimiento' : null,
        isRoomsError ? 'salas' : null,
      ].filter((source): source is string => source !== null),
    [
      isClientsError,
      isPaymentsError,
      isPetsError,
      isReservationsError,
      isRoomsError,
      isTrackingError,
    ]
  );

  const now = new Date();
  const today = startOfDay(now);
  const todayIso = formatDateForInput(today);
  const periodBounds = useMemo(
    () => buildPeriodBounds(selectedPeriod, now),
    [now, selectedPeriod]
  );
  const previousPeriodBounds = useMemo(
    () => buildPreviousPeriodBounds(periodBounds),
    [periodBounds]
  );
  const selectedPeriodMeta = { value: 'today' as const, label: 'Hoy', helper: 'Jornada actual' };
  const formattedPeriodRange =
    startOfDay(periodBounds.start).getTime() === startOfDay(periodBounds.end).getTime()
      ? formatCompactDate(periodBounds.start)
      : `${formatCompactDate(periodBounds.start)} - ${formatCompactDate(periodBounds.end)}`;

  const dashboardData = useMemo(() => {
    const trackingPetById = new Map((trackingData?.pets ?? []).map((pet) => [pet.id, pet]));
    const activeStays = reservations.filter((reservation) => reservation.status === 'in_progress');
    const confirmedReservations = reservations.filter(
      (reservation) => reservation.status === 'confirmed'
    );
    const pendingConfirmations = reservations.filter(
      (reservation) => reservation.status === 'pending'
    );
    const confirmedUnpaidReservations = confirmedReservations.filter(
      (reservation) => reservation.paymentStatus !== 'paid'
    );
    const arrivalsToday = reservations.filter(
      (reservation) =>
        !['cancelled', 'completed'].includes(reservation.status) &&
        isSameCalendarDay(reservation.checkIn, today)
    );
    const departuresToday = reservations.filter(
      (reservation) =>
        !['cancelled', 'completed'].includes(reservation.status) &&
        isSameCalendarDay(reservation.checkOut, today)
    );
    const overdueCheckins = reservations.filter(
      (reservation) =>
        reservation.status === 'confirmed' && isBeforeToday(reservation.checkIn, todayIso)
    );
    const overdueCheckouts = reservations.filter(
      (reservation) =>
        reservation.status === 'in_progress' && isBeforeToday(reservation.checkOut, todayIso)
    );
    const blockedCheckinsToday = arrivalsToday.filter(
      (reservation) =>
        reservation.status === 'confirmed' && reservation.paymentStatus !== 'paid'
    );
    const readyCheckinsToday = arrivalsToday.filter(
      (reservation) =>
        reservation.status === 'confirmed' && reservation.paymentStatus === 'paid'
    );

    const periodPayments = payments.filter(
      (payment) => payment.status === 'paid' && isWithinBounds(payment.date, periodBounds)
    );
    const previousPeriodPayments = payments.filter(
      (payment) => payment.status === 'paid' && isWithinBounds(payment.date, previousPeriodBounds)
    );
    const periodRevenue = periodPayments.reduce((sum, payment) => sum + payment.total, 0);
    const previousPeriodRevenue = previousPeriodPayments.reduce(
      (sum, payment) => sum + payment.total,
      0
    );
    const periodDiscounts = periodPayments.reduce((sum, payment) => sum + payment.discount, 0);
    const cancelledPaymentsPeriod = payments.filter(
      (payment) => payment.status === 'cancelled' && isWithinBounds(payment.date, periodBounds)
    ).length;
    const averageTicket = periodPayments.length > 0 ? periodRevenue / periodPayments.length : 0;

    const periodClientRegistrations = clients.filter((client) =>
      isWithinBounds(client.registeredAt, periodBounds)
    ).length;
    const previousClientRegistrations = clients.filter((client) =>
      isWithinBounds(client.registeredAt, previousPeriodBounds)
    ).length;
    const createdReservationsPeriod = reservations.filter((reservation) =>
      isWithinBounds(reservation.createdAt, periodBounds)
    ).length;
    const previousCreatedReservations = reservations.filter((reservation) =>
      isWithinBounds(reservation.createdAt, previousPeriodBounds)
    ).length;

    const operationalRooms = rooms.filter((room) => room.status === 'operational');
    const maintenanceRooms = rooms.filter((room) => room.status === 'maintenance');
    const operationalRoomsWithDerivedOccupancy = operationalRooms.map((room) => {
      const currentOccupancy = activeStays.reduce(
        (sum, reservation) => sum + countReservationPetsAssignedToRoom(reservation, room),
        0
      );

      return {
        ...room,
        currentOccupancy,
        occupied: currentOccupancy > 0,
      };
    });
    const operationalCapacity = operationalRoomsWithDerivedOccupancy.reduce(
      (sum, room) => sum + room.capacity,
      0
    );
    const occupiedSlots = operationalRoomsWithDerivedOccupancy.reduce(
      (sum, room) => sum + room.currentOccupancy,
      0
    );
    const occupiedRooms = operationalRoomsWithDerivedOccupancy.filter(
      (room) => room.currentOccupancy > 0
    ).length;
    const occupancyRate =
      operationalCapacity > 0 ? (occupiedSlots / operationalCapacity) * 100 : 0;
    const dogRooms = operationalRoomsWithDerivedOccupancy.filter((room) => room.type === 'dog');
    const catRooms = operationalRoomsWithDerivedOccupancy.filter((room) => room.type === 'cat');
    const dogCapacity = dogRooms.reduce((sum, room) => sum + room.capacity, 0);
    const catCapacity = catRooms.reduce((sum, room) => sum + room.capacity, 0);
    const dogOccupancy = dogRooms.reduce((sum, room) => sum + room.currentOccupancy, 0);
    const catOccupancy = catRooms.reduce((sum, room) => sum + room.currentOccupancy, 0);
    const roomPressure = operationalRoomsWithDerivedOccupancy
      .map((room) => ({
        ...room,
        occupancyRate: room.capacity > 0 ? (room.currentOccupancy / room.capacity) * 100 : 0,
      }))
      .sort((firstRoom, secondRoom) => {
        if (secondRoom.occupancyRate !== firstRoom.occupancyRate) {
          return secondRoom.occupancyRate - firstRoom.occupancyRate;
        }

        return secondRoom.currentOccupancy - firstRoom.currentOccupancy;
      })
      .slice(0, 5);

    const flatTrackingRecords =
      trackingData?.pets.flatMap((pet) =>
        (trackingData.trackingByPetId[pet.id] ?? []).map((record) => ({
          petId: pet.id,
          petName: pet.name,
          clientName: pet.client.name,
          room: pet.reservation.room,
          createdAt: record.createdAt,
          incidentText: record.incidents,
          reservationId: pet.reservation.id,
          employeeName: record.employee.name,
        }))
      ) ?? [];
    const periodTrackingRecords = flatTrackingRecords.filter((record) =>
      isWithinBounds(record.createdAt, periodBounds)
    );
    const previousPeriodTrackingRecords = flatTrackingRecords.filter((record) =>
      isWithinBounds(record.createdAt, previousPeriodBounds)
    );
    const periodIncidentRecords = periodTrackingRecords.filter(
      (record): record is TrackingIncidentItem => Boolean(record.incidentText)
    );
    const uniqueIncidentPets = Array.from(
      periodIncidentRecords
        .sort(
          (firstRecord, secondRecord) =>
            (parseDateValue(secondRecord.createdAt)?.getTime() ?? 0) -
            (parseDateValue(firstRecord.createdAt)?.getTime() ?? 0)
        )
        .reduce((incidentMap, record) => {
          if (!incidentMap.has(record.petId)) {
            incidentMap.set(record.petId, record);
          }

          return incidentMap;
        }, new Map<number, TrackingIncidentItem>())
        .values()
    ).slice(0, 5);

    const petsCurrentlyHosted = Array.from(
      activeStays
        .flatMap((reservation) =>
          reservation.pets.map((pet) => ({
            id: pet.id,
            name: pet.name,
            species: pet.species,
            reservationId: reservation.id,
            room: reservation.room,
          }))
        )
        .reduce((petsMap, pet) => {
          if (!petsMap.has(pet.id)) {
            petsMap.set(pet.id, pet);
          }

          return petsMap;
        }, new Map<number, { id: number; name: string; species: string; reservationId: string; room: string }>())
        .values()
    );
    const petsWithTrackingToday = petsCurrentlyHosted.filter((pet) => {
      const trackingRecords = trackingData?.trackingByPetId[pet.id] ?? [];

      if (
        trackingRecords.some(
          (record) =>
            toLocalDateKey(record.createdAt || record.date) === todayIso
        )
      ) {
        return true;
      }

      return toLocalDateKey(trackingPetById.get(pet.id)?.lastTracking?.date) === todayIso;
    }).length;
    const petsMissingTrackingToday = petsCurrentlyHosted.length - petsWithTrackingToday;
    const trackingCoverage =
      petsCurrentlyHosted.length > 0
        ? (petsWithTrackingToday / petsCurrentlyHosted.length) * 100
        : 100;

    return {
      activeStays,
      confirmedReservations,
      pendingConfirmations,
      confirmedUnpaidReservations,
      arrivalsToday,
      departuresToday,
      overdueCheckins,
      overdueCheckouts,
      blockedCheckinsToday,
      readyCheckinsToday,
      periodRevenue,
      previousPeriodRevenue,
      periodPaidPaymentsCount: periodPayments.length,
      periodDiscounts,
      cancelledPaymentsPeriod,
      averageTicket,
      periodClientRegistrations,
      previousClientRegistrations,
      createdReservationsPeriod,
      previousCreatedReservations,
      occupiedRooms,
      operationalRooms,
      maintenanceRooms,
      operationalCapacity,
      occupiedSlots,
      occupancyRate,
      dogCapacity,
      catCapacity,
      dogOccupancy,
      catOccupancy,
      roomPressure,
      periodTrackingRecords,
      previousPeriodTrackingRecordsCount: previousPeriodTrackingRecords.length,
      periodIncidentRecords,
      uniqueIncidentPets,
      petsCurrentlyHosted,
      petsWithTrackingToday,
      petsMissingTrackingToday,
      trackingCoverage,
    };
  }, [
    clients,
    payments,
    periodBounds,
    previousPeriodBounds,
    reservations,
    rooms,
    today,
    todayIso,
    trackingData,
  ]);

  const isLoadingDashboard =
    isLoadingClients ||
    isLoadingPets ||
    isLoadingReservations ||
    isLoadingPayments ||
    isLoadingTracking ||
    isLoadingRooms;

  const heroAlert =
    dashboardData.overdueCheckouts.length > 0
      ? {
          title: 'Hay salidas pendientes de cerrar',
          description: `${dashboardData.overdueCheckouts.length} reserva${
            dashboardData.overdueCheckouts.length === 1 ? '' : 's'
          } siguen abiertas aunque la fecha de salida ya pasó.`,
          className: 'border-red-200 bg-red-50 text-red-900',
          descriptionClassName: 'text-red-800',
          icon: Siren,
          ctaLabel: 'Ver reservas',
          onClick: () =>
            navigate({
              pathname: '/reservas',
              search: buildDashboardSearch({ status: 'in_progress' }),
            }),
        }
      : dashboardData.blockedCheckinsToday.length > 0
        ? {
            title: 'Hay entradas de hoy pendientes de pago',
            description: `${dashboardData.blockedCheckinsToday.length} reserva${
              dashboardData.blockedCheckinsToday.length === 1 ? '' : 's'
            } confirmada${dashboardData.blockedCheckinsToday.length === 1 ? '' : 's'} todavía no pueden hacer check-in.`,
            className: 'border-amber-200 bg-amber-50 text-amber-900',
            descriptionClassName: 'text-amber-800',
            icon: AlertTriangle,
            ctaLabel: 'Ver reservas',
            onClick: () =>
              navigate({
                pathname: '/reservas',
                search: buildDashboardSearch({
                  status: 'confirmed',
                  paymentStatus: 'pending',
                  date: todayIso,
                }),
              }),
          }
        : dashboardData.pendingConfirmations.length > 0
          ? {
              title: 'Hay reservas pendientes de confirmar',
              description: `${dashboardData.pendingConfirmations.length} solicitud${
                dashboardData.pendingConfirmations.length === 1 ? '' : 'es'
              } siguen esperando confirmación.`,
              className: 'border-sky-200 bg-sky-50 text-sky-900',
              descriptionClassName: 'text-sky-800',
              icon: ShieldAlert,
              ctaLabel: 'Ver reservas',
              onClick: () =>
                navigate({
                  pathname: '/reservas',
                  search: buildDashboardSearch({ status: 'pending' }),
                }),
            }
          : {
              title: 'Todo va bien por ahora',
              description: 'No hay bloqueos importantes. Puedes seguir con pagos, entradas y seguimiento.',
              className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
              descriptionClassName: 'text-emerald-800',
              icon: CheckCircle2,
              ctaLabel: null,
              onClick: null,
            };

  const buildDashboardSearch = (params: Record<string, string | null | undefined>) => {
    const nextSearchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (!value) {
        return;
      }

      nextSearchParams.set(key, value);
    });

    const search = nextSearchParams.toString();
    return search ? `?${search}` : '';
  };

  const paymentsDateFilterByPeriod: Record<DashboardPeriod, string> = {
    today: 'today',
    '7d': 'last_7_days',
    '30d': 'last_30_days',
    month: 'this_month',
  };

  const metricCards = [
    {
      eyebrow: 'Hoy',
      title: 'Entradas',
      value: String(dashboardData.arrivalsToday.length),
      helper: `${dashboardData.readyCheckinsToday.length} listas para entrar • ${dashboardData.blockedCheckinsToday.length} pendientes de pago`,
      icon: CalendarDays,
      accentClass: 'from-sky-500 to-blue-500',
      iconClass: 'text-sky-700',
      iconWrapClass: 'bg-sky-100',
      onClick: () =>
        navigate({
          pathname: '/reservas',
          search: buildDashboardSearch({ date: todayIso, status: 'in_progress' }),
        }),
    },
    {
      eyebrow: 'Ahora',
      title: 'Mascotas alojadas',
      value: String(dashboardData.activeStays.length),
      helper: `${dashboardData.petsCurrentlyHosted.length} alojadas ahora • ${pets.length} en total`,
      icon: PawPrint,
      accentClass: 'from-emerald-500 to-green-500',
      iconClass: 'text-emerald-700',
      iconWrapClass: 'bg-emerald-100',
      onClick: () =>
        navigate({
          pathname: '/reservas',
          search: buildDashboardSearch({ status: 'in_progress' }),
        }),
    },
    {
      eyebrow: 'Pagos',
      title: 'Reservas por cobrar',
      value: String(dashboardData.confirmedUnpaidReservations.length),
      helper: 'Reservas confirmadas que siguen sin pagar',
      icon: CreditCard,
      accentClass: 'from-amber-500 to-orange-500',
      iconClass: 'text-amber-700',
      iconWrapClass: 'bg-amber-100',
      onClick: () =>
        navigate({
          pathname: '/reservas',
          search: buildDashboardSearch({
            status: 'confirmed',
            paymentStatus: 'pending',
          }),
        }),
    },
    {
      eyebrow: 'Salas',
      title: 'Ocupación',
      value: `${Math.round(clampPercentage(dashboardData.occupancyRate))}%`,
      helper: `${dashboardData.occupiedSlots}/${dashboardData.operationalCapacity} plazas ocupadas`,
      icon: DoorOpen,
      accentClass: 'from-violet-500 to-fuchsia-500',
      iconClass: 'text-violet-700',
      iconWrapClass: 'bg-violet-100',
      onClick: () =>
        navigate({
          pathname: '/salas',
          search: buildDashboardSearch({
            status: 'operational',
            occupancy: 'occupied',
          }),
        }),
    },
    {
      eyebrow: selectedPeriodMeta.label,
      title: 'Incidencias',
      value: String(dashboardData.periodIncidentRecords.length),
      helper: `Incidencias registradas en ${periodBounds.label}`,
      icon: ClipboardList,
      accentClass: 'from-rose-500 to-red-500',
      iconClass: 'text-rose-700',
      iconWrapClass: 'bg-rose-100',
      onClick: () =>
        navigate({
          pathname: '/seguimiento',
          search: buildDashboardSearch({ incidentStatus: 'with_incidents' }),
        }),
    },
    isAdmin
      ? {
          eyebrow: selectedPeriodMeta.label,
          title: 'Cobrado',
          value: formatCurrency(dashboardData.periodRevenue),
          helper: `${dashboardData.createdReservationsPeriod} reservas nuevas • ${dashboardData.periodClientRegistrations} clientes nuevos`,
          icon: Wallet,
          accentClass: 'from-teal-500 to-emerald-500',
          iconClass: 'text-teal-700',
          iconWrapClass: 'bg-teal-100',
          trendLabel: formatTrendLabel(
            dashboardData.periodRevenue,
            dashboardData.previousPeriodRevenue
          ),
          onClick: () =>
            navigate({
              pathname: '/pagos',
              search: buildDashboardSearch({
                status: 'paid',
                date: paymentsDateFilterByPeriod[selectedPeriod],
              }),
            }),
        }
      : {
          eyebrow: 'Seguimiento',
          title: 'Seguimiento de hoy',
          value: `${Math.round(clampPercentage(dashboardData.trackingCoverage))}%`,
          helper: `${dashboardData.petsWithTrackingToday}/${dashboardData.petsCurrentlyHosted.length || 0} mascotas con seguimiento hecho`,
          icon: Activity,
          accentClass: 'from-cyan-500 to-sky-500',
          iconClass: 'text-cyan-700',
          iconWrapClass: 'bg-cyan-100',
          trendLabel: formatTrendLabel(
            dashboardData.periodTrackingRecords.length,
            dashboardData.previousPeriodTrackingRecordsCount
          ),
          onClick: () => navigate('/seguimiento'),
        },
  ];

  const simpleMetricCards = metricCards.slice(0, 4);
  const todaySummaryItems = [
    {
      label: 'Entradas de hoy',
      value: dashboardData.arrivalsToday.length,
      helper: `${dashboardData.readyCheckinsToday.length} listas para entrar`,
      onClick: () =>
        navigate({
          pathname: '/reservas',
          search: buildDashboardSearch({ date: todayIso }),
        }),
    },
    {
      label: 'Salidas de hoy',
      value: dashboardData.departuresToday.length,
      helper: `${dashboardData.overdueCheckouts.length} pendientes de cerrar`,
      onClick: () =>
        navigate({
          pathname: '/reservas',
          search: buildDashboardSearch({ status: 'in_progress' }),
        }),
    },
    {
      label: 'Pagos pendientes',
      value: dashboardData.confirmedUnpaidReservations.length,
      helper: 'Reservas confirmadas sin pago',
      onClick: () =>
        navigate({
          pathname: '/reservas',
          search: buildDashboardSearch({
            status: 'confirmed',
            paymentStatus: 'pending',
          }),
        }),
    },
    {
      label: 'Seguimiento pendiente',
      value: dashboardData.petsMissingTrackingToday,
      helper: 'Mascotas alojadas sin registro hoy',
      onClick: () =>
        navigate({
          pathname: '/seguimiento',
          search: buildDashboardSearch({ dailyStatus: 'pending_today' }),
        }),
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 p-6 shadow-sm sm:p-8">
        <div className="max-w-3xl space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-500">
                {selectedPeriodMeta.label} · {formattedPeriodRange}
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Hola, {firstName}.
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                {dashboardData.arrivalsToday.length > 0 || dashboardData.departuresToday.length > 0
                  ? `Hoy tienes ${dashboardData.arrivalsToday.length} entrada${
                      dashboardData.arrivalsToday.length === 1 ? '' : 's'
                    } y ${dashboardData.departuresToday.length} salida${
                      dashboardData.departuresToday.length === 1 ? '' : 's'
                    } programada${dashboardData.departuresToday.length === 1 ? '' : 's'}.`
                  : 'Hoy no hay entradas ni salidas programadas.'}{' '}
                Este panel resume solo lo importante.
              </p>
            </div>

            {heroAlert.onClick ? (
              <button
                type="button"
                onClick={heroAlert.onClick}
                className={cn(
                  'w-full rounded-lg text-left transition hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300',
                  heroAlert.className
                )}
              >
                <Alert className="border-0 bg-transparent shadow-none">
                  <heroAlert.icon className="h-4 w-4" />
                  <AlertTitle className="flex items-center justify-between gap-3">
                    <span>{heroAlert.title}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium">
                      {heroAlert.ctaLabel}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </AlertTitle>
                  <AlertDescription className={heroAlert.descriptionClassName}>
                    {heroAlert.description}
                  </AlertDescription>
                </Alert>
              </button>
            ) : (
              <Alert className={heroAlert.className}>
                <heroAlert.icon className="h-4 w-4" />
                <AlertTitle>{heroAlert.title}</AlertTitle>
                <AlertDescription className={heroAlert.descriptionClassName}>
                  {heroAlert.description}
                </AlertDescription>
              </Alert>
            )}

            {failedSources.length > 0 && (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Faltan datos</AlertTitle>
                <AlertDescription className="text-amber-800">
                  No se pudieron actualizar: {failedSources.join(', ')}.
                </AlertDescription>
              </Alert>
            )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {simpleMetricCards.map((card) => (
          <MetricCard key={`${card.eyebrow}-${card.title}`} isLoading={isLoadingDashboard} {...card} />
        ))}
      </div>

      <Card className="border-0 p-6 shadow-md">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-100 p-2.5">
            <Siren className="h-5 w-5 text-slate-700" />
          </div>
          <div>
            <h3 className="text-gray-950">Resumen de hoy</h3>
            <p className="text-sm text-gray-500">
              Cuatro puntos para saber si el día está controlado.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {todaySummaryItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="mt-1 text-sm text-gray-500">{item.helper}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-semibold text-gray-950">
                  {isLoadingDashboard ? '...' : item.value}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
