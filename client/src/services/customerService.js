import { getAll, getById, create, update, remove, orderBy } from './firestore';
import { logActivity } from './activityLogService';

const COL = 'customers';

export const getCustomers = () => getAll(COL, orderBy('name'));
export const getCustomer = (id) => getById(COL, id);

export async function createCustomer(data) {
  const id = await create(COL, {
    rewardPoints: 0,
    membershipLevel: 'Bronze',
    walletBalance: 0,
    totalSpent: 0,
    totalOrders: 0,
    status: 'active',
    ...data,
  });
  await logActivity('CUSTOMER_CREATED', `Added customer "${data.name}"`, 'customers');
  return id;
}

export async function updateCustomer(id, data) {
  await update(COL, id, data);
  await logActivity('CUSTOMER_UPDATED', `Updated customer "${data.name || id}"`, 'customers');
}

export async function deleteCustomer(id, name) {
  await remove(COL, id);
  await logActivity('CUSTOMER_DELETED', `Deleted customer "${name || id}"`, 'customers');
}
