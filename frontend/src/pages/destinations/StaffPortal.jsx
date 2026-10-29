import { Box, Button, Chip, Typography } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import ChangePasswordCard from '../../components/ChangePasswordCard';
import { DetailGrid, DetailItem, GlassSection, Mono, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/useAuth';

const PERMISSIONS = [
  { code: 'VIEW_PASSENGER', text: 'Authorized to view passenger travel details and reservation manifests.' },
];

/** Account page of railway staff: profile, password change, what the role allows, sign out. */
export default function StaffPortal() {
  const { user, logoutUser } = useAuth();

  return (
    <Box component="section">
      <PageHeader
        tag="Account"
        title="Your account"
        subtitle="Operational identity gateway for authorized railway personnel"
      />

      <GlassSection>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 3, minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 72, height: 72, flexShrink: 0, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.9rem', fontWeight: 800,
              color: (t) => t.palette.success.contrastText,
              bgcolor: 'success.main',
            }}
          >
            {user?.name ? user.name[0].toUpperCase() : 'S'}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="h2" sx={{ wordBreak: 'break-word' }}>
              {user?.name || 'Railway Staff Member'}
            </Typography>
            <Typography color="text.secondary" sx={{ wordBreak: 'break-word' }}>{user?.email}</Typography>
          </Box>
        </Box>

        <DetailGrid columns={{ xs: 2, sm: 4 }}>
          <DetailItem label="Role"><Chip size="small" color="info" label="STAFF" /></DetailItem>
          <DetailItem label="Status"><Chip size="small" color="success" label={user?.status || 'ACTIVE'} /></DetailItem>
          <DetailItem label="Access Level">Staff Operations</DetailItem>
          <DetailItem label="Staff ID" mono>#{user?.userId || 'N/A'}</DetailItem>
        </DetailGrid>
      </GlassSection>

      <ChangePasswordCard />

      <GlassSection
        title="What you can do"
        subtitle="You are signed in as STAFF. Your role includes these permissions:"
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
