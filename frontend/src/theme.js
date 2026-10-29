import { createTheme, alpha } from '@mui/material/styles';

/**
 * Material UI theme of the logged-in app (AppShell), in light and dark.
 *
 * The look follows Team 1's login page: navy and white in light mode, deep
 * slate with a blue gradient and cyan accent in dark mode, frosted-glass
 * cards over the railway photo, Plus Jakarta Sans. The values are copied
 * from index.css rather than read from it, so the login pages and the app
 * can change independently.
 *
 * Extra values for the app's own components are under `theme.app`.
 */

const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

const TOKENS = {
  light: {
    accent: '#0B1B3D', // navy: headings, active tab, icon tiles
    accentHover: '#162B56',
    highlight: '#2563EB', // blue: links and small highlights
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    divider: '#E2E8F0',
    paper: '#FFFFFF',
    canvas: '#0B1B3D',
    glass: 'rgba(255, 255, 255, 0.9)',
    glassOverlay: 'rgba(255, 255, 255, 0.94)',
    glassNested: 'rgba(248, 250, 252, 0.75)',
    glassBorder: '1px solid rgba(255, 255, 255, 0.9)',
    glassShadow: '0 8px 32px rgba(11, 27, 61, 0.18)',
    glassShadowHover: '0 16px 40px rgba(11, 27, 61, 0.26)',
    inputBg: 'rgba(255, 255, 255, 0.9)',
    inputBorder: '#E2E8F0',
    focusRing: 'rgba(11, 27, 61, 0.14)',
    buttonBg: '#0B1B3D',
    buttonHover: '#162B56',
    buttonShadow: '0 4px 14px rgba(11, 27, 61, 0.22)',
    buttonShadowHover: '0 6px 18px rgba(11, 27, 61, 0.32)',
  },
  dark: {
    accent: '#38BDF8',
    accentHover: '#7DD3FC',
    highlight: '#38BDF8',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    divider: 'rgba(255, 255, 255, 0.12)',
    paper: '#0F172A',
    canvas: '#080C14',
    glass: 'rgba(15, 23, 42, 0.8)',
    glassOverlay: 'rgba(15, 23, 42, 0.94)',
    glassNested: 'rgba(30, 41, 59, 0.5)',
    glassBorder: '1px solid rgba(255, 255, 255, 0.12)',
    glassShadow: '0 20px 50px rgba(0, 0, 0, 0.55), 0 0 24px rgba(56, 189, 248, 0.1)',
    glassShadowHover: '0 24px 56px rgba(0, 0, 0, 0.6), 0 0 28px rgba(56, 189, 248, 0.28)',
    inputBg: 'rgba(30, 41, 59, 0.65)',
    inputBorder: 'rgba(255, 255, 255, 0.12)',
    focusRing: 'rgba(56, 189, 248, 0.35)',
    buttonBg: 'linear-gradient(135deg, #1D4ED8, #2563EB)',
    buttonHover: 'linear-gradient(135deg, #2563EB, #3B82F6)',
    buttonShadow: '0 4px 16px rgba(29, 78, 216, 0.45)',
    buttonShadowHover: '0 6px 22px rgba(56, 189, 248, 0.4)',
  },
};

// Tinted alerts, as on the login page: soft background, border, dark text
const ALERTS = {
  light: {
    error: { bg: '#FEF2F2', border: '#FECACA', color: '#991B1B' },
    success: { bg: '#F0FDF4', border: '#BBF7D0', color: '#166534' },
    info: { bg: '#F0F9FF', border: '#BAE6FD', color: '#075985' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E' },
  },
  dark: {
    error: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)', color: '#FCA5A5' },
    success: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)', color: '#6EE7B7' },
    info: { bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.35)', color: '#7DD3FC' },
    warning: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)', color: '#FCD34D' },
  },
};

export function getMuiTheme(mode = 'light') {
  const t = TOKENS[mode];
  const dark = mode === 'dark';

  const glassOverlayPaper = {
    backgroundColor: t.glassOverlay,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: t.glassBorder,
    boxShadow: t.glassShadow,
  };

  return createTheme({
    app: { ...t, mode, mono: MONO, alerts: ALERTS[mode] },
    palette: {
      mode,
      primary: dark
        ? { main: '#2563EB', light: '#3B82F6', dark: '#1D4ED8', contrastText: '#FFFFFF' }
        : { main: '#0B1B3D', light: '#162B56', dark: '#060F24', contrastText: '#FFFFFF' },
      secondary: dark
        ? { main: '#38BDF8', light: '#7DD3FC', dark: '#0284C7', contrastText: '#0B1120' }
        : { main: '#2563EB', light: '#3B82F6', dark: '#1D4ED8', contrastText: '#FFFFFF' },
      success: { main: dark ? '#10B981' : '#059669' },
      warning: { main: dark ? '#F59E0B' : '#D97706' },
      error: { main: dark ? '#EF4444' : '#DC2626' },
      info: { main: dark ? '#38BDF8' : '#0284C7' },
      background: { default: t.canvas, paper: t.paper },
      text: { primary: t.textPrimary, secondary: t.textSecondary },
      divider: t.divider,
    },
    typography: {
      fontFamily: FONT,
      h1: { fontWeight: 800, letterSpacing: '-0.02em' },
      h2: { fontWeight: 800, letterSpacing: '-0.02em' },
      h3: { fontWeight: 800, letterSpacing: '-0.02em' },
      h4: { fontWeight: 800, letterSpacing: '-0.02em', fontSize: '2rem' },
      h5: { fontWeight: 800, letterSpacing: '-0.02em', fontSize: '1.4rem' },
      h6: { fontWeight: 700, letterSpacing: '-0.01em', fontSize: '1.1rem' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 700 },
      button: { fontWeight: 700, textTransform: 'none' },
      overline: { fontWeight: 700, letterSpacing: '0.08em' },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: t.canvas, color: t.textPrimary },
        },
      },
      // index.css styles bare <p> and <h1>…<h6>; let MUI text follow its parent instead
      MuiTypography: {
        styleOverrides: { root: { color: 'inherit' } },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { backgroundColor: t.glassNested, borderColor: t.divider },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: t.glass,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: t.glassBorder,
            boxShadow: t.glassShadow,
            borderRadius: 16,
            // Cards inside cards: a flat tint, no second blur (blur is costly)
            '& .MuiCard-root': {
              backgroundColor: t.glassNested,
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              border: `1px solid ${t.divider}`,
              boxShadow: 'none',
              borderRadius: 12,
            },
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: { padding: 24, '&:last-child': { paddingBottom: 24 } },
        },
      },
      MuiButtonBase: {
        styleOverrides: { root: { '&:hover': { textDecoration: 'none' } } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 10,
            fontWeight: 700,
            textTransform: 'none',
            transition: 'all 0.2s ease',
            '&:hover': { textDecoration: 'none' },
          },
          sizeMedium: { padding: '9px 20px' },
          sizeLarge: { padding: '12px 24px', fontSize: '0.96rem', minHeight: 48 },
          containedPrimary: {
            background: t.buttonBg,
            color: '#FFFFFF',
            boxShadow: t.buttonShadow,
            '&:hover': {
              background: t.buttonHover,
              boxShadow: t.buttonShadowHover,
              transform: 'translateY(-1px)',
            },
            '&.Mui-disabled': {
              background: t.buttonBg,
              color: '#FFFFFF',
              opacity: 0.55,
            },
          },
          outlined: { borderWidth: 1.5, '&:hover': { borderWidth: 1.5 } },
          outlinedPrimary: dark
            ? { color: '#E2E8F0', borderColor: 'rgba(255, 255, 255, 0.22)', '&:hover': { borderColor: '#38BDF8', color: '#38BDF8', backgroundColor: 'rgba(56, 189, 248, 0.08)' } }
            : { borderColor: '#0B1B3D', '&:hover': { backgroundColor: '#0B1B3D', color: '#FFFFFF' } },
          textPrimary: dark ? { color: '#38BDF8' } : {},
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { '&:hover': { backgroundColor: alpha(t.accent, 0.08), color: t.accent } },
        },
      },
      MuiLink: {
        styleOverrides: { root: { color: t.highlight, fontWeight: 600 } },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            '&.Mui-focused': { color: t.accent },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: t.inputBg,
            borderRadius: 10,
            transition: 'box-shadow 0.18s ease, background-color 0.18s ease',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: t.inputBorder },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(t.accent, 0.5) },
            '&.Mui-focused': {
              backgroundColor: dark ? 'rgba(30, 41, 59, 0.85)' : '#FFFFFF',
              boxShadow: `0 0 0 3px ${t.focusRing}`,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: t.accent, borderWidth: 1 },
            '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#EF4444' },
          },
          input: {
            '&::placeholder': { color: t.textSecondary, opacity: 1 },
            // the native date picker icon is black on dark backgrounds
            '&::-webkit-calendar-picker-indicator': { filter: dark ? 'invert(0.8)' : 'none' },
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: { root: { marginLeft: 2, fontWeight: 500 } },
      },
      MuiChip: {
        styleOverrides: {
          root: ({ ownerState, theme }) => {
            const filled = ownerState.variant !== 'outlined';
            const color = ownerState.color && ownerState.color !== 'default'
              ? theme.palette[ownerState.color]
              : null;
            const tint = color
              ? {
                  backgroundColor: alpha(color.main, dark ? 0.16 : 0.1),
                  color: dark ? color.light : color.dark,
                  border: `1px solid ${alpha(color.main, dark ? 0.4 : 0.3)}`,
                }
              : {
                  backgroundColor: alpha(t.textPrimary, 0.07),
                  color: t.textPrimary,
                  border: `1px solid ${alpha(t.textPrimary, 0.12)}`,
                };
            return {
              fontWeight: 700,
              borderRadius: 9999,
              ...(filled ? tint : {}),
              ...(ownerState.size === 'small' ? { fontSize: '0.72rem', letterSpacing: '0.04em' } : {}),
              ...(filled && ownerState.clickable ? { '&:hover': { backgroundColor: color ? alpha(color.main, dark ? 0.26 : 0.18) : alpha(t.textPrimary, 0.12) } } : {}),
            };
          },
          icon: { color: 'inherit' },
          deleteIcon: { color: 'inherit', opacity: 0.6, '&:hover': { color: 'inherit', opacity: 1 } },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: ({ ownerState }) => {
            const a = ALERTS[mode][ownerState.severity || 'success'];
            if (ownerState.variant && ownerState.variant !== 'standard') return { borderRadius: 10 };
            return {
              borderRadius: 10,
              backgroundColor: a.bg,
              border: `1px solid ${a.border}`,
              color: a.color,
              fontWeight: 500,
              '& .MuiAlert-icon': { color: a.color },
            };
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: { root: { borderRadius: 16 } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${t.divider}` },
          head: {
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: t.textSecondary,
            backgroundColor: alpha(t.textPrimary, dark ? 0.04 : 0.03),
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&.MuiTableRow-hover:hover': { backgroundColor: alpha(t.accent, dark ? 0.06 : 0.04) },
            '&:last-child td': { borderBottom: 0 },
          },
        },
      },
      MuiTab: {
        styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: t.divider } },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { ...glassOverlayPaper, borderRadius: 16 },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { fontWeight: 800, letterSpacing: '-0.02em' } },
      },
      MuiPopover: {
        styleOverrides: { paper: { ...glassOverlayPaper, borderRadius: 12 } },
      },
      MuiMenu: {
        styleOverrides: { paper: { ...glassOverlayPaper, borderRadius: 12 } },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: { ...glassOverlayPaper, borderRadius: 12, marginTop: 4 },
          option: {
            borderRadius: 8,
            margin: '2px 6px',
            '&.Mui-focused': { backgroundColor: `${alpha(t.accent, 0.08)} !important` },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: dark ? '#1E293B' : '#0B1B3D',
            fontSize: '0.78rem',
            fontWeight: 600,
            borderRadius: 8,
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: { root: { borderRadius: 9999 } },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            '&.Mui-selected': {
              backgroundColor: alpha(t.accent, dark ? 0.16 : 0.1),
              color: t.accent,
            },
          },
        },
      },
    },
  });
}

export default getMuiTheme('dark');
