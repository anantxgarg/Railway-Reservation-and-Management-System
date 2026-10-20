import React, { useState, useEffect } from 'react';
import {
  AppBar, Toolbar, Typography, Box, Tabs, Tab, Container,
  Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, TextField, Alert,
  Paper, IconButton, Tooltip
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
import { getCurrentUser, loginWithRole, setAuthSession } from './api';

export default function App() {
  const [tabIndex, setTabIndex] = useState(0);
  const [user, setUser] = useState(getCurrentUser());
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [customUserId, setCustomUserId] = useState(user.userId);
  const [customEmail, setCustomEmail] = useState(user.email);
  const [authError, setAuthError] = useState(null);

  // Auto-login on initial mount to ensure valid token in localStorage
  useEffect(() => {
    loginWithRole(user.role, user.userId, user.email)
      .then(({ user: loggedUser }) => {
        setUser(loggedUser);
      })
      .catch((e) => {
        console.warn('Initial dev token generation:', e);
      });
  }, []);

  const handleSwitchRoleSubmit = async () => {
    setAuthError(null);
    try {
      const { user: updatedUser } = await loginWithRole(selectedRole, customUserId, customEmail);
      setUser(updatedUser);
      setRoleDialogOpen(false);
    } catch (err) {
      setAuthError(err.message || 'Failed to authenticate');
    }
  };

  const getRoleChipColor = (role) => {
    if (role === 'ADMIN') return 'error';
    if (role === 'STAFF') return 'warning';
    return 'info';
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <AppBar position="static" sx={{ bgcolor: 'primary.main' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <DirectionsTransitIcon sx={{ fontSize: 32, mr: 1.5, color: 'secondary.light' }} />
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
                INDIAN RAILWAYS
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Payments, Refunds & Concessions Subsystem (Module 4)
              </Typography>
            </Box>
          </Box>

          {/* User Account / Role Pill */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              icon={<AccountCircleIcon style={{ color: '#fff' }} />}
              label={`${user.role} (#${user.userId})`}
              color={getRoleChipColor(user.role)}
              sx={{ fontWeight: 600, color: '#fff' }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setSelectedRole(user.role);
                setCustomUserId(user.userId);
                setCustomEmail(user.email);
                setRoleDialogOpen(true);
              }}
              sx={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: '#ffffff' } }}
            >
              Switch Role / Login
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Subheader Navigation Tabs */}
      <Paper elevation={1} square sx={{ bgcolor: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <Container maxWidth="lg">
          <Tabs
            value={tabIndex}
            onChange={(e, newIdx) => setTabIndex(newIdx)}
            textColor="primary"
            indicatorColor="secondary"
            variant="scrollable"
            scrollButtons="auto"
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

      {/* Footer */}
      <Box sx={{ py: 2, textAlign: 'center', bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', mt: 'auto' }}>
        <Typography variant="caption" color="text.secondary">
          Railway Management System &bull; Java 17 + Spring Boot 3.3.5 &bull; PostgreSQL &bull; React + MUI &bull; Razorpay Test Gateway
        </Typography>
      </Box>

      {/* Role Switch / Login Dialog */}
      <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Switch Role / JWT Login</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Simulate logging in as different system roles to verify Spring Security RBAC and user data isolation.
          </Typography>

          {authError && <Alert severity="error" sx={{ mb: 2 }}>{authError}</Alert>}

          <FormControl fullWidth size="small" sx={{ mb: 2, mt: 1 }}>
            <InputLabel>System Role</InputLabel>
            <Select
              value={selectedRole}
              label="System Role"
              onChange={(e) => {
                const r = e.target.value;
                setSelectedRole(r);
                if (r === 'STAFF') {
                  setCustomUserId(99);
                  setCustomEmail('staff@railways.gov.in');
                } else if (r === 'ADMIN') {
                  setCustomUserId(999);
                  setCustomEmail('admin@railways.gov.in');
                } else {
                  setCustomUserId(1);
                  setCustomEmail('passenger@railways.gov.in');
                }
              }}
            >
              <MenuItem value="CUSTOMER">CUSTOMER (Passenger)</MenuItem>
              <MenuItem value="STAFF">STAFF (Concession Approver / TC)</MenuItem>
              <MenuItem value="ADMIN">ADMIN (System Administrator)</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="User ID"
            type="number"
            value={customUserId}
            onChange={(e) => setCustomUserId(Number(e.target.value))}
            size="small"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="User Email"
            type="email"
            value={customEmail}
            onChange={(e) => setCustomEmail(e.target.value)}
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSwitchRoleSubmit}>
            Apply & Generate Token
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
