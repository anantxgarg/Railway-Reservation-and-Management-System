import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Team 3 demo: the React app in front of booking-service alone. In development
// Vite forwards each /api path to it, so the browser only ever talks to one
// origin (no CORS) and the code uses plain relative URLs.
//
// /api/auth is served by booking-service's demo mode (BOOKING_DEMO=true), which
// answers like Team 1's auth API, so neither Team 1's backend nor Team 4's
// payments app is needed.
//
// Override the target when the service runs elsewhere, e.g.
//   BOOKING_URL=http://localhost:8092 npm run dev
const BOOKING_URL = process.env.BOOKING_URL || 'http://localhost:8082'; // Team 3, booking-service

const to = (target) => ({ target, changeOrigin: true });

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/auth': to(BOOKING_URL),
      '/api/search': to(BOOKING_URL),
      '/api/runs': to(BOOKING_URL),
      '/api/bookings': to(BOOKING_URL),
    },
  },
});
