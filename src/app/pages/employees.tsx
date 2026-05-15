import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BriefcaseBusiness,
  LogIn,
  Mail,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { DeleteConfirmationModal } from '../components/ui/delete-confirmation-modal';
import { EmployeeFormModal } from '../components/employees/employee-form-modal';
import { smartSearch } from '../utils/search';
import {
  EMPLOYEES_QUERY_KEY,
  createEmployeeRequest,
  deleteEmployeeRequest,
  fetchEmployeesPageData,
  type EmployeeRecord,
  type EmployeeUpsertInput,
  updateEmployeeRequest,
} from '../utils/employees-api';

type RoleFilter = 'all' | 'admin' | 'employee';
type SortOption = 'name' | 'salary' | 'activity' | 'hiredAt';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string) => {
  if (!value) {
    return 'No disponible';
  }

  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getEmployeeInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'EM';

const getEmployeeActivity = (employee: EmployeeRecord) =>
  employee.trackingCount + employee.checkInsCount + employee.checkOutsCount;

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('activity');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [employeeBeingEdited, setEmployeeBeingEdited] = useState<EmployeeRecord | null>(null);
  const [employeePendingDelete, setEmployeePendingDelete] = useState<EmployeeRecord | null>(null);

  const {
    data: employees = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: fetchEmployeesPageData,
  });

  const syncEmployeesQuery = async () => {
    await queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
  };

  const createEmployeeMutation = useMutation({
    mutationFn: createEmployeeRequest,
    onSuccess: async () => {
      await syncEmployeesQuery();
      setIsCreateModalOpen(false);
      toast.success('Empleado creado', {
        description: 'Se ha registrado correctamente.',
      });
    },
    onError: (error) => {
      toast.error('No se pudo crear el empleado', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: ({
      employeeId,
      employee,
    }: {
      employeeId: number;
      employee: EmployeeUpsertInput;
    }) => updateEmployeeRequest(employeeId, employee),
    onSuccess: async () => {
      await syncEmployeesQuery();
      setEmployeeBeingEdited(null);
      toast.success('Empleado actualizado', {
        description: 'Los cambios se han guardado correctamente.',
      });
    },
    onError: (error) => {
      toast.error('No se pudo actualizar el empleado', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: deleteEmployeeRequest,
    onSuccess: async () => {
      await syncEmployeesQuery();
      setEmployeePendingDelete(null);
      toast.success('Empleado eliminado', {
        description: 'Se ha eliminado correctamente.',
      });
    },
    onError: (error) => {
      toast.error('No se pudo eliminar el empleado', {
        description: error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      });
    },
  });

  const filteredEmployees = useMemo(() => {
    const nextEmployees = employees.filter((employee) => {
      const matchesSearch = smartSearch(
        searchTerm,
        employee.name,
        employee.email,
        employee.phone,
        String(employee.id)
      );
      const matchesRole =
        roleFilter === 'all' ||
        (roleFilter === 'admin' && employee.isAdmin) ||
        (roleFilter === 'employee' && !employee.isAdmin);

      return matchesSearch && matchesRole;
    });

    return [...nextEmployees].sort((firstEmployee, secondEmployee) => {
      switch (sortBy) {
        case 'salary':
          return secondEmployee.salary - firstEmployee.salary;
        case 'hiredAt':
          return (
            new Date(secondEmployee.hiredAt).getTime() -
            new Date(firstEmployee.hiredAt).getTime()
          );
        case 'name':
          return firstEmployee.name.localeCompare(secondEmployee.name, 'es');
        case 'activity':
        default:
          return getEmployeeActivity(secondEmployee) - getEmployeeActivity(firstEmployee);
      }
    });
  }, [employees, roleFilter, searchTerm, sortBy]);

  const totalEmployees = employees.length;
  const totalAdmins = employees.filter((employee) => employee.isAdmin).length;
  const totalPayroll = employees.reduce((sum, employee) => sum + employee.salary, 0);
  const totalTracking = employees.reduce((sum, employee) => sum + employee.trackingCount, 0);
  const totalCheckIns = employees.reduce((sum, employee) => sum + employee.checkInsCount, 0);

  const handleCreateEmployee = async (employee: EmployeeUpsertInput) => {
    await createEmployeeMutation.mutateAsync(employee);
  };

  const handleUpdateEmployee = async (employee: EmployeeUpsertInput) => {
    if (!employeeBeingEdited) {
      return;
    }

    await updateEmployeeMutation.mutateAsync({
      employeeId: employeeBeingEdited.id,
      employee,
    });
  };

  const handleDeleteEmployee = async () => {
    if (!employeePendingDelete) {
      return;
    }

    await deleteEmployeeMutation.mutateAsync(employeePendingDelete.id);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-1 text-gray-900">Gestión de empleados</h2>
          <p className="text-sm text-gray-600">Cargando equipo y métricas operativas...</p>
        </div>

        <Card className="border-0 p-8 shadow-md">
          <p className="text-sm text-gray-600">Obteniendo empleados desde el backend...</p>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-1 text-gray-900">Gestión de empleados</h2>
          <p className="text-sm text-gray-600">
            {error instanceof Error
              ? error.message
              : 'No se pudo cargar la información del equipo.'}
          </p>
        </div>

        <Card className="border-0 p-8 shadow-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Revisa el endpoint de empleados y vuelve a intentarlo.
            </p>
            <Button variant="outline" onClick={() => refetch()} className="border-gray-200">
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-1 text-gray-900">Gestión de empleados</h2>
          <p className="text-sm text-gray-600">
            Consulta el equipo, su rol interno y la carga operativa de seguimientos, check-ins y
            check-outs.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo empleado
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-600">Empleados</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{totalEmployees}</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-600">Administradores</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{totalAdmins}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-600">Seguimientos</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{totalTracking}</p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-3 text-violet-700">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-600">Check-ins</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{totalCheckIns}</p>
            </div>
            <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
              <LogIn className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="border-0 p-5 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-600">Nómina mensual</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {formatCurrency(totalPayroll)}
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-0 p-5 shadow-md">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre, email, teléfono o ID..."
              className="pl-10"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
            className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">Todos los perfiles</option>
            <option value="admin">Solo administradores</option>
            <option value="employee">Solo empleados</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="activity">Ordenar por actividad</option>
            <option value="name">Ordenar por nombre</option>
            <option value="salary">Ordenar por salario</option>
            <option value="hiredAt">Ordenar por fecha de alta</option>
          </select>
        </div>
      </Card>

      <Card className="border-0 shadow-md">
        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full table-fixed">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                <th className="px-5 py-4 font-medium">Empleado</th>
                <th className="px-5 py-4 font-medium">Contacto</th>
                <th className="px-5 py-4 font-medium">Perfil</th>
                <th className="px-5 py-4 font-medium">Seguimientos</th>
                <th className="px-5 py-4 font-medium">Check-ins</th>
                <th className="px-5 py-4 font-medium">Check-outs</th>
                <th className="px-5 py-4 font-medium">Alta</th>
                <th className="px-5 py-4 font-medium">Salario</th>
                <th className="px-5 py-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                        {getEmployeeInitials(employee.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{employee.name}</p>
                        <p className="text-sm text-gray-500">EMP-{employee.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-1 text-sm text-gray-600">
                      <p className="truncate">{employee.email}</p>
                      <p>{employee.phone || 'Sin teléfono'}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      variant="outline"
                      className={
                        employee.isAdmin
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }
                    >
                      {employee.isAdmin ? 'Administrador' : 'Empleado'}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-900">
                    {employee.trackingCount}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-900">
                    {employee.checkInsCount}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-900">
                    {employee.checkOutsCount}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {formatDate(employee.hiredAt)}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                    {formatCurrency(employee.salary)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEmployeeBeingEdited(employee)}
                        className="border-gray-200 text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEmployeePendingDelete(employee)}
                        className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 p-4 lg:hidden">
          {filteredEmployees.map((employee) => (
            <div
              key={employee.id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {getEmployeeInitials(employee.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{employee.name}</p>
                    <p className="text-xs text-gray-500">EMP-{employee.id}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    employee.isAdmin
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }
                >
                  {employee.isAdmin ? 'Admin' : 'Empleado'}
                </Badge>
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="truncate">{employee.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span>{employee.phone || 'Sin teléfono'}</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3">
                <div>
                  <p className="text-xs text-gray-500">Seguimientos</p>
                  <p className="mt-1 font-medium text-gray-900">{employee.trackingCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Salario</p>
                  <p className="mt-1 font-medium text-gray-900">
                    {formatCurrency(employee.salary)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Check-ins</p>
                  <p className="mt-1 font-medium text-gray-900">{employee.checkInsCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Check-outs</p>
                  <p className="mt-1 font-medium text-gray-900">{employee.checkOutsCount}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">Fecha de alta</span>
                <span className="font-medium text-gray-900">{formatDate(employee.hiredAt)}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmployeeBeingEdited(employee)}
                  className="border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmployeePendingDelete(employee)}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredEmployees.length === 0 && (
          <div className="border-t border-gray-100 px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-gray-900">No hay empleados para mostrar</h3>
            <p className="mt-2 text-sm text-gray-600">
              Ajusta la búsqueda o los filtros para encontrar otro perfil.
            </p>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-5 bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Crear empleado
            </Button>
          </div>
        )}
      </Card>

      <EmployeeFormModal
        key={isCreateModalOpen ? 'employee-create-open' : 'employee-create-closed'}
        isOpen={isCreateModalOpen}
        mode="create"
        isSubmitting={createEmployeeMutation.isPending}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateEmployee}
      />

      <EmployeeFormModal
        key={employeeBeingEdited ? `employee-edit-${employeeBeingEdited.id}` : 'employee-edit'}
        isOpen={employeeBeingEdited !== null}
        mode="edit"
        employee={employeeBeingEdited}
        isSubmitting={updateEmployeeMutation.isPending}
        onClose={() => setEmployeeBeingEdited(null)}
        onSubmit={handleUpdateEmployee}
      />

      <DeleteConfirmationModal
        isOpen={employeePendingDelete !== null}
        onClose={() => setEmployeePendingDelete(null)}
        onConfirm={handleDeleteEmployee}
        title="Eliminar empleado"
        entityLabel="empleado"
        itemName={employeePendingDelete?.name}
        question={
          employeePendingDelete
            ? `¿Seguro que quieres eliminar a ${employeePendingDelete.name}?`
            : undefined
        }
        description="Esta acción eliminará el empleado del sistema."
        isDeleting={deleteEmployeeMutation.isPending}
      />
    </div>
  );
}
