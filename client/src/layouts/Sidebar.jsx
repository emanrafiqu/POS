import { NavLink } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { NAV_ITEMS } from '@/constants';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { cn } from '@/utils/cn';

export function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user?.role));

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink text-white transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="logo" className="h-9 w-9 rounded-xl object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold font-serif text-lg font-bold text-ink">
              V
            </div>
          )}
          <div>
            <p className="font-semibold tracking-wide text-gold">{settings.storeName || 'Veloura'}</p>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Point of Sale</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {items.map(({ to, label, icon }) => {
            const Icon = Icons[icon] || Icons.Circle;
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-gold text-ink shadow-gold'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  )
                }
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </NavLink>
            );
          })}
        </nav>

        {/* User chip */}
        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-xs font-semibold text-gold">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="text-[11px] capitalize text-white/40">{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
