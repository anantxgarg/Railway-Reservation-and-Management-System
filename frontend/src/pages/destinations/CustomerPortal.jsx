import { Box, Button, Chip, Typography } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import ChangePasswordCard from '../../components/ChangePasswordCard';
import { DetailGrid, DetailItem, GlassSection, Mono, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/useAuth';

const PERMISSIONS = [
  { code: 'BOOK_TICKET', text: 'Self-service passenger ticket reservations.' },
  { code: 'VIEW_OWN_BOOKING', text: 'Access to personal reservation history.' },
  { code: 'CANCEL_OWN_BOOKING', text: 'Self-service reservation cancellation.' },
];

/** Account page of a passenger: profile, password change, what the role allows, sign out. */
export default function CustomerPortal() {
  const { user, logoutUser } = useAuth();

  return (
    <Box component="section">
      <PageHeader
        tag="Account"
        title="Your account"
        subtitle="Welcome to your passenger self-service gateway"
      />

      <GlassSection>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 3, minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 72, height: 72, flexShrink: 0, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.9rem', fontWeight: 800,
              color: (t) => t.palette.getContrastText(t.app.accent),
              bgcolor: (t) => t.app.accent,
            }}
          >
            {user?.name ? user.name[0].toUpperCase() : 'C'}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="h2" sx={{ wordBreak: 'break-word' }}>
              {user?.name || 'Valued Passenger'}
            </Typography>
            <Typography color="text.secondary" sx={{ wordBreak: 'break-word' }}>{user?.email}</Typography>
          </Box>
        </Box>

        <DetailGrid columns={{ xs: 2, sm: 4 }}>
          <DetailItem label="Role"><Chip size="small" label="CUSTOMER" /></DetailItem>
          <DetailItem label="Status"><Chip size="small" color="success" label={user?.status || 'ACTIVE'} /></DetailItem>
          {user?.phone && <DetailItem label="Phone">{user.phone}</DetailItem>}
          <DetailItem label="User ID" mono>#{user?.userId || 'N/A'}</DetailItem>
        </DetailGrid>
      </GlassSection>

      <ChangePasswordCard />

      <GlassSection
        title="What you can do"
        subtitle="You are signed in as a CUSTOMER. Your role includes these permissions:"
        icon={<VerifiedUserOutlinedIcon />}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {PERMISSIONS.map((p) => (
            <Box
              key={p.code}
              sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.25, alignItems: 'baseline' }}
            >
              <Mono sx={{ fontSize: '0.85rem', minWidth: 190 }}>{p.code}</Mono>
              <Typography color="text.secondary" sx={{ fontSize: '0.92rem' }}>{p.text}</Typography>
            </Box>
          ))}
        </Box>
      </GlassSection>

      <Button variant="contained" color="error" startIcon={<LogoutIcon />} onClick={logoutUser}>
        Sign Out
      </Button>
    </Box>
  );
}
