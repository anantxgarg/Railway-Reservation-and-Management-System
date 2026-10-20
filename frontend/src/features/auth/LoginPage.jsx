import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Alert,
  CircularProgress, Chip, InputAdornment, IconButton
} from '@mui/material';
import DirectionsTransitFilledIcon from '@mui/icons-material/DirectionsTransitFilled';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { login } from '../../api';

// Minimal login against Team 1's POST /api/auth/login, built by Team 3 so the
// booking screens have a token. Team 1 owns accounts; replace this with their
// login screen (registration, password reset, ...) when it exists.

// Seeded by database/c1-identity, development only.
const DEV_ACCOUNTS = ['customer@example.com', 'staff@example.com', 'admin@example.com'];
const DEV_PASSWORD = 'Railway@Dev123';

export default function LoginPage({ onLogin, notice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      onLogin(await login(email.trim(), password));
    } catch (err) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background: 'linear-gradient(rgba(11,17,30,0.75), rgba(11,17,30,0.92)), url(/train-bg.jpg) center/cover no-repeat',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 400 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <DirectionsTransitFilledIcon sx={{ fontSize: 40, color: 'primary.light' }} />
            <Typography variant="h5" sx={{ mt: 1 }}>Railway Reservation</Typography>
            <Typography variant="body2" color="text.secondary">Log in to book and manage tickets</Typography>
          </Box>

          {notice && !error && <Alert severity="info" sx={{ mb: 2 }}>{notice}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ mb: 3 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button fullWidth type="submit" variant="contained" size="large" disabled={loading}>
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Log in'}
            </Button>
          </form>

          {import.meta.env.DEV && (
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Development accounts
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                {DEV_ACCOUNTS.map((account) => (
                  <Chip
                    key={account}
                    label={account.split('@')[0]}
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setEmail(account);
                      setPassword(DEV_PASSWORD);
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
