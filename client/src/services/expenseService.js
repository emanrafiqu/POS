import { getAll, create, update, remove, orderBy } from './firestore';
import { logActivity } from './activityLogService';
import { notify } from './notificationService';
import { auth } from '@/firebase/config';

const COL = 'expenses';

export const getExpenses = () => getAll(COL, orderBy('date', 'desc'));

export async function createExpense(data) {
  const id = await create(COL, { ...data, amount: Number(data.amount), createdBy: auth.currentUser?.uid });
  await logActivity('EXPENSE_CREATED', `${data.category}: ${data.amount} — ${data.title}`, 'expenses');
  await notify('expense', 'Expense added', `${data.category} — ${data.title} (${data.amount}).`);
  return id;
}

export async function updateExpense(id, data) {
  await update(COL, id, { ...data, amount: Number(data.amount) });
  await logActivity('EXPENSE_UPDATED', `Updated expense "${data.title || id}"`, 'expenses');
}

export async function deleteExpense(id, title) {
  await remove(COL, id);
  await logActivity('EXPENSE_DELETED', `Deleted expense "${title || id}"`, 'expenses');
}
