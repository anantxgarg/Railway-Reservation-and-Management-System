import React, { useState, useEffect } from 'react';
import {
  AppBar, Toolbar, Typography, Box, Tabs, Tab, Container,
  Button, Chip, Paper
} from '@mui/material';
import DirectionsTransitIcon from '@mui/icons-material/DirectionsTransit';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import PaymentIcon from '@mui/icons-material/Payment';
import ReceiptIcon from '@mui/icons-material/Receipt';
import UndoIcon from '@mui/icons-material/Undo';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';

import BookingAndPayment from './components/BookingAndPayment';
import MyPayments from './components/MyPayments';
import Refunds from './components/Refunds';
import Concessions from './components/Concessions';
import LoginModal from './components/LoginModal';
import { getCurrentUser, loginWithRole } from './api';

export default function App() {
  const [tabIndex, setTabIndex] = useState(0);
  const [user, setUser] = useState(getCurrentUser());
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // Initialize dev session on start
  useEffect(() => {
    loginWithRole(user.role, user.userId, user.email)
      .then(({ user: loggedUser }) => {
        setUser(loggedUser);
      })
      .catch((e) => {
        console.warn('Initial session initialization:', e);
      });
  }, []);

  const getRoleChipColor = (role) => {
    if (role === 'ADMIN') return 'error';
    if (role === 'STAFF') return 'warning';
    return 'primary';
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Top Navbar */}
      <AppBar position="static" elevation={0} sx={{ bgcolor: '#0b111e', borderBottom: '1px solid #1e293b' }}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1.5px solid rgba(255, 255, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 2,
                boxShadow: '0 0 12px rgba(37, 99, 235, 0.35)',
                background: 'rgba(17, 26, 46, 0.8)'
              }}
            >
              <DirectionsTransitIcon sx={{ fontSize: 24, color: '#f8fafc' }} />
            </Box>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 800, letterSpacing: '1px', color: '#f8fafc', lineHeight: 1.2 }}>
                RAILWAY MANAGEMENT SYSTEM
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', letterSpacing: '0.5px' }}>
                Safe Journeys &bull; Better Tomorrows
              </Typography>
            </Box>
          </Box>

          {/* User Account / Role Pill & Login Button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              icon={<AccountCircleIcon style={{ color: '#fff' }} />}
              label={`${user.role} (${user.email})`}
              color={getRoleChipColor(user.role)}
              sx={{ fontWeight: 600, color: '#fff', bgcolor: user.role === 'CUSTOMER' ? '#1d68ed' : undefined }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={() => setLoginModalOpen(true)}
              sx={{
                color: '#f8fafc',
                borderColor: '#22324e',
                bgcolor: 'rgba(17, 26, 46, 0.8)',
                '&:hover': { borderColor: '#3b82f6', bgcolor: '#111a2e' }
              }}
            >
              Login / Switch Account
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Subheader Navigation Tabs */}
      <Paper elevation={0} square sx={{ bgcolor: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <Container maxWidth="lg">
          <Tabs
            value={tabIndex}
            onChange={(e, newIdx) => setTabIndex(newIdx)}
            textColor="secondary"
            indicatorColor="secondary"
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                color: '#94a3b8',
                fontWeight: 600,
                py: 2,
                '&.Mui-selected': {
                  color: '#38bdf8',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#38bdf8',
                height: 3,
                borderRadius: '3px 3px 0 0',
              },
            }}
          >
            <Tab icon={<PaymentIcon />} iconPosition="start" label="Book & Pay" />
            <Tab icon={<ReceiptIcon />} iconPosition="start" label="My Payments" />
            <Tab icon={<UndoIcon />} iconPosition="start" label="Refunds" />
            <Tab
              icon={user.role === 'CUSTOMER' ? <CardMembershipIcon /> : <SupervisorAccountIcon />}
              iconPosition="start"
              label={user.role === 'CUSTOMER' ? 'Apply Concessions' : 'Staff Concessions Review'}
            />
          </Tabs>
        </Container>
      </Paper>

      {/* Main Content Area */}
      <Container maxWidth="lg" sx={{ flexGrow: 1, py: 3 }}>
        {tabIndex === 0 && <BookingAndPayment user={user} />}
        {tabIndex === 1 && <MyPayments user={user} />}
        {tabIndex === 2 && <Refunds user={user} />}
        {tabIndex === 3 && <Concessions user={user} />}
      </Container>

      {/* Footer (Clean, no tech stack mentioned) */}
      <Box sx={{ py: 2.5, textAlign: 'center', bgcolor: '#0b111e', borderTop: '1px solid #1e293b', mt: 'auto' }}>
        <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
          Railway Management System &bull; Safe Journeys &bull; Better Tomorrows
        </Typography>
      </Box>

      {/* Polished Login Modal */}
      <LoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={(updatedUser) => setUser(updatedUser)}
      />
    </Box>
  );
}
