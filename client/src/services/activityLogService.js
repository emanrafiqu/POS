import { create, getAll, where, orderBy, limit } from './firestore';
import { auth } from '@/firebase/config';

/**
 * Immutable audit trail. Firestore rules forbid update/delete on activityLogs.
 * Logging never throws — an audit failure must not break the operation itself.
 */
export async function logActivity(action, details, module = 'general') {
  try {
    const user = auth.currentUser;
    await create('activityLogs', {
      userId: user?.uid || 'system',
      userEmail: user?.email || 'system',
      action,
      details,
      module,
    });
  } catch (err) {
    console.error('[ActivityLog] failed:', err);
  }
}

export async function getRecentLogs(count = 100) {
  return getAll('activityLogs', orderBy('createdAt', 'desc'), limit(count));
}

export async function getLogsByUser(userId, count = 100) {
  return getAll('activityLogs', where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(count));
}
