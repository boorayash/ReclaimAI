import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

const COLLAPSE_KEY = 'rr_sidebar_collapsed';

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS: Record<string, string> = {
  overview: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  cases: 'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 5h6M9 12h6M9 16h3',
  approvals: 'M9 12l2 2 4-4M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
  'audit-log': 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
  // Simple diamond mark for the logo
  logo: 'M12 2l8 10-8 10-8-10z',
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const NAV = [
    { to: '/overview', label: 'Overview', icon: 'overview', end: true },
    { to: '/cases', label: 'Recovery Cases', icon: 'cases', end: false },
    ...(user?.role === 'ADMIN'
      ? [{ to: '/approvals', label: 'Approvals', icon: 'approvals', end: false }]
      : []),
    { to: '/audit-log', label: 'Audit Log', icon: 'audit-log', end: false },
  ];
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const initial = user?.email?.charAt(0).toUpperCase() ?? '?';

  return (
    <aside
      className={`relative flex h-full flex-col border-r border-hairline bg-surface transition-[width] duration-200 ${
        collapsed ? 'w-16' : 'w-[220px]'
      }`}
    >
      {/* Logo — identity zone */}
      <div className={`flex items-center gap-2.5 p-3 ${collapsed ? 'justify-center' : ''}`}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-accent text-paper">
          <Icon d={ICONS.logo} size={16} />
        </span>
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-ink">ReclaimAI</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-sm px-2.5 py-2 text-sm ${
                isActive ? 'bg-accent-muted font-medium text-accent' : 'text-slate hover:text-ink'
              } ${collapsed ? 'justify-center px-0' : ''}`
            }
          >
            <Icon d={ICONS[item.icon]} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Profile + collapse footer */}
      <div className="relative border-t border-hairline" ref={profileRef}>
        {profileOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
            <div
              className={`absolute bottom-full z-20 mb-2 rounded-sm border border-hairline bg-surface p-3 shadow-md ${
                collapsed ? 'left-0 w-56' : 'left-0 w-full'
              }`}
            >
              <p className="truncate text-sm text-ink">{user?.email}</p>
              <p className="mt-0.5 text-xs capitalize text-slate">{user?.role}</p>
              <button
                onClick={logout}
                className="mt-2 w-full rounded-sm border border-hairline bg-paper px-3 py-1.5 text-xs font-medium text-slate hover:text-ink"
              >
                Log out
              </button>
            </div>
          </>
        )}

        {collapsed ? (
          /* Collapsed: avatar centered, chevron stacked below */
          <div className="flex flex-col items-center gap-1 p-2">
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-muted text-xs font-medium text-accent"
              title={user?.email}
            >
              {initial}
            </button>
            <button
              onClick={toggle}
              className="p-1 text-slate hover:text-ink"
              aria-label="Expand sidebar"
            >
              <Icon d={ICONS['chevron-right']} size={16} />
            </button>
          </div>
        ) : (
          /* Expanded: single row — avatar, email, chevron */
          <div className="flex items-center gap-2 p-2">
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-medium text-accent"
            >
              {initial}
            </button>
            <span className="min-w-0 flex-1 truncate text-sm text-slate">{user?.email}</span>
            <button
              onClick={toggle}
              className="shrink-0 p-1 text-slate hover:text-ink"
              aria-label="Collapse sidebar"
            >
              <Icon d={ICONS['chevron-left']} size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
