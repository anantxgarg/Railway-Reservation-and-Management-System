import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2563eb', // Vibrant Modern Blue (matching reference login button)
      light: '#3b82f6',
      dark: '#1d4ed8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#38bdf8', // Sleek Cyan accent
      light: '#7dd3fc',
      dark: '#0284c7',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0b111e', // Deep Obsidian Night (matches train image background)
      paper: '#111a2e',   // Dark card container
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
    },
    divider: '#1e293b',
  },
  typography: {
    fontFamily: '"Roboto", "Inter", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: '0.5px',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '0.25px',
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0b111e',
          color: '#f8fafc',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          padding: '10px 20px',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #1d68ed 0%, #2563eb 100%)',
          boxShadow: '0 4px 14px 0 rgba(29, 104, 237, 0.39)',
          '&:hover': {
            background: 'linear-gradient(135deg, #1855c4 0%, #1d4ed8 100%)',
            boxShadow: '0 6px 20px 0 rgba(29, 104, 237, 0.55)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#111a2e',
          borderRadius: 12,
          border: '1px solid #1e293b',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#0d1526',
          borderRadius: 8,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#22324e',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#3b82f6',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#2563eb',
            boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.25)',
          },
        },
        input: {
          color: '#f8fafc',
        },
      },
    },
  },
});

export default theme;
