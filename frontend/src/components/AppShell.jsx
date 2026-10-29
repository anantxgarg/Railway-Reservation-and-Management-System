import React, { useEffect, useMemo, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getMuiTheme } from '../theme';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import { RouterBridge } from '../router';
import { TABS } from '../tabs';
import '../styles/app.css';

/**
 * Layout of the logged-in app: navbar with the user and sign out, one tab per
 * screen the user's role may use (tabs.jsx), and the current screen below.
 * Login, registration and password pages (Team 1) are outside it, in App.jsx.
 *
 * It looks like the login page (railway photo, glass, navy or slate) but has
 * its own markup and styles (styles/app.css, theme.js). It follows the same
 * light/dark choice as the login page.
 */
export default function AppShell() {
  const { user, logoutUser } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const nav = useNavigate();
  const muiTheme = useMemo(() => getMuiTheme(isDark ? 'dark' : 'light'), [isDark]);
  const tabbar = useRef(null);

  const allowed = (t) => !t.roles || t.roles.includes(user.role);
  const tabs = TABS.filter((t) => !t.headerWidget && allowed(t));
  const widgets = TABS.filter((t) => t.headerWidget && allowed(t));
  const first = location.pathname.split('/')[1] || '';
  const current = tabs.find((t) => t.path.slice(1) === first || t.match?.includes(first));

  // On narrow screens the tab bar scrolls: keep the current tab in view
  useEffect(() => {
    tabbar.current?.querySelector('.app-tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current?.path]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <RouterBridge />
      <div className={`app-root ${isDark ? 'app-dark' : 'app-light'}`}>
        <div className="app-bg" aria-hidden="true" />
        <div className="app-bg-overlay" aria-hidden="true" />

        <header className="app-navbar">
          <div className="app-navbar-inner">
            <Link to="/search" className="app-brand" aria-label="Safar home">
              <span className="app-brand-logo" aria-hidden="true"><TrainLogo /></span>
              <span className="app-brand-text">
                <span className="app-brand-title">Safar</span>
                <span className="app-brand-tag">Railway Reservation</span>
              </span>
            </Link>

            <div className="app-navbar-actions">
              <ThemeButton />
              {widgets.map((t) => (
                <t.headerWidget key={t.path} user={user} onClick={() => nav(t.path)} />
              ))}
              <button
                type="button"
                className="app-user-chip"
                onClick={() => nav(user.role === 'ADMIN' ? '/admin' : '/account')}
                title="Your account"
              >
                <span className={`app-avatar role-${user.role.toLowerCase()}`} aria-hidden="true">
                  {(user.name || user.email || 'U')[0].toUpperCase()}
                </span>
                <span className="app-user-text">
                  <span className="app-user-name">{user.name || user.email}</span>
                  <span className="app-user-role">{user.role}</span>
                </span>
              </button>
              <button type="button" className="app-signout" onClick={logoutUser}>
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <nav className="app-tabbar" aria-label="Sections">
          <div className="app-tabbar-inner" ref={tabbar}>
            {tabs.map((t) => {
              const active = current?.path === t.path;
              return (
                <Link
                  key={t.path}
                  to={t.path}
                  className={`app-tab ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {user.role !== 'CUSTOMER' && t.staffIcon ? t.staffIcon : t.icon}
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="app-main">
          <Outlet />
        </main>

        <footer className="app-footer">
          <div className="app-footer-inner">
            <div className="app-footer-top">
              <div>
                <div className="app-footer-name">SAFAR · RAILWAY RESERVATION</div>
                <p className="app-footer-tagline">Let every journey take you somewhere wonderful.</p>
              </div>
              <div className="app-footer-links">
                {tabs.slice(0, 5).map((t) => <Link key={t.path} to={t.path}>{t.label}</Link>)}
              </div>
            </div>
            <div className="app-footer-bottom">
              <span>Railway Reservation and Management System</span>
              <span aria-hidden="true">·</span>
              <span>Rail Madad helpline 139</span>
              <span aria-hidden="true">·</span>
              <span>All rights reserved</span>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}

// Light/dark switch. Uses the same setting as the login page's toggle.
function ThemeButton() {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button type="button" className="app-icon-btn" onClick={toggleTheme} aria-label={label} title={label}>
      {isDark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function TrainLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="14" rx="2" />
      <path d="M4 11h16" />
      <path d="M12 3v8" />
      <path d="m8 17-2 4" />
      <path d="m16 17 2 4" />
      <circle cx="9" cy="14" r="1" />
      <circle cx="15" cy="14" r="1" />
    </svg>
  );
}
