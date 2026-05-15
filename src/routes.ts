import { createBrowserRouter } from "react-router";
import LoginPage from "./app/pages/login";
import DashboardPage from "./app/pages/dashboard";
import ClientsPage from "./app/pages/clients";
import ClientDetailPage from "./app/pages/client-detail";
import PetsPage from "./app/pages/pets";
import PetDetailPage from "./app/pages/pet-detail";
import ReservationsPage from "./app/pages/reservations";
import ReservationDetailPage from "./app/pages/reservation-detail";
import EditReservationPage from "./app/pages/edit-reservation";
import NewReservationPage from "./app/pages/new-reservation";
import ServicesPage from "./app/pages/services";
import TrackingPage from "./app/pages/tracking";
import RoomsPage from "./app/pages/rooms";
import PaymentsPage from "./app/pages/payments";
import {
  ProtectedAppLayout,
  ProtectedEmployeesPage,
} from "./app/auth/protected-routes";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/",
    Component: ProtectedAppLayout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "clientes/:id", Component: ClientDetailPage },
      { path: "clientes", Component: ClientsPage },
      { path: "mascotas/:id", Component: PetDetailPage },
      { path: "mascotas", Component: PetsPage },
      { path: "reservas/nueva", Component: NewReservationPage },
      { path: "reservas/:id/editar", Component: EditReservationPage },
      { path: "reservas/:id", Component: ReservationDetailPage },
      { path: "reservas", Component: ReservationsPage },
      { path: "servicios", Component: ServicesPage },
      { path: "seguimiento", Component: TrackingPage },
      { path: "pagos", Component: PaymentsPage },
      { path: "salas", Component: RoomsPage },
      { path: "empleados", Component: ProtectedEmployeesPage },
    ],
  },
]);
