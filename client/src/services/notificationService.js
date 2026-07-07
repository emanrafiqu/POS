import { create, update, subscribe, orderBy, limit } from './firestore';

/** type: low_stock | sale | inventory | payment | expense | backup | error | system */
export async function notify(type, title, message) {
  try {
    await create('notifications', { type, title, message, read: false });
  } catch (err) {
    console.error('[Notifications] failed:', err);
  }
}

export function subscribeToNotifications(callback, count = 30) {
  return subscribe('notifications', [orderBy('createdAt', 'desc'), limit(count)], callback);
}

export async function markAsRead(id) {
  await update('notifications', id, { read: true });
}
