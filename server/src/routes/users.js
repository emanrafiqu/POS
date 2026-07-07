import { Router } from 'express';
import { auth, db, FieldValue } from '../config/firebase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { httpError } from '../middleware/errorHandler.js';

const router = Router();
const VALID_ROLES = ['admin', 'manager', 'cashier'];

/** Writes an entry to the immutable audit trail. */
async function logActivity(actor, action, details) {
  await db.collection('activityLogs').add({
    userId: actor.uid,
    userEmail: actor.email,
    action,
    details,
    module: 'users',
    createdAt: FieldValue.serverTimestamp(),
  });
}

// GET /api/users — list all users (admin & manager)
router.get('/', requireAuth, requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    next(err);
  }
});

// POST /api/users — create a user with a role (admin only)
router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { email, password, name, role, phone } = req.body;
    if (!email || !password || !name || !VALID_ROLES.includes(role)) {
      throw httpError(400, 'email, password, name and a valid role are required.');
    }
    if (password.length < 8) {
      throw httpError(400, 'Password must be at least 8 characters.');
    }

    const userRecord = await auth.createUser({ email, password, displayName: name });
    await auth.setCustomUserClaims(userRecord.uid, { role });

    const profile = {
      name,
      email,
      role,
      phone: phone || '',
      status: 'active',
      emailVerified: false,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: req.user.uid,
    };
    await db.collection('users').doc(userRecord.uid).set(profile);
    await logActivity(req.user, 'USER_CREATED', `Created ${role} account for ${email}`);

    res.status(201).json({ id: userRecord.uid, ...profile });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      return next(httpError(409, 'A user with this email already exists.'));
    }
    next(err);
  }
});

// PATCH /api/users/:id — update role / status / profile (admin only)
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, status, name, phone } = req.body;
    const updates = {};

    if (role) {
      if (!VALID_ROLES.includes(role)) throw httpError(400, 'Invalid role.');
      updates.role = role;
      await auth.setCustomUserClaims(id, { role });
    }
    if (status) {
      if (!['active', 'disabled'].includes(status)) throw httpError(400, 'Invalid status.');
      updates.status = status;
      await auth.updateUser(id, { disabled: status === 'disabled' });
      if (status === 'disabled') await auth.revokeRefreshTokens(id);
    }
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;

    updates.updatedAt = FieldValue.serverTimestamp();
    await db.collection('users').doc(id).update(updates);
    await logActivity(req.user, 'USER_UPDATED', `Updated user ${id}: ${Object.keys(updates).join(', ')}`);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id — remove a user (admin only, cannot delete self)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.uid) throw httpError(400, 'You cannot delete your own account.');

    await auth.deleteUser(id);
    await db.collection('users').doc(id).delete();
    await logActivity(req.user, 'USER_DELETED', `Deleted user ${id}`);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
