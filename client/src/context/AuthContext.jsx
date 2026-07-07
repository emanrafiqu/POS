import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, sendEmailVerification,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { auth, db, applyRememberMe } from '@/firebase/config';
import { logActivity } from '@/services/activityLogService';

const AuthContext = createContext(null);

const DEFAULT_TIMEOUT_MINUTES = 30;
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);        // { uid, email, name, role, ... }
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef(null);
  const timeoutMinutesRef = useRef(DEFAULT_TIMEOUT_MINUTES);

  /* ---------- Session timeout: auto-logout after inactivity ---------- */
  const resetIdleTimer = useCallback(() => {
    clearTimeout(timeoutRef.current);
    if (!auth.currentUser) return;
    timeoutRef.current = setTimeout(async () => {
      toast.info('Session expired due to inactivity. Please sign in again.');
      await logActivity('SESSION_TIMEOUT', 'Automatic logout after inactivity', 'auth');
      await signOut(auth);
    }, timeoutMinutesRef.current * 60 * 1000);
  }, []);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, resetIdleTimer, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, resetIdleTimer));
      clearTimeout(timeoutRef.current);
    };
  }, [resetIdleTimer]);

  /* ---------- Auth state ---------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (!fbUser) {
          setUser(null);
          return;
        }
        const profileSnap = await getDoc(doc(db, 'users', fbUser.uid));
        if (!profileSnap.exists() || profileSnap.data().status !== 'active') {
          toast.error('Your account is disabled or not registered. Contact an administrator.');
          await signOut(auth);
          setUser(null);
          return;
        }
        const profile = profileSnap.data();
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          emailVerified: fbUser.emailVerified,
          name: profile.name,
          role: profile.role,
          phone: profile.phone || '',
        });

        // Load configured session timeout (settings/store)
        try {
          const settingsSnap = await getDoc(doc(db, 'settings', 'store'));
          const mins = Number(settingsSnap.data()?.sessionTimeoutMinutes);
          if (mins > 0) timeoutMinutesRef.current = mins;
        } catch { /* keep default */ }
        resetIdleTimer();
      } catch (err) {
        console.error('[Auth] profile load failed:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [resetIdleTimer]);

  /* ---------- Actions ---------- */
  const login = useCallback(async (email, password, rememberMe) => {
    await applyRememberMe(rememberMe);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await logActivity('LOGIN', `Signed in as ${email}`, 'auth');
    return cred.user;
  }, []);

  const logout = useCallback(async () => {
    await logActivity('LOGOUT', 'Signed out', 'auth');
    await signOut(auth);
  }, []);

  const resetPassword = useCallback((email) => sendPasswordResetEmail(auth, email), []);

  const verifyEmail = useCallback(async () => {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  }, []);

  /** Role helpers used throughout the app. */
  const hasRole = useCallback((...roles) => !!user && roles.includes(user.role), [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, resetPassword, verifyEmail, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
