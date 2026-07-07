import {
  collection, doc, getDocs, query, where, limit, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getById, getAll, create, update, remove, orderBy } from './firestore';
import { logActivity } from './activityLogService';
import { notify } from './notificationService';
import { generateSku } from '@/utils/format';

const COL = 'products';

export const getProduct = (id) => getById(COL, id);
export const getProducts = () => getAll(COL, orderBy('createdAt', 'desc'));

/** Scan lookup: try SKU first (what QR labels encode), then document ID. */
export async function findProductByCode(code) {
  const clean = String(code).trim();
  const bySku = await getDocs(query(collection(db, COL), where('sku', '==', clean), limit(1)));
  if (!bySku.empty) return { id: bySku.docs[0].id, ...bySku.docs[0].data() };
  return getById(COL, clean);
}

export async function createProduct(data) {
  const sku = data.sku?.trim() || generateSku(data.category);
  const id = await create(COL, {
    ...data,
    sku,
    qrData: sku,
    archived: false,
    totalSold: 0,
    status: Number(data.stockQuantity) > 0 ? 'active' : 'out_of_stock',
  });
  await update(COL, id, { productId: id });
  await logActivity('PRODUCT_CREATED', `Added product "${data.name}" (${sku})`, 'products');
  return id;
}

export async function updateProduct(id, data) {
  const status =
    data.stockQuantity !== undefined
      ? Number(data.stockQuantity) > 0 ? 'active' : 'out_of_stock'
      : undefined;
  await update(COL, id, status ? { ...data, status } : data);
  await logActivity('PRODUCT_UPDATED', `Updated product "${data.name || id}"`, 'products');
}

export async function deleteProduct(id, name) {
  await remove(COL, id);
  await logActivity('PRODUCT_DELETED', `Deleted product "${name || id}"`, 'products');
}

export async function duplicateProduct(product) {
  const { id: _id, productId: _pid, sku: _sku, qrData: _qr, totalSold: _ts, createdAt: _c, updatedAt: _u, ...rest } = product;
  return createProduct({ ...rest, name: `${product.name} (Copy)`, sku: '' });
}

export async function setArchived(id, archived) {
  await update(COL, id, { archived });
  await logActivity(archived ? 'PRODUCT_ARCHIVED' : 'PRODUCT_UNARCHIVED', `Product ${id}`, 'products');
}

/** Bulk import from CSV/Excel rows. Returns { imported, skipped }. */
export async function importProducts(rows) {
  let imported = 0;
  let skipped = 0;
  // Chunked batches — Firestore caps batches at 500 writes
  for (let i = 0; i < rows.length; i += 200) {
    const batch = writeBatch(db);
    for (const row of rows.slice(i, i + 200)) {
      const name = row.name || row.Name;
      const sellingPrice = Number(row.sellingPrice ?? row.SellingPrice ?? row.price ?? 0);
      if (!name || !sellingPrice) { skipped++; continue; }
      const ref = doc(collection(db, COL));
      const sku = (row.sku || row.SKU || '').trim() || generateSku(row.category || row.Category || 'GEN');
      batch.set(ref, {
        name,
        sku,
        productId: ref.id,
        qrData: sku,
        category: row.category || row.Category || 'Uncategorized',
        subCategory: row.subCategory || '',
        brand: row.brand || row.Brand || '',
        size: row.size || row.Size || 'M',
        color: row.color || row.Color || '',
        gender: row.gender || row.Gender || 'Unisex',
        material: row.material || row.Material || '',
        purchasePrice: Number(row.purchasePrice ?? row.PurchasePrice ?? 0),
        sellingPrice,
        discountPrice: row.discountPrice ? Number(row.discountPrice) : null,
        tax: Number(row.tax ?? 5),
        stockQuantity: Number(row.stockQuantity ?? row.stock ?? 0),
        minStock: Number(row.minStock ?? 10),
        supplierId: row.supplierId || null,
        description: row.description || '',
        images: [],
        status: Number(row.stockQuantity ?? 0) > 0 ? 'active' : 'out_of_stock',
        archived: false,
        totalSold: 0,
        createdAt: serverTimestamp(),
      });
      imported++;
    }
    await batch.commit();
  }
  await logActivity('PRODUCTS_IMPORTED', `Imported ${imported} products (${skipped} skipped)`, 'products');
  return { imported, skipped };
}

/** Fires a low-stock notification when a product crosses its threshold. */
export async function checkLowStock(product, newQty) {
  const min = Number(product.minStock) || 10;
  if (newQty <= 0) {
    await notify('low_stock', 'Out of stock', `"${product.name}" (${product.sku}) is out of stock.`);
  } else if (newQty <= min) {
    await notify('low_stock', 'Low stock alert', `"${product.name}" (${product.sku}) is down to ${newQty} units.`);
  }
}
