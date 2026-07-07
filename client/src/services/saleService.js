import {
  collection, doc, runTransaction, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getAll, getById, create, remove, where, orderBy, limit } from './firestore';
import { logActivity } from './activityLogService';
import { notify } from './notificationService';
import { generateInvoiceNumber } from '@/utils/format';

/**
 * Completes a sale atomically:
 *  - validates & decrements stock for every line item
 *  - writes the sale + denormalised saleItems + inventory logs
 *  - updates customer totals / reward points
 * Everything happens in ONE Firestore transaction so stock can never
 * be oversold by two cashiers at once.
 */
export async function checkoutSale({ cart, customer, totals, payments, notes, coupon, cashier }) {
  const invoiceNumber = generateInvoiceNumber();
  const saleRef = doc(collection(db, 'sales'));

  const result = await runTransaction(db, async (tx) => {
    // 1. READS first (transaction rule): fetch fresh product docs
    const productRefs = cart.map((item) => doc(db, 'products', item.productId));
    const productSnaps = await Promise.all(productRefs.map((r) => tx.get(r)));

    const stockAfter = [];
    productSnaps.forEach((snap, i) => {
      if (!snap.exists()) throw new Error(`Product "${cart[i].name}" no longer exists.`);
      const current = Number(snap.data().stockQuantity) || 0;
      if (current < cart[i].quantity) {
        throw new Error(`Insufficient stock for "${cart[i].name}" — only ${current} left.`);
      }
      stockAfter.push(current - cart[i].quantity);
    });

    let customerSnap = null;
    if (customer?.id) {
      customerSnap = await tx.get(doc(db, 'customers', customer.id));
    }

    // 2. WRITES
    const items = cart.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      size: item.size || '',
      color: item.color || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      purchasePrice: item.purchasePrice || 0,
      lineTotal: item.unitPrice * item.quantity,
    }));

    const profit =
      items.reduce((s, it) => s + (it.unitPrice - it.purchasePrice) * it.quantity, 0) - totals.discount;

    const sale = {
      invoiceNumber,
      customerId: customer?.id || null,
      customerName: customer?.name || 'Walk-in Customer',
      cashierId: cashier.uid,
      cashierName: cashier.name,
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      couponCode: coupon || null,
      taxRate: totals.taxRate,
      taxAmount: totals.taxAmount,
      grandTotal: totals.grandTotal,
      profit,
      paymentMethod: payments.length > 1 ? 'mixed' : payments[0].method,
      payments,
      amountPaid: totals.amountPaid,
      changeDue: totals.changeDue,
      status: 'completed',
      notes: notes || '',
      createdAt: serverTimestamp(),
    };
    tx.set(saleRef, sale);

    productSnaps.forEach((snap, i) => {
      tx.update(productRefs[i], {
        stockQuantity: stockAfter[i],
        totalSold: (Number(snap.data().totalSold) || 0) + cart[i].quantity,
        status: stockAfter[i] > 0 ? 'active' : 'out_of_stock',
      });
      // Inventory movement log
      tx.set(doc(collection(db, 'inventory')), {
        productId: cart[i].productId,
        sku: cart[i].sku,
        productName: cart[i].name,
        type: 'stock_out',
        reason: 'sale',
        quantity: -cart[i].quantity,
        referenceId: saleRef.id,
        userId: cashier.uid,
        userName: cashier.name,
        createdAt: serverTimestamp(),
      });
      // Denormalised sale items for reporting
      tx.set(doc(collection(db, 'saleItems')), {
        saleId: saleRef.id,
        saleDate: Timestamp.now(),
        ...items[i],
        profit: (items[i].unitPrice - items[i].purchasePrice) * items[i].quantity,
      });
    });

    // Payment records
    for (const p of payments) {
      tx.set(doc(collection(db, 'payments')), {
        saleId: saleRef.id,
        invoiceNumber,
        method: p.method,
        amount: p.amount,
        cashierId: cashier.uid,
        createdAt: serverTimestamp(),
      });
    }

    // Customer loyalty updates
    if (customerSnap?.exists()) {
      const c = customerSnap.data();
      tx.update(customerSnap.ref, {
        totalSpent: (Number(c.totalSpent) || 0) + totals.grandTotal,
        totalOrders: (Number(c.totalOrders) || 0) + 1,
        rewardPoints: (Number(c.rewardPoints) || 0) + Math.floor(totals.grandTotal / 100),
      });
    }

    return { saleId: saleRef.id, sale: { ...sale, id: saleRef.id }, lowStock: cart
      .map((item, i) => ({ item, remaining: stockAfter[i], min: Number(productSnaps[i].data().minStock) || 10 }))
      .filter(({ remaining, min }) => remaining <= min) };
  });

  // Post-transaction side effects (non-critical)
  await logActivity('SALE_COMPLETED', `Invoice ${invoiceNumber} — total ${totals.grandTotal}`, 'sales');
  await notify('sale', 'Sale completed', `Invoice ${invoiceNumber} for ${result.sale.customerName}.`);
  for (const { item, remaining } of result.lowStock) {
    await notify(
      'low_stock',
      remaining <= 0 ? 'Out of stock' : 'Low stock alert',
      `"${item.name}" (${item.sku}) — ${remaining} units remaining.`
    );
  }

  return result.sale;
}

/**
 * Refund a sale (full or selected items). Restocks products,
 * writes a return record and marks the sale.
 */
export async function refundSale(sale, itemsToRefund, reason, user) {
  const isFull = itemsToRefund.length === sale.items.length
    && itemsToRefund.every((r) => r.quantity === sale.items.find((i) => i.productId === r.productId)?.quantity);
  const refundAmount = itemsToRefund.reduce((s, it) => s + it.unitPrice * it.quantity, 0);

  await runTransaction(db, async (tx) => {
    const refs = itemsToRefund.map((it) => doc(db, 'products', it.productId));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));

    snaps.forEach((snap, i) => {
      if (!snap.exists()) return; // product deleted since sale — skip restock
      const qty = (Number(snap.data().stockQuantity) || 0) + itemsToRefund[i].quantity;
      tx.update(refs[i], { stockQuantity: qty, status: 'active' });
      tx.set(doc(collection(db, 'inventory')), {
        productId: itemsToRefund[i].productId,
        sku: itemsToRefund[i].sku,
        productName: itemsToRefund[i].name,
        type: 'returned',
        reason: `refund: ${reason || 'no reason'}`,
        quantity: itemsToRefund[i].quantity,
        referenceId: sale.id,
        userId: user.uid,
        userName: user.name,
        createdAt: serverTimestamp(),
      });
    });

    tx.set(doc(collection(db, 'returns')), {
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      items: itemsToRefund,
      refundAmount,
      reason: reason || '',
      processedBy: user.uid,
      processedByName: user.name,
      createdAt: serverTimestamp(),
    });

    tx.update(doc(db, 'sales', sale.id), {
      status: isFull ? 'refunded' : 'partially_refunded',
      refundedAmount: (Number(sale.refundedAmount) || 0) + refundAmount,
    });
  });

  await logActivity('SALE_REFUNDED', `Refunded ${refundAmount} on ${sale.invoiceNumber}`, 'sales');
  return refundAmount;
}

/* ---------------- Held bills ---------------- */
export const holdBill = (data) => create('heldBills', data);
export const getHeldBills = () => getAll('heldBills', orderBy('createdAt', 'desc'));
export const deleteHeldBill = (id) => remove('heldBills', id);

/* ---------------- Queries ---------------- */
export const getSale = (id) => getById('sales', id);
export const getRecentSales = (count = 50) => getAll('sales', orderBy('createdAt', 'desc'), limit(count));
export const getSalesByCustomer = (customerId) =>
  getAll('sales', where('customerId', '==', customerId), orderBy('createdAt', 'desc'), limit(50));

export async function getSalesBetween(start, end) {
  return getAll(
    'sales',
    where('createdAt', '>=', Timestamp.fromDate(start)),
    where('createdAt', '<=', Timestamp.fromDate(end)),
    orderBy('createdAt', 'desc')
  );
}

export async function findSaleByInvoice(invoiceNumber) {
  const results = await getAll('sales', where('invoiceNumber', '==', invoiceNumber.trim()), limit(1));
  return results[0] || null;
}
