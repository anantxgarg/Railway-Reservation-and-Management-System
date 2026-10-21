import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { navigate } from '../../router';

/** #/pnr: enter a PNR to see its status. Customers can only open their own. */
export default function PnrLookup() {
  const [pnr, setPnr] = useState('');
  return (
    <Box sx={{ maxWidth: 480, mx: 'auto' }}>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" component="h1" gutterBottom>PNR status</Typography>
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
              sx={{ mb: 2 }}
            />
            <Button fullWidth type="submit" variant="contained" size="large" startIcon={<SearchIcon />}>
              Check status
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
