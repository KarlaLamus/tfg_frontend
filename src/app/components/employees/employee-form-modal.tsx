import { useState } from 'react';
import { Calendar, Mail, Phone, ShieldCheck, User, Wallet, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { EmployeeRecord, EmployeeUpsertInput } from '../../utils/employees-api';

interface EmployeeFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  employee?: EmployeeRecord | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (employee: EmployeeUpsertInput) => void;
}

const getTodayIsoDate = () => new Date().toISOString().split('T')[0];

const getInitialValues = (employee?: EmployeeRecord | null) => ({
  name: employee?.name ?? '',
  email: employee?.email ?? '',
  phone: employee?.phone ?? '',
  salary:
    typeof employee?.salary === 'number' && Number.isFinite(employee.salary)
      ? String(employee.salary)
      : '',
  hiredAt: employee?.hiredAt ?? getTodayIsoDate(),
  isAdmin: employee?.isAdmin ?? false,
});

export function EmployeeFormModal({
  isOpen,
  mode,
  employee,
  isSubmitting = false,
  onClose,
  onSubmit,
}: EmployeeFormModalProps) {
  const initialValues = getInitialValues(employee);
  const [name, setName] = useState(initialValues.name);
  const [email, setEmail] = useState(initialValues.email);
  const [phone, setPhone] = useState(initialValues.phone);
  const [salary, setSalary] = useState(initialValues.salary);
  const [hiredAt, setHiredAt] = useState(initialValues.hiredAt);
  const [isAdmin, setIsAdmin] = useState(initialValues.isAdmin);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) {
    return null;
  }

  const isEditing = mode === 'edit';

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const parsedSalary = Number(salary);

    if (!name.trim()) {
      nextErrors.name = 'El nombre es obligatorio';
    }

    if (!email.trim()) {
      nextErrors.email = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Introduce un email válido';
    }

    if (!phone.trim()) {
      nextErrors.phone = 'El teléfono es obligatorio';
    }

    if (!salary.trim()) {
      nextErrors.salary = 'El salario es obligatorio';
    } else if (!Number.isFinite(parsedSalary) || parsedSalary < 0) {
      nextErrors.salary = 'Introduce un salario válido';
    }

    if (!hiredAt) {
      nextErrors.hiredAt = 'La fecha de contratación es obligatoria';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      salary: Number(salary),
      hiredAt,
      isAdmin,
    });
  };

  const title = isEditing ? 'Editar empleado' : 'Nuevo empleado';
  const description = isEditing
    ? 'Actualiza los datos del empleado seleccionado.'
    : 'Registra un nuevo miembro del equipo y define su perfil interno.';
  const submitLabel = isEditing ? 'Guardar cambios' : 'Crear empleado';

  const clearFieldError = (field: string) => {
    if (!errors[field]) {
      return;
    }

    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="mb-1 text-xl text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50"
              aria-label="Cerrar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="employee-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <User className="h-4 w-4 text-blue-600" />
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    clearFieldError('name');
                  }}
                  placeholder="Ej. Laura Martínez"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Mail className="h-4 w-4 text-emerald-600" />
                  Email <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearFieldError('email');
                  }}
                  placeholder="empleado@petcare.com"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Phone className="h-4 w-4 text-violet-600" />
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <Input
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    clearFieldError('phone');
                  }}
                  placeholder="+34 611 222 333"
                  className={errors.phone ? 'border-red-500' : ''}
                />
                {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Wallet className="h-4 w-4 text-amber-600" />
                  Salario mensual <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={salary}
                  onChange={(event) => {
                    setSalary(event.target.value);
                    clearFieldError('salary');
                  }}
                  placeholder="1800"
                  className={errors.salary ? 'border-red-500' : ''}
                />
                {errors.salary && <p className="mt-1 text-sm text-red-500">{errors.salary}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Calendar className="h-4 w-4 text-sky-600" />
                  Fecha de contratación <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={hiredAt}
                  onChange={(event) => {
                    setHiredAt(event.target.value);
                    clearFieldError('hiredAt');
                  }}
                  className={errors.hiredAt ? 'border-red-500' : ''}
                />
                {errors.hiredAt && (
                  <p className="mt-1 text-sm text-red-500">{errors.hiredAt}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  Perfil interno
                </label>
                <select
                  value={isAdmin ? 'admin' : 'employee'}
                  onChange={(event) => setIsAdmin(event.target.value === 'admin')}
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="employee">Empleado</option>
                  <option value="admin">Administrador</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  El booleano administrador controla el acceso a módulos avanzados.
                </p>
              </div>
            </div>
          </form>
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="employee-form"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600"
            >
              {isSubmitting ? 'Guardando...' : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
