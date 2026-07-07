/**
 * Generic Firestore helpers — every domain service builds on these,
 * keeping query/CRUD code in one place.
 */
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';

const withId = (snap) => ({ id: snap.id, ...snap.data() });

export async function getById(colName, id) {
  const snap = await getDoc(doc(db, colName, id));
  return snap.exists() ? withId(snap) : null;
}

export async function getAll(colName, ...constraints) {
  const snap = await getDocs(query(collection(db, colName), ...constraints));
  return snap.docs.map(withId);
}

export async function create(colName, data) {
  const ref = await addDoc(collection(db, colName), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function createWithId(colName, id, data) {
  await setDoc(doc(db, colName, id), { ...data, createdAt: serverTimestamp() });
  return id;
}

export async function update(colName, id, data) {
  await updateDoc(doc(db, colName, id), { ...data, updatedAt: serverTimestamp() });
}

export async function remove(colName, id) {
  await deleteDoc(doc(db, colName, id));
}

/** Real-time subscription; returns the unsubscribe function. */
export function subscribe(colName, constraints, callback, onError) {
  const q = query(collection(db, colName), ...constraints);
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(withId)),
    (err) => {
      console.error(`[Firestore] ${colName} subscription failed:`, err);
      onError?.(err);
    }
  );
}

/** Cursor-based pagination helper. */
export async function getPage(colName, { constraints = [], pageSize = 20, cursor = null }) {
  const parts = [...constraints, limit(pageSize + 1)];
  if (cursor) parts.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, colName), ...parts));
  const docs = snap.docs.slice(0, pageSize);
  return {
    items: docs.map(withId),
    nextCursor: snap.docs.length > pageSize ? docs[docs.length - 1] : null,
  };
}

export { where, orderBy, limit, serverTimestamp };
