import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// One React app in front of every backend. In development Vite forwards each
// /api path to the service that owns it, so the browser only ever talks to
// one origin (no CORS) and the code uses plain relative URLs.
//
// Override a target when a service runs elsewhere, e.g.
//   PAYMENTS_URL=http://localhost:8091 npm run dev
const AUTH_URL = process.env.AUTH_URL || 'http://localhost:3000';         // Team 1, users and auth
const BOOKING_URL = process.env.BOOKING_URL || 'http://localhost:8082';   // Team 3, booking-service
const PAYMENTS_URL = process.env.PAYMENTS_URL || 'http://localhost:8081'; // Team 4, payments app
const TRAIN_URL = process.env.TRAIN_URL || 'http://localhost:8083';       // Team 2, train-service
const NOTIFICATIONS_URL = process.env.NOTIFICATIONS_URL || 'http://localhost:8086'; // Team 6, notification-service

const to = (target) => ({ target, changeOrigin: true });

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Team 1's backend uses 3000 and allows CORS from 5173
    strictPort: true,
    proxy: {
      '/api/auth': to(AUTH_URL),
      '/api/users': to(AUTH_URL),
      '/api/admin': to(AUTH_URL),
      '/health': to(AUTH_URL),

      '/api/search': to(BOOKING_URL),
      '/api/runs': to(BOOKING_URL),
      '/api/bookings': to(BOOKING_URL),

      '/api/payments': to(PAYMENTS_URL),
      '/api/refunds': to(PAYMENTS_URL),
      '/api/concessions': to(PAYMENTS_URL),

      '/api/trains': to(TRAIN_URL),
      '/api/stations': to(TRAIN_URL),
      '/api/travel-classes': to(TRAIN_URL),
      '/api/coaches': to(TRAIN_URL),
      '/api/routes': to(TRAIN_URL),
      '/api/route-stations': to(TRAIN_URL),
      '/api/schedules': to(TRAIN_URL),
      '/api/live-status': to(TRAIN_URL),

      '/api/notifications': to(NOTIFICATIONS_URL),
      '/api/feedback': to(NOTIFICATIONS_URL),
      '/api/demo': to(NOTIFICATIONS_URL),
    },
  },
});
