import React, { useState } from 'react';
import {
  Dialog, Box, Typography, TextField, Button, InputAdornment,
  IconButton, Chip, Alert, CircularProgress, Link
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import DirectionsTransitFilledIcon from '@mui/icons-material/DirectionsTransitFilled';
import CloseIcon from '@mui/icons-material/Close';
import { loginWithRole } from '../api';

export default function LoginModal({ open, onClose, onLoginSuccess }) {
  const [role, setRole] = useState('CUSTOMER');
  const [username, setUsername] = useState('passenger@railways.gov.in');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRoleSelect = (newRole) => {
    setRole(newRole);
    if (newRole === 'STAFF') {
      setUsername('staff@railways.gov.in');
    } else if (newRole === 'ADMIN') {
      setUsername('admin@railways.gov.in');
    } else {
      setUsername('passenger@railways.gov.in');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const userId = role === 'STAFF' ? 99 : role === 'ADMIN' ? 999 : 1;
      const { user } = await loginWithRole(role, userId, username, password);
      onLoginSuccess(user);
      onClose();
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          backgroundColor: '#0b111e',
          border: '1px solid #1e293b',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)'
        }
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 520, position: 'relative' }}>
        {/* Close Button */}
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12, color: '#94a3b8', zIndex: 10, '&:hover': { color: '#fff' } }}
        >
          <CloseIcon />
        </IconButton>

        {/* Left Side: Dramatic Train Artwork */}
        <Box
          sx={{
            flex: 1.1,
            position: 'relative',
            background: 'url(/train-bg.jpg) center center/cover no-repeat',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            p: 4,
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'linear-gradient(to right, rgba(11,17,30,0.4) 0%, rgba(11,17,30,0.85) 100%)',
              zIndex: 1
            }
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 2 }}>
            <Typography
              variant="caption"
              sx={{
                letterSpacing: 3,
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.9)',
                textTransform: 'uppercase',
                display: 'block',
                mb: 0.5
              }}
            >
              RAILWAY MANAGEMENT SYSTEM
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'rgba(255, 255, 255, 0.6)', letterSpacing: 0.5 }}
            >
              Safe Journeys &bull; Better Tomorrows
            </Typography>
          </Box>
        </Box>

        {/* Right Side: Welcome Back Login Form */}
        <Box
          sx={{
            flex: 1,
            p: { xs: 3, sm: 5 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            backgroundColor: '#0b111e'
          }}
        >
          {/* Glowing Circular Train Icon */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Box
              sx={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                border: '2px solid rgba(255, 255, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(37, 99, 235, 0.35)',
                background: 'rgba(17, 26, 46, 0.6)'
              }}
            >
              <DirectionsTransitFilledIcon sx={{ fontSize: 36, color: '#f8fafc' }} />
            </Box>
          </Box>

          <Typography variant="h5" align="center" sx={{ fontWeight: 700, color: '#f8fafc', mb: 0.5 }}>
            Welcome Back
          </Typography>
          <Typography variant="body2" align="center" sx={{ color: '#94a3b8', mb: 3 }}>
            Login to your railway account
          </Typography>

          {/* Quick Role Selection */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 3 }}>
            {['CUSTOMER', 'STAFF', 'ADMIN'].map((r) => (
              <Chip
                key={r}
                label={r}
                clickable
                onClick={() => handleRoleSelect(r)}
                color={role === r ? 'primary' : 'default'}
                variant={role === r ? 'filled' : 'outlined'}
                size="small"
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  borderColor: role === r ? '#2563eb' : '#22324e',
                  color: role === r ? '#ffffff' : '#94a3b8'
                }}
              />
            ))}
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, py: 0.5, bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5' }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              placeholder="Username / Email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              size="small"
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlineIcon sx={{ color: '#64748b', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              placeholder="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              size="small"
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon sx={{ color: '#64748b', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                      sx={{ color: '#64748b' }}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                py: 1.3,
                fontSize: '1rem',
                fontWeight: 600,
                letterSpacing: 0.5,
                mb: 2
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Login'}
            </Button>
          </form>

          <Box sx={{ textAlign: 'center' }}>
            <Link
              href="#"
              onClick={(e) => { e.preventDefault(); alert('Password recovery: Demo mode active. Any password works.'); }}
              sx={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'none', '&:hover': { color: '#94a3b8' } }}
            >
              Forgot password?
            </Link>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}
