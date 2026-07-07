import { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { setCurrencySymbol } from '@/utils/format';
import { useAuth } from './AuthContext';

const DEFAULTS = {
  storeName: 'Veloura',
  tagline: 'Premium Fashion Store',
  logoUrl: '',
  address: '',
  phone: '',
  email: '',
  taxRate: 5,
  currency: 'PKR',
  currencySymbol: 'Rs.',
  receiptFooter: 'Thank you for shopping at Veloura!',
  returnPolicy: 'Items can be exchanged within 14 days with the original receipt.',
  businessHours: { open: '10:00', close: '22:00' },
  language: 'en',
  lowStockThreshold: 10,
  sessionTimeoutMinutes: 30,
  theme: 'light',
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  // Live-sync store settings once authenticated (rules require sign-in)
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, 'settings', 'store'),
      (snap) => {
        const data = snap.exists() ? { ...DEFAULTS, ...snap.data() } : DEFAULTS;
        setSettings(data);
        setCurrencySymbol(data.currencySymbol);
        setLoaded(true);
      },
      () => setLoaded(true)
    );
    return unsub;
  }, [user]);

  const saveSettings = async (updates) => {
    await setDoc(
      doc(db, 'settings', 'store'),
      { ...updates, updatedAt: serverTimestamp() },
      { merge: true }
    );
  };

  return (
    <SettingsContext.Provider value={{ settings, loaded, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
