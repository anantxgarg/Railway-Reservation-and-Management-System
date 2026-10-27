import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Box, Tabs, Tab, Container, Button, Chip, Paper
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import DirectionsTransitIcon from '@mui/icons-material/DirectionsTransit';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import muiTheme from '../theme';
import { useAuth } from '../context/useAuth';
import { RouterBridge } from '../router';
import { TABS } from '../tabs';

/**
 * Layout of the logged-in app: header with the user and log out, one tab per
 * screen the user's role may use (tabs.jsx), and the current screen below.
 * Login, registration and password pages (Team 1) are outside it, in App.jsx.
 *
 * The screens are Material UI in a dark theme. Team 1's account and admin
 * cards use their own CSS, which follows the data-theme attribute; it is
 * switched to dark while the shell is shown so both look the same, and set
 * back to the user's choice on the login pages.
 */
export default function AppShell() {
  const { user, logoutUser } = useAuth();
  const location = useLocation();
  const nav = useNavigate();

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'dark');
    return () => {
      if (previous) root.setAttribute('data-theme', previous);
    };
  }, []);

  const tabs = TABS.filter((t) => !t.headerWidget && (!t.roles || t.roles.includes(user.role)));
  const first = location.pathname.split('/')[1] || '';
  const current = tabs.find((t) => t.path.slice(1) === first || t.match?.includes(first));

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <RouterBridge />
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        <AppBar position="static" elevation={0} sx={{ bgcolor: '#0b111e', borderBottom: '1px solid #1e293b' }}>
          <Toolbar sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <DirectionsTransitIcon sx={{ fontSize: 28, color: '#f8fafc', mr: 1.5 }} />
              <Typography variant="h6" component="div" sx={{ fontWeight: 800, letterSpacing: '1px', color: '#f8fafc' }}>
                SAFAR · RAILWAY RESERVATION
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {TABS.filter((t) => t.headerWidget && (!t.roles || t.roles.includes(user.role))).map((t) => (
                <t.headerWidget key={t.path} user={user} onClick={() => nav(t.path)} />
              ))}
              <Chip
                icon={<AccountCircleIcon style={{ color: '#fff' }} />}
                label={`${user.name || user.email} · ${user.role}`}
                color={user.role === 'ADMIN' ? 'error' : user.role === 'STAFF' ? 'warning' : 'primary'}
                onClick={() => nav(user.role === 'ADMIN' ? '/admin' : '/account')}
                sx={{ fontWeight: 600, color: '#fff', maxWidth: { xs: 220, sm: 'none' } }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={logoutUser}
                sx={{ color: '#f8fafc', borderColor: '#22324e' }}
              >
                Log out
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        <Paper elevation={0} square sx={{ bgcolor: '#0f172a', borderBottom: '1px solid #1e293b' }}>
          <Container maxWidth="xl">
            <Tabs
              value={current ? current.path : false}
              onChange={(e, value) => nav(value)}
              textColor="secondary"
              indicatorColor="secondary"
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': { color: '#94a3b8', fontWeight: 600, py: 2, px: 1.5, minWidth: 0, '&.Mui-selected': { color: '#38bdf8' } },
                '& .MuiTabs-indicator': { backgroundColor: '#38bdf8', height: 3, borderRadius: '3px 3px 0 0' },
              }}
            >
              {tabs.map((t) => (
                <Tab
                  key={t.path}
                  value={t.path}
                  icon={user.role !== 'CUSTOMER' && t.staffIcon ? t.staffIcon : t.icon}
                  iconPosition="start"
                  label={t.label}
                />
              ))}
            </Tabs>
          </Container>
        </Paper>

        <Container maxWidth="lg" sx={{ flexGrow: 1, py: 3 }}>
          <Outlet />
        </Container>

        <Box sx={{ py: 2.5, textAlign: 'center', bgcolor: '#0b111e', borderTop: '1px solid #1e293b', mt: 'auto' }}>
          <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
            Railway Reservation and Management System
          </Typography>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
