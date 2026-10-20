import React, { useEffect, useState } from 'react';
import {
  AppBar, Toolbar, Typography, Box, Tabs, Tab, Container, Button, Chip, Paper
} from '@mui/material';
import DirectionsTransitIcon from '@mui/icons-material/DirectionsTransit';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SearchIcon from '@mui/icons-material/Search';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ReceiptIcon from '@mui/icons-material/Receipt';
import UndoIcon from '@mui/icons-material/Undo';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';

import LoginPage from './features/auth/LoginPage';
import SearchPage from './features/booking/SearchPage';
import PassengerForm from './features/booking/PassengerForm';
import BookingPage from './features/booking/BookingPage';
import PnrLookup from './features/booking/PnrLookup';
import MyBookings from './features/booking/MyBookings';
import MyPayments from './components/MyPayments';
import Refunds from './components/Refunds';
import Concessions from './components/Concessions';
import { getCurrentUser, logout, setSessionEndedHandler } from './api';
import { navigate, useRoute } from './router';

// Screens by the first part of the hash (#/pnr/123 -> 'pnr').
// Booking: Team 3. Payments, refunds, concessions: Team 4. Login: Team 1's API.
const TABS = [
  { route: 'search', label: 'Book', icon: <SearchIcon /> },
  { route: 'pnr', label: 'PNR status', icon: <ConfirmationNumberIcon /> },
  { route: 'bookings', label: 'My bookings', icon: <ListAltIcon />, customerOnly: true },
  { route: 'payments', label: 'My payments', icon: <ReceiptIcon />, customerOnly: true },
  { route: 'refunds', label: 'Refunds', icon: <UndoIcon /> },
  { route: 'concessions', label: 'Concessions', icon: <CardMembershipIcon />, staffIcon: <SupervisorAccountIcon /> },
];

const ROUTE_TAB = { book: 'search' };

export default function App() {
  const [user, setUser] = useState(getCurrentUser);
  const [notice, setNotice] = useState(null);
  const route = useRoute();

  useEffect(() => {
    setSessionEndedHandler(() => {
      setNotice('Your session has ended. Please log in again.');
      setUser(null);
    });
  }, []);

  if (!user) {
    return (
      <LoginPage
        notice={notice}
        onLogin={(u) => {
          setNotice(null);
          setUser(u);
        }}
      />
    );
  }

  const isCustomer = user.role === 'CUSTOMER';
  const tabs = TABS.filter((t) => isCustomer || !t.customerOnly);
  const [page = 'search', ...params] = route;
  const known = tabs.some((t) => t.route === page) || page in ROUTE_TAB;
  const current = known ? (ROUTE_TAB[page] || page) : 'search';

  let content;
  switch (known ? page : 'search') {
    case 'book':
      content = <PassengerForm key={params.join('/')} params={params} />;
      break;
    case 'pnr':
      content = params[0] ? <BookingPage pnr={params[0]} user={user} /> : <PnrLookup />;
      break;
    case 'bookings':
      content = <MyBookings />;
      break;
    case 'payments':
      content = <MyPayments user={user} />;
      break;
    case 'refunds':
      content = <Refunds user={user} />;
      break;
    case 'concessions':
      content = <Concessions user={user} />;
      break;
    default:
      content = <SearchPage params={known ? params : []} canBook={isCustomer} />;
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={0} sx={{ bgcolor: '#0b111e', borderBottom: '1px solid #1e293b' }}>
        <Toolbar sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <DirectionsTransitIcon sx={{ fontSize: 28, color: '#f8fafc', mr: 1.5 }} />
            <Typography variant="h6" component="div" sx={{ fontWeight: 800, letterSpacing: '1px', color: '#f8fafc' }}>
              RAILWAY RESERVATION
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              icon={<AccountCircleIcon style={{ color: '#fff' }} />}
              label={`${user.name || user.email} · ${user.role}`}
              color={user.role === 'ADMIN' ? 'error' : user.role === 'STAFF' ? 'warning' : 'primary'}
              sx={{ fontWeight: 600, color: '#fff', maxWidth: { xs: 220, sm: 'none' } }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={async () => {
                await logout();
                setUser(null);
                navigate('/search');
              }}
              sx={{ color: '#f8fafc', borderColor: '#22324e' }}
            >
              Log out
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Paper elevation={0} square sx={{ bgcolor: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <Container maxWidth="lg">
          <Tabs
            value={current}
            onChange={(e, value) => navigate(`/${value}`)}
            textColor="secondary"
            indicatorColor="secondary"
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': { color: '#94a3b8', fontWeight: 600, py: 2, '&.Mui-selected': { color: '#38bdf8' } },
              '& .MuiTabs-indicator': { backgroundColor: '#38bdf8', height: 3, borderRadius: '3px 3px 0 0' },
            }}
          >
            {tabs.map((t) => (
              <Tab
                key={t.route}
                value={t.route}
                icon={!isCustomer && t.staffIcon ? t.staffIcon : t.icon}
                iconPosition="start"
                label={t.label}
              />
            ))}
          </Tabs>
        </Container>
      </Paper>

      <Container maxWidth="lg" sx={{ flexGrow: 1, py: 3 }}>
        {content}
      </Container>

      <Box sx={{ py: 2.5, textAlign: 'center', bgcolor: '#0b111e', borderTop: '1px solid #1e293b', mt: 'auto' }}>
        <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
          Railway Reservation and Management System
        </Typography>
      </Box>
    </Box>
  );
}
