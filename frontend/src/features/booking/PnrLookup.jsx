import React, { useState } from 'react';
import { Box, TextField, Button } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import { navigate } from '../../router';
import { GlassSection, PageHeader } from '../../components/ui';

/** #/pnr: enter a PNR to see its status. Customers can only open their own. */
export default function PnrLookup() {
  const [pnr, setPnr] = useState('');
  return (
    <Box sx={{ maxWidth: 480, mx: 'auto' }}>
      <PageHeader
        tag="PNR status"
        title="Check a PNR"
        subtitle="Enter the 10-digit PNR to see the booking and where each passenger stands."
      />
      <GlassSection title="Find a booking" icon={<ConfirmationNumberIcon />} contentSx={{ pt: 2.5 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/pnr/${encodeURIComponent(pnr.trim())}`);
          }}
        >
          <TextField
            fullWidth required autoFocus label="PNR" placeholder="10-digit PNR"
            value={pnr} onChange={(e) => setPnr(e.target.value.replace(/\D/g, ''))}
            inputProps={{ inputMode: 'numeric', maxLength: 10 }}
            sx={{ mb: 2.5 }}
          />
          <Button fullWidth type="submit" variant="contained" size="large" startIcon={<SearchIcon />}>
            Check status
          </Button>
        </form>
      </GlassSection>
    </Box>
  );
}
