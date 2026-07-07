import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { subscribeToNotifications, markAsRead } from '@/services/notificationService';
import { formatDateTime } from '@/utils/format';
import { GlobalSearch } from '@/components/common/GlobalSearch';

const TYPE_COLORS = {
  low_stock: 'bg-amber-400',
  sale: 'bg-emerald-400',
  inventory: 'bg-sky-400',
  payment: 'bg-emerald-400',
  expense: 'bg-rose-400',
  backup: 'bg-violet-400',
  error: 'bg-red-500',
  system: 'bg-gold',
};

export function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => subscribeToNotifications(setNotifications), []);

  // Close notification panel on outside click
  useEffect(() => {
    if (!showNotifs) return;
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showNotifs]);

  const unread = notifications.filter((n) => !n.read).length;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      toast.error('Failed to sign out.');
    }
  };

  return (
    <header className="sticky top-0 z-20 glass border-b border-ink/5 px-4 py-3 lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onMenuClick} className="rounded-lg p-2 hover:bg-ink/5 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm text-ink/40 transition-colors hover:border-gold sm:w-72"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search products, invoices, customers…</span>
            <span className="sm:hidden">Search…</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Notifications */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setShowNotifs((v) => !v)}
              className="relative rounded-xl p-2.5 transition-colors hover:bg-ink/5"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-ink/60" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-ink">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-2xl animate-scale-in">
                <div className="border-b border-ink/5 px-4 py-3 text-sm font-semibold">Notifications</div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-ink/40">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => !n.read && markAsRead(n.id)}
                        className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface ${!n.read ? 'bg-gold-faint/40' : ''}`}
                      >
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TYPE_COLORS[n.type] || 'bg-ink/30'}`} />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-ink">{n.title}</span>
                          <span className="block text-xs text-ink/60">{n.message}</span>
                          <span className="mt-0.5 block text-[10px] text-ink/35">{formatDateTime(n.createdAt)}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Logout */}
          <button onClick={handleLogout} className="rounded-xl p-2.5 transition-colors hover:bg-red-50 hover:text-red-600" aria-label="Sign out" title={`Sign out (${user?.email})`}>
            <LogOut className="h-5 w-5 text-ink/60" />
          </button>
        </div>
      </div>

      <GlobalSearch open={showSearch} onClose={() => setShowSearch(false)} />
    </header>
  );
}
