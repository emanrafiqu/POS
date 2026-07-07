import { getAll, getById, create, update, remove, orderBy } from './firestore';
import { logActivity } from './activityLogService';

const COL = 'employees';

export const getEmployees = () => getAll(COL, orderBy('name'));
export const getEmployee = (id) => getById(COL, id);

export async function createEmployee(data) {
  const id = await create(COL, {
    attendance: { present: 0, absent: 0, leave: 0 },
    permissions: [],
    status: 'active',
    ...data,
  });
  await logActivity('EMPLOYEE_CREATED', `Added employee "${data.name}"`, 'employees');
  return id;
}

export async function updateEmployee(id, data) {
  await update(COL, id, data);
  await logActivity('EMPLOYEE_UPDATED', `Updated employee "${data.name || id}"`, 'employees');
}

export async function deleteEmployee(id, name) {
  await remove(COL, id);
  await logActivity('EMPLOYEE_DELETED', `Deleted employee "${name || id}"`, 'employees');
}

export async function markAttendance(employee, status) {
  const att = { present: 0, absent: 0, leave: 0, ...(employee.attendance || {}) };
  att[status] = (att[status] || 0) + 1;
  await update(COL, employee.id, { attendance: att });
  await logActivity('ATTENDANCE_MARKED', `${employee.name}: ${status}`, 'employees');
}
