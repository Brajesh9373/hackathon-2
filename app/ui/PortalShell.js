'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { auth, clearToken, getStoredUser, resources } from '../lib/api';
import { initials } from './CivicUI';

const roleAliases = { citizen: 'citizen', admin: 'admin', supervisor: 'supervisor', worker: 'worker', super_admin: 'admin', department_manager: 'admin', district_officer: 'admin', cm: 'admin', cm_staff: 'admin', officer: 'worker' };
const navByRole = {
  citizen: [['Overview', '/citizen'], ['Speak to NagarSetu', '/citizen/new'], ['My complaints', '/citizen/complaints']],
  admin: [['Overview', '/admin'], ['Routing desk', '/admin/complaints'], ['People', '/admin/team'], ['Recovery', '/admin/recovery'], ['Truth Center', '/admin/truth']],
  supervisor: [['Overview', '/supervisor'], ['Priority queue', '/supervisor/queue'], ['Routes', '/supervisor/routes']],
  worker: [['My work', '/worker'], ['Completed', '/worker/completed']],
};
const roleLabels = { citizen: 'Citizen', admin: 'Municipal admin', supervisor: 'Field supervisor', worker: 'Field worker' };

export function currentPortalRole(user) { return roleAliases[user?.portalRole || user?.role] || 'citizen'; }

export default function PortalShell({ children, role: requestedRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace('/'); return; }
    const role = currentPortalRole(stored);
    if (requestedRole && role !== requestedRole) { router.replace(`/${role}`); return; }
    setUser({ ...stored, portalRole: role });
    resources.notifications().then(result => setNotifications(result?.notifications || [])).catch(() => setNotifications([]));
  }, [requestedRole, router]);

  const role = currentPortalRole(user);
  const nav = navByRole[role] || navByRole.citizen;
  const unread = notifications.filter(item => !item.is_read).length;
  const activeLabel = useMemo(() => nav.find(([, href]) => pathname === href || (href !== `/${role}` && pathname.startsWith(`${href}/`)))?.[0] || nav[0][0], [nav, pathname, role]);
  const logout = async () => { await auth.logout().catch(() => null); clearToken(); router.replace('/'); };
  const go = href => { router.push(href); setNavOpen(false); setNotificationsOpen(false); };

  if (!user) return <div className="v-loading"><div className="v-loading-mark">N</div><p>Opening your workspace</p></div>;

  return <div className="v-app-shell"><div className="v-main-shell">
    <header className="v-topbar v-topbar-modern">
      <div className="v-topbar-brand"><span className="v-brand-mark">N</span><div><strong>NAGARSETU</strong><small>Kopargaon civic register</small></div></div>
      <button className="v-menu-button" onClick={() => setNavOpen(open => !open)} aria-label="Toggle navigation">Menu</button>
      <nav className={`v-top-nav ${navOpen ? 'is-open' : ''}`} aria-label="Workspace navigation">{nav.map(([label, href]) => <button key={href} className={activeLabel === label ? 'is-active' : ''} onClick={() => go(href)}>{label}</button>)}</nav>
      <div className="v-top-actions"><div className="v-live-status"><i />Live</div><div className="v-notification-wrap"><button className="v-icon-button" onClick={() => setNotificationsOpen(open => !open)} aria-label="Notifications" aria-expanded={notificationsOpen}>Alerts{unread > 0 && <b>{unread}</b>}</button>{notificationsOpen && <div className="v-notification-panel"><div><strong>Notifications</strong><button onClick={() => { resources.readAllNotifications().catch(() => null); setNotifications(notifications.map(item => ({ ...item, is_read: true }))); setNotificationsOpen(false); }}>Mark all read</button></div>{notifications.length ? notifications.slice(0, 4).map(item => <button key={item._id} onClick={() => { resources.readNotification(item._id).catch(() => null); if (item.complaint_id) go(role === 'citizen' ? `/citizen/complaints/${item.complaint_id}` : role === 'admin' ? `/admin/complaints?focus=${item.complaint_id}` : role === 'supervisor' ? `/supervisor/queue?focus=${item.complaint_id}` : `/worker?focus=${item.complaint_id}`); }}><i />{item.message || 'Complaint updated'}<small>{item.complaint_id || 'NagarSetu register'}</small></button>) : <p>No new updates</p>}</div>}</div><div className="v-profile"><span>{initials(user.portalName || user.name)}</span><div><strong>{user.portalName || user.name || roleLabels[role]}</strong><small>{roleLabels[role]}</small></div></div><button className="v-logout-top" onClick={logout}>Log out</button></div>
    </header>
    <div className="v-context-strip"><span>{roleLabels[role]}</span><strong>{activeLabel}</strong><span className="v-context-next">One clear next action</span></div>
    <main className="v-page">{children}</main>
  </div></div>;
}
