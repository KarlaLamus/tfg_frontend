import { API_BASE_URL, apiFetch } from './api-client';

export interface EmployeeRecord {
  id: number;
  email: string;
  name: string;
  phone: string;
  salary: number;
  hiredAt: string;
  isAdmin: boolean;
  trackingCount: number;
  checkInsCount: number;
  checkOutsCount: number;
}

export interface EmployeeUpsertInput {
  email: string;
  name: string;
  phone: string;
  salary: number;
  hiredAt: string;
  isAdmin: boolean;
}

interface BackendEmployeeRecord {
  empleadoId: number;
  email: string;
  nombre: string;
  telefono: string;
  salario: number;
  fechaContratacion: string;
  administrador: boolean;
  numSeguimientos?: number | null;
  numCheckIns?: number | null;
  numCheckOuts?: number | null;
}

export const EMPLOYEES_API_URL = API_BASE_URL;
export const EMPLOYEES_QUERY_KEY = ['employees-page'];

const mapBackendEmployee = (employee: BackendEmployeeRecord): EmployeeRecord => ({
  id: Number(employee.empleadoId),
  email: employee.email ?? '',
  name: employee.nombre ?? 'Empleado sin nombre',
  phone: employee.telefono ?? '',
  salary: Number(employee.salario ?? 0),
  hiredAt: employee.fechaContratacion ?? '',
  isAdmin: Boolean(employee.administrador),
  trackingCount: Number(employee.numSeguimientos ?? 0),
  checkInsCount: Number(employee.numCheckIns ?? 0),
  checkOutsCount: Number(employee.numCheckOuts ?? 0),
});

const mapEmployeeInputToBackend = (employee: EmployeeUpsertInput) => ({
  email: employee.email.trim(),
  nombre: employee.name.trim(),
  telefono: employee.phone.trim(),
  salario: Number(employee.salary),
  fechaContratacion: employee.hiredAt,
  administrador: employee.isAdmin,
});

const parseOptionalEmployeeResponse = async (response: Response) => {
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return null;
  }

  return mapBackendEmployee(JSON.parse(rawBody) as BackendEmployeeRecord);
};

export const fetchEmployeesPageData = async (): Promise<EmployeeRecord[]> => {
  const response = await apiFetch(`${EMPLOYEES_API_URL}/api/empleados`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('No se pudieron cargar los empleados');
  }

  const data: BackendEmployeeRecord[] = await response.json();

  return data
    .map(mapBackendEmployee)
    .sort((firstEmployee, secondEmployee) =>
      firstEmployee.name.localeCompare(secondEmployee.name, 'es')
    );
};

export const createEmployeeRequest = async (employee: EmployeeUpsertInput) => {
  const response = await apiFetch(`${EMPLOYEES_API_URL}/api/empleados`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(mapEmployeeInputToBackend(employee)),
  });

  if (!response.ok) {
    throw new Error('No se pudo crear el empleado');
  }

  return parseOptionalEmployeeResponse(response);
};

export const updateEmployeeRequest = async (
  employeeId: number,
  employee: EmployeeUpsertInput
) => {
  const response = await apiFetch(`${EMPLOYEES_API_URL}/api/empleados/${employeeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(mapEmployeeInputToBackend(employee)),
  });

  if (!response.ok) {
    throw new Error('No se pudo actualizar el empleado');
  }

  return parseOptionalEmployeeResponse(response);
};

export const deleteEmployeeRequest = async (employeeId: number) => {
  const response = await apiFetch(`${EMPLOYEES_API_URL}/api/empleados/${employeeId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('No se pudo eliminar el empleado');
  }

  return employeeId;
};
