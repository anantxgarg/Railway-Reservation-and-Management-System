import React from 'react';
import { Box, Card, CardContent, CircularProgress, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

/**
 * Building blocks for the logged-in app's screens, so every screen has the
 * same look (theme.js, styles/app.css). They read `theme.app` for the values
 * that aren't in MUI's palette.
 */

/**
 * Title of a screen, sitting on the photo above its cards: a pill tag, the
 * title and a line of description, with optional buttons on the right.
 * White text with a shadow, readable on the dimmed photo in both themes.
 */
export function PageHeader({ tag, title, subtitle, actions, sx }) {
  return (
    <Box
      component="header"
      sx={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 2, mb: 3, ...sx,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        {tag && (
          <Box
            component="span"
            sx={{
              display: 'inline-block', px: 1.75, py: 0.6, mb: 1.5, borderRadius: 9999,
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: '#FFFFFF', bgcolor: 'rgba(255, 255, 255, 0.18)', border: '1px solid rgba(255, 255, 255, 0.38)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              textShadow: '0 1px 6px rgba(11, 27, 61, 0.6)',
            }}
          >
            {tag}
          </Box>
        )}
        <Typography
          variant="h4"
          component="h1"
          sx={{
            color: '#FFFFFF', textShadow: '0 2px 14px rgba(11, 27, 61, 0.7)',
            fontSize: { xs: '1.6rem', sm: '2rem' }, lineHeight: 1.2,
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            sx={{
              mt: 0.75, maxWidth: 680, color: '#E2E8F0', fontSize: '0.98rem',
              textShadow: '0 1px 8px rgba(11, 27, 61, 0.6)',
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', ...ON_PHOTO_BUTTONS }}>{actions}</Box>}
    </Box>
  );
}

// Buttons in a PageHeader sit on the photo, not on a card: outlined and text
// buttons turn white, and disabled ones stay legible.
const ON_PHOTO_BUTTONS = {
  '& .MuiButton-outlined, & .MuiButton-text': {
    color: '#FFFFFF',
    borderColor: 'rgba(255, 255, 255, 0.55)',
    textShadow: '0 1px 6px rgba(11, 27, 61, 0.5)',
    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.12)', borderColor: '#FFFFFF', color: '#FFFFFF' },
  },
  '& .MuiButton-root.Mui-disabled': {
    background: 'rgba(255, 255, 255, 0.14)',
    color: 'rgba(255, 255, 255, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    boxShadow: 'none',
    opacity: 1,
  },
};

/**
 * A glass card with an optional header (icon tile, title, subtitle, buttons).
 * `interactive` lifts it on hover, for cards that are links or buttons.
 * `padding` is the content padding in theme units (default 3 = 24px); 0 for
 * tables that run to the card's edge.
 */
export function GlassSection({ title, subtitle, icon, actions, interactive, padding = 3, children, sx, contentSx, ...rest }) {
  return (
    <Card
      sx={{
        mb: 3,
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        ...(interactive && {
          cursor: 'pointer',
          '&:hover': { transform: 'translateY(-3px)', boxShadow: (t) => t.app.glassShadowHover },
        }),
        ...sx,
      }}
      {...rest}
    >
      {(title || actions) && (
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
            px: 3, pt: 2.75, pb: padding === 0 ? 2.25 : 0,
          }}
        >
          {icon && <IconTile size={42}>{icon}</IconTile>}
          <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
            {title && <Typography variant="h6" component="h2">{title}</Typography>}
            {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>}
          </Box>
          {actions && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{actions}</Box>}
        </Box>
      )}
      <CardContent sx={{ p: padding, '&:last-child': { pb: padding }, ...contentSx }}>
        {children}
      </CardContent>
    </Card>
  );
}

/** The rounded tinted square an icon sits in, as on the login page's cards. */
export function IconTile({ children, size = 48, color, sx }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        width: size, height: size, borderRadius: '10px',
        color: (t) => (color ? t.palette[color].main : t.app.accent),
        bgcolor: (t) => alpha(color ? t.palette[color].main : t.app.accent, t.app.mode === 'dark' ? 0.14 : 0.08),
        border: (t) => `1px solid ${alpha(color ? t.palette[color].main : t.app.accent, 0.16)}`,
        '& svg': { fontSize: size * 0.5 },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/** Shown where a list has nothing in it: an icon, a line or two, and a button. */
export function EmptyState({ icon, title, text, action, sx }) {
  return (
    <GlassSection sx={sx}>
      <Box sx={{ textAlign: 'center', py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {icon && <IconTile size={56} sx={{ mb: 2 }}>{icon}</IconTile>}
        {title && <Typography variant="h6" component="p" gutterBottom>{title}</Typography>}
        {text && <Typography color="text.secondary" sx={{ maxWidth: 440, mb: action ? 2.5 : 0 }}>{text}</Typography>}
        {action}
      </Box>
    </GlassSection>
  );
}

/** A spinner on a small glass card, for while a screen loads. */
export function LoadingCard({ text = 'Loading…', sx }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, ...sx }}>
      <Card sx={{ px: 6, py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={40} thickness={4} sx={{ color: (t) => t.app.accent }} />
        <Typography sx={{ fontWeight: 700, color: (t) => t.app.accent }}>{text}</Typography>
      </Card>
    </Box>
  );
}

/** A small rounded pill for a fact: "1,432 km", "3 passengers", "₹ 1,250". */
export function StatPill({ icon, label, children, color, sx }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5,
        borderRadius: 9999, fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap',
        color: (t) => (color ? t.palette[color][t.app.mode === 'dark' ? 'light' : 'dark'] : t.app.accent),
        bgcolor: (t) => alpha(color ? t.palette[color].main : t.app.accent, t.app.mode === 'dark' ? 0.12 : 0.06),
        border: (t) => `1px solid ${alpha(color ? t.palette[color].main : t.app.accent, t.app.mode === 'dark' ? 0.3 : 0.16)}`,
        '& svg': { fontSize: '1rem' },
        ...sx,
      }}
    >
      {icon}
      {label && <Box component="span" sx={{ fontWeight: 600, opacity: 0.75 }}>{label}</Box>}
      {children}
    </Box>
  );
}

/** A grid of small label/value pairs, e.g. the details of a booking. */
export function DetailGrid({ children, columns = { xs: 2, sm: 3, md: 4 }, sx, ...rest }) {
  const cols = typeof columns === 'number' ? { xs: columns } : columns;
  return (
    <Box
      {...rest}
      sx={{
        display: 'grid', gap: 2, p: 2, borderRadius: '12px',
        gridTemplateColumns: Object.fromEntries(Object.entries(cols).map(([bp, n]) => [bp, `repeat(${n}, minmax(0, 1fr))`])),
        bgcolor: (t) => t.app.glassNested,
        border: (t) => `1px solid ${t.app.divider}`,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function DetailItem({ label, children, mono }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        component="div"
        sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'text.secondary', mb: 0.4 }}
      >
        {label}
      </Typography>
      <Typography
        component="div"
        sx={{ fontWeight: 700, fontSize: '0.92rem', wordBreak: 'break-word', ...(mono && { fontFamily: (t) => t.app.mono }) }}
      >
        {children}
      </Typography>
    </Box>
  );
}

/** Monospace text for codes: PNRs, transaction ids, train numbers. */
export function Mono({ children, sx }) {
  return (
    <Box component="span" sx={{ fontFamily: (t) => t.app.mono, fontWeight: 700, letterSpacing: '0.02em', ...sx }}>
      {children}
    </Box>
  );
}
