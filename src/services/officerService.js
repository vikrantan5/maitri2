import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

const CASES = 'emergencyCases';

/**
 * Subscribe to all emergency cases assigned to the given officer uid.
 * Returns an unsubscribe function.
 */
export const subscribeToOfficerCases = (uid, callback) => {
  if (!uid) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, CASES), where('assignedOfficers', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
      callback(list);
    },
    (err) => {
      console.warn('officer cases listener error', err);
      callback([]);
    },
  );
};

/**
 * Subscribe to a single emergency case in real-time.
 */
export const subscribeToCase = (caseId, callback) => {
  if (!caseId) {
    callback(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, CASES, caseId),
    (snap) => {
      if (!snap.exists()) return callback(null);
      callback({ id: snap.id, ...snap.data() });
    },
    (err) => {
      console.warn('case listener error', err);
      callback(null);
    },
  );
};

export const getCase = async (caseId) => {
  const ref = doc(db, CASES, caseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

/**
 * Update case status (in_progress | resolved | false_alarm | escalated).
 * Also appends a note for traceability.
 */
export const updateCaseStatus = async (caseId, status, by, noteText) => {
  const updates = { status };
  if (status === 'resolved' || status === 'false_alarm') {
    updates.resolvedAt = serverTimestamp();
  }
  if (noteText) {
    updates.notes = arrayUnion({
      by: by || 'officer',
      text: noteText,
      at: new Date().toISOString(),
    });
  }
  await updateDoc(doc(db, CASES, caseId), updates);
};

export const addCaseNote = async (caseId, by, text) => {
  if (!text || !text.trim()) return;
  await updateDoc(doc(db, CASES, caseId), {
    notes: arrayUnion({
      by: by || 'officer',
      text: text.trim(),
      at: new Date().toISOString(),
    }),
    lastNoteAt: serverTimestamp(),
  });
};
