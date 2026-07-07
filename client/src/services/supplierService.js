import { getAll, getById, create, update, remove, orderBy } from './firestore';
import { logActivity } from './activityLogService';

const COL = 'suppliers';

export const getSuppliers = () => getAll(COL, orderBy('name'));
export const getSupplier = (id) => getById(COL, id);

export async function createSupplier(data) {
  const id = await create(COL, {
    outstandingBalance: 0,
    totalPurchases: 0,
    status: 'active',
    ...data,
  });
  await logActivity('SUPPLIER_CREATED', `Added supplier "${data.name}"`, 'suppliers');
  return id;
}

export async function updateSupplier(id, data) {
  await update(COL, id, data);
  await logActivity('SUPPLIER_UPDATED', `Updated supplier "${data.name || id}"`, 'suppliers');
}

export async function deleteSupplier(id, name) {
  await remove(COL, id);
  await logActivity('SUPPLIER_DELETED', `Deleted supplier "${name || id}"`, 'suppliers');
}

/** Records a payment to a supplier and reduces their outstanding balance. */
export async function recordSupplierPayment(supplier, amount, method, notes) {
  await create('payments', {
    type: 'supplier_payment',
    supplierId: supplier.id,
    supplierName: supplier.name,
    method,
    amount: Number(amount),
    notes: notes || '',
  });
  await update(COL, supplier.id, {
    outstandingBalance: Math.max(0, (Number(supplier.outstandingBalance) || 0) - Number(amount)),
  });
  await logActivity('SUPPLIER_PAYMENT', `Paid ${amount} to "${supplier.name}"`, 'suppliers');
}
