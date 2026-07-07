import 'dotenv/config';
import { readFileSync } from 'fs';
import admin from 'firebase-admin';

/**
 * Initialises the Firebase Admin SDK.
 *
 * Credentials resolve in order:
 *  1. FIREBASE_SERVICE_ACCOUNT — the service account JSON as a raw or base64-encoded string
 *     (used on serverless hosts like Vercel, which have no persistent filesystem for secrets).
 *  2. GOOGLE_APPLICATION_CREDENTIALS — a path to the service account JSON file (local dev).
 */
function loadServiceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) {
    const decoded = inline.trim().startsWith('{') ? inline : Buffer.from(inline, 'base64').toString('utf8');
    return JSON.parse(decoded);
  }
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
  return JSON.parse(readFileSync(credsPath, 'utf8'));
}

let app;
try {
  const serviceAccount = loadServiceAccount();
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
} catch (err) {
  console.error(
    '\n[Veloura] Could not load Firebase service account credentials.\n' +
      'Set FIREBASE_SERVICE_ACCOUNT (JSON or base64) for serverless hosting,\n' +
      'or GOOGLE_APPLICATION_CREDENTIALS to a local file path for local dev.\n'
  );
  throw err;
}

export const auth = admin.auth(app);
export const db = admin.firestore(app);
export const storage = admin.storage(app);
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
export default admin;
