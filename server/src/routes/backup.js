import { Router } from 'express';
import { db, storage, FieldValue } from '../config/firebase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { httpError } from '../middleware/errorHandler.js';

const router = Router();

const COLLECTIONS = [
  'users', 'roles', 'permissions', 'products', 'categories', 'brands',
  'inventory', 'sales', 'saleItems', 'customers', 'suppliers', 'employees',
  'expenses', 'payments', 'returns', 'discounts', 'notifications',
  'activityLogs', 'settings', 'heldBills',
];

/** Serialise Firestore Timestamps so backups survive a JSON round-trip. */
function serialize(value) {
  if (value === null || value === undefined) return value;
  if (typeof value.toDate === 'function') {
    return { __type: 'timestamp', value: value.toDate().toISOString() };
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
}

function deserialize(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object' && value.__type === 'timestamp') {
    return new Date(value.value);
  }
  if (Array.isArray(value)) return value.map(deserialize);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deserialize(v)]));
  }
  return value;
}

// POST /api/backup — snapshot every collection to Firebase Storage (admin only)
router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const backup = { createdAt: new Date().toISOString(), collections: {} };
    let totalDocs = 0;

    for (const name of COLLECTIONS) {
      const snap = await db.collection(name).get();
      backup.collections[name] = snap.docs.map((d) => ({ id: d.id, data: serialize(d.data()) }));
      totalDocs += snap.size;
    }

    const fileName = `backups/veloura-backup-${Date.now()}.json`;
    const file = storage.bucket().file(fileName);
    await file.save(JSON.stringify(backup), { contentType: 'application/json' });

    const record = {
      fileName,
      totalDocs,
      collections: COLLECTIONS.length,
      createdBy: req.user.uid,
      createdByEmail: req.user.email,
      createdAt: FieldValue.serverTimestamp(),
    };
    const ref = await db.collection('backupHistory').add(record);

    res.json({ id: ref.id, fileName, totalDocs });
  } catch (err) {
    next(err);
  }
});

// GET /api/backup — list backup history (admin only)
router.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const snap = await db.collection('backupHistory').orderBy('createdAt', 'desc').limit(50).get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    next(err);
  }
});

// GET /api/backup/:id/download — download a backup file (admin only)
router.get('/:id/download', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const doc = await db.collection('backupHistory').doc(req.params.id).get();
    if (!doc.exists) throw httpError(404, 'Backup not found.');
    const [contents] = await storage.bucket().file(doc.data().fileName).download();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.data().fileName.split('/').pop()}"`);
    res.send(contents);
  } catch (err) {
    next(err);
  }
});

// POST /api/backup/:id/restore — restore a backup (admin only, destructive)
router.post('/:id/restore', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const doc = await db.collection('backupHistory').doc(req.params.id).get();
    if (!doc.exists) throw httpError(404, 'Backup not found.');

    const [contents] = await storage.bucket().file(doc.data().fileName).download();
    const backup = JSON.parse(contents.toString());
    let restored = 0;

    for (const [name, docs] of Object.entries(backup.collections)) {
      // Firestore batches max out at 500 writes
      for (let i = 0; i < docs.length; i += 400) {
        const batch = db.batch();
        for (const { id, data } of docs.slice(i, i + 400)) {
          batch.set(db.collection(name).doc(id), deserialize(data));
        }
        await batch.commit();
        restored += Math.min(400, docs.length - i);
      }
    }

    await db.collection('activityLogs').add({
      userId: req.user.uid,
      userEmail: req.user.email,
      action: 'DATABASE_RESTORED',
      details: `Restored backup ${doc.data().fileName} (${restored} documents)`,
      module: 'backup',
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({ ok: true, restored });
  } catch (err) {
    next(err);
  }
});

export default router;
