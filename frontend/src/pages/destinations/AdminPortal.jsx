import { useState } from 'react';
import { Alert, Box, Button, Chip, TextField, Typography } from '@mui/material';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import ChangePasswordCard from '../../components/ChangePasswordCard';
import { DetailGrid, DetailItem, GlassSection, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/useAuth';
import { adminService } from '../../services/adminService';

function parseUserId(raw) {
  const trimmed = String(raw).trim();
  if (!/^\d+$/.test(trimmed) || Number(trimmed) <= 0) return null;
  return trimmed;
}

/** Look up a user by ID — GET /api/users/:userId (ADMIN allowed by backend). */
function UserLookupCard() {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setAlert(null);
    setResult(null);
    const id = parseUserId(userId);
    if (!id) {
      setError('Enter a valid numeric user ID');
      return;
    }
    setError('');
    setBusy(true);
    try {
      setResult(await adminService.getUser(id));
    } catch (err) {
      setAlert({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassSection
      title="User Lookup"
      subtitle="View an account's role and status by user ID."
      icon={<PersonSearchOutlinedIcon />}
      sx={{ mb: 0, height: '100%' }}
    >
      {alert && (
        <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>{alert.text}</Alert>
      )}
      <Box component="form" onSubmit={submit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          id="lookup-user-id"
          label="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={busy}
          error={Boolean(error)}
          helperText={error || undefined}
          fullWidth
          slotProps={{
            htmlInput: { inputMode: 'numeric', 'aria-invalid': Boolean(error) },
            formHelperText: { role: error ? 'alert' : undefined },
          }}
        />
        <Box>
          <Button type="submit" variant="contained" disabled={busy} id="lookup-submit">
            {busy ? 'Searching...' : 'Look Up'}
          </Button>
        </Box>
      </Box>
      {result && (
        <Box id="lookup-result" sx={{ mt: 2.5 }}>
          <DetailGrid columns={{ xs: 1, sm: 2 }}>
            <DetailItem label="Name">{result.name}</DetailItem>
            <DetailItem label="Email">{result.email}</DetailItem>
            <DetailItem label="Role"><Chip size="small" label={result.role} /></DetailItem>
            <DetailItem label="Status"><Chip size="small" color="success" label={result.status} /></DetailItem>
          </DetailGrid>
        </Box>
      )}
    </GlassSection>
  );
}

/** Unlock a LOCKED account — POST /api/admin/users/:userId/unlock (MANAGE_USERS). */
function UnlockAccountCard() {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setAlert(null);
    const id = parseUserId(userId);
    if (!id) {
      setError('Enter a valid numeric user ID');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await adminService.unlockUser(id);
      setAlert({ type: 'success', text: `Account #${id} unlocked.` });
      setUserId('');
    } catch (err) {
      setAlert({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassSection
      title="Unlock Account"
      subtitle="Restore a locked account (locked after too many failed logins)."
      icon={<LockOpenOutlinedIcon />}
      sx={{ mb: 0, height: '100%' }}
    >
      {alert && (
        <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>{alert.text}</Alert>
      )}
      <Box component="form" onSubmit={submit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          id="unlock-user-id"
          label="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={busy}
          error={Boolean(error)}
          helperText={error || undefined}
          fullWidth
          slotProps={{
            htmlInput: { inputMode: 'numeric', 'aria-invalid': Boolean(error) },
            formHelperText: { role: error ? 'alert' : undefined },
          }}
        />
        <Box>
          <Button type="submit" variant="contained" disabled={busy} id="unlock-submit">
            {busy ? 'Unlocking...' : 'Unlock Account'}
          </Button>
        </Box>
      </Box>
    </GlassSection>
  );
}

/** Admin page: profile, the user lookup / unlock tools, password change, sign out. */
export default function AdminPortal() {
  const { user, logoutUser } = useAuth();

  return (
    <Box component="section">
      <PageHeader
        tag="Administration"
        title="Admin dashboard"
        subtitle="Identity & access administration"
      />

      <GlassSection>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 3, minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 72, height: 72, flexShrink: 0, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.9rem', fontWeight: 800,
              color: (t) => t.palette.warning.contrastText,
              bgcolor: 'warning.main',
            }}
          >
            {user?.name ? user.name[0].toUpperCase() : 'A'}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="h2" sx={{ wordBreak: 'break-word' }}>
              {user?.name || 'System Administrator'}
            </Typography>
            <Typography color="text.secondary" sx={{ wordBreak: 'break-word' }}>{user?.email}</Typography>
          </Box>
        </Box>

        <DetailGrid columns={{ xs: 2, sm: 3 }}>
          <DetailItem label="Role"><Chip size="small" color="warning" label={user?.role} /></DetailItem>
          <DetailItem label="Status"><Chip size="small" color="success" label={user?.status || 'ACTIVE'} /></DetailItem>
          <DetailItem label="Admin ID" mono>#{user?.userId}</DetailItem>
        </DetailGrid>
      </GlassSection>

      <Box
        sx={{
          display: 'grid', gap: 3, mb: 3,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        <UserLookupCard />
        <UnlockAccountCard />
      </Box>

      <ChangePasswordCard />

      <GlassSection
        title="Coming soon"
        subtitle="These admin tools are planned but not available yet."
        icon={<ConstructionOutlinedIcon />}
      >
        <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.75, color: 'text.secondary' }}>
          <li>Listing / searching all users</li>
          <li>Suspending, deactivating or reactivating accounts</li>
          <li>Creating staff accounts or changing roles</li>
          <li>Viewing the audit log (VIEW_AUDIT_LOG)</li>
        </Box>
      </GlassSection>

      <Button variant="contained" color="error" startIcon={<LogoutIcon />} onClick={logoutUser} id="admin-signout">
        Sign Out
      </Button>
    </Box>
  );
}
