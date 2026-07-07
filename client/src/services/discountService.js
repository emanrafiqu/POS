import { doc, setDoc, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getAll, getById, remove, orderBy } from './firestore';
import { logActivity } from './activityLogService';

const COL = 'discounts';

export const getDiscounts = () => getAll(COL, orderBy('createdAt', 'desc'));

export async function saveDiscount(data, isNew) {
  const code = data.code.toUpperCase().trim();
  await setDoc(
    doc(db, COL, code),
    {
      ...data,
      code,
      value: Number(data.value),
      minPurchase: Number(data.minPurchase) || 0,
      ...(isNew ? { usedCount: 0, createdAt: serverTimestamp() } : { updatedAt: serverTimestamp() }),
    },
    { merge: true }
  );
  await logActivity(isNew ? 'DISCOUNT_CREATED' : 'DISCOUNT_UPDATED', `Coupon ${code}`, 'discounts');
}

export async function deleteDiscount(code) {
  await remove(COL, code);
  await logActivity('DISCOUNT_DELETED', `Coupon ${code}`, 'discounts');
}

/**
 * Validates a coupon against the current cart.
 * Returns the computed discount amount or throws with a user-friendly message.
 */
export async function applyCoupon(code, { subtotal, customer, cartCategories }) {
  const discount = await getById(COL, code.toUpperCase().trim());
  if (!discount) throw new Error('Invalid coupon code.');
  if (!discount.active) throw new Error('This coupon is no longer active.');
  if (discount.minPurchase && subtotal < discount.minPurchase) {
    throw new Error(`Minimum purchase of ${discount.minPurchase} required for this coupon.`);
  }
  if (discount.scope === 'members' && !customer) {
    throw new Error('This coupon is for registered members only.');
  }
  if (discount.scope === 'category' && discount.category && !cartCategories.includes(discount.category)) {
    throw new Error(`This coupon only applies to ${discount.category}.`);
  }

  const amount =
    discount.type === 'percentage'
      ? Math.round((subtotal * discount.value) / 100)
      : Math.min(discount.value, subtotal);

  return { code: discount.code, amount, description: discount.description };
}

export async function incrementCouponUse(code) {
  try {
    await updateDoc(doc(db, COL, code), { usedCount: increment(1) });
  } catch { /* non-critical */ }
}
