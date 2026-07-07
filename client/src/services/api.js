/**
 * Client for the Express backend (privileged operations only:
 * user management, backup/restore, first-run seeding).
 */
import { auth } from '@/firebase/config';
import { API_BASE } from '@/constants';

async function request(path, { method = 'GET', body, blob = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const user = auth.currentUser;
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json()).error || message;
    } catch { /* non-JSON error body */ }
    throw new Error(message);
  }
  return blob ? res.blob() : res.json();
}

export const api = {
  // Users (admin)
  listUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PATCH', body: data }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  // Backup (admin)
  listBackups: () => request('/backup'),
  createBackup: () => request('/backup', { method: 'POST' }),
  restoreBackup: (id) => request(`/backup/${id}/restore`, { method: 'POST' }),
  downloadBackup: (id) => request(`/backup/${id}/download`, { blob: true }),

  // First-run seeding (no auth — only works on an empty database)
  seedDatabase: (data) => request('/seed', { method: 'POST', body: data }),
};
