import { Router } from 'express';
import { db } from '../config/firebase.js';
import { seedDatabase } from '../services/seedService.js';
import { httpError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * POST /api/seed
 * Bootstraps the database with demo data and the first admin account.
 * Only allowed while the users collection is empty (first-run setup),
 * so it cannot be abused on a live system.
 */
router.post('/', async (req, res, next) => {
  try {
    const existing = await db.collection('users').limit(1).get();
    if (!existing.empty) {
      throw httpError(403, 'Database already contains users. Seeding is only allowed on an empty database.');
    }

    const { adminEmail, adminPassword, adminName } = req.body;
    if (!adminEmail || !adminPassword || (adminPassword + '').length < 8) {
      throw httpError(400, 'adminEmail and an adminPassword of at least 8 characters are required.');
    }

    console.log('[Veloura] Seeding database… this can take a minute.');
    const summary = await seedDatabase({
      adminEmail,
      adminPassword,
      adminName: adminName || 'Store Admin',
    });
    console.log('[Veloura] Seed complete:', summary);

    res.status(201).json({ ok: true, summary });
  } catch (err) {
    next(err);
  }
});

export default router;
