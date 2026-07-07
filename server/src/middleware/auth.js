import { auth, db } from '../config/firebase.js';

/**
 * Verifies the Firebase ID token from the Authorization header
 * and attaches { uid, email, role } to req.user.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Missing authentication token.' });
    }

    const decoded = await auth.verifyIdToken(token);
    const userSnap = await db.collection('users').doc(decoded.uid).get();

    if (!userSnap.exists || userSnap.data().status !== 'active') {
      return res.status(403).json({ error: 'Account is disabled or not registered.' });
    }

    req.user = { uid: decoded.uid, email: decoded.email, role: userSnap.data().role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/** Restricts a route to specific roles, e.g. requireRole('admin'). */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
}
