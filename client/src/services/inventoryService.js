import { doc, collection, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getAll, where, orderBy, limit } from './firestore';
import { logActivity } from './activityLogService';
import { notify } from './notificationService';

/**
 * Records a manual inventory movement (stock in, purchase, adjustment,
 * damaged, returned) and atomically updates the product's stock level.
 * `quantity` is signed: positive adds stock, negative removes it.
 */
export async function adjustStock({ product, type, quantity, reason, user, supplierId = null }) {
  const qty = Number(quantity);
  if (!qty) throw new Error('Quantity must be a non-zero number.');

  const newQty = await runTransaction(db, async (tx) => {
    const ref = doc(db, 'products', product.id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Product not found.');

    const current = Number(snap.data().stockQuantity) || 0;
    const next = current + qty;
    if (next < 0) throw new Error(`Cannot remove ${-qty} units — only ${current} in stock.`);

    tx.update(ref, { stockQuantity: next, status: next > 0 ? 'active' : 'out_of_stock' });
    tx.set(doc(collection(db, 'inventory')), {
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      type,
      reason: reason || '',
      quantity: qty,
      supplierId,
      referenceId: null,
      userId: user.uid,
      userName: user.name,
      createdAt: serverTimestamp(),
    });
    return next;
  });

  await logActivity('INVENTORY_ADJUSTED', `${type} ${qty > 0 ? '+' : ''}${qty} × "${product.name}"`, 'inventory');
  await notify('inventory', 'Inventory updated', `${product.name}: ${qty > 0 ? '+' : ''}${qty} units (${type}).`);

  const min = Number(product.minStock) || 10;
  if (newQty <= 0) {
    await notify('low_stock', 'Out of stock', `"${product.name}" is out of stock.`);
  } else if (newQty <= min) {
    await notify('low_stock', 'Low stock alert', `"${product.name}" is down to ${newQty} units.`);
  }

  return newQty;
}

export const getInventoryHistory = (count = 100) =>
  getAll('inventory', orderBy('createdAt', 'desc'), limit(count));

export const getProductHistory = (productId, count = 50) =>
  getAll('inventory', where('productId', '==', productId), orderBy('createdAt', 'desc'), limit(count));
