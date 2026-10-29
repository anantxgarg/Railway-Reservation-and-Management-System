/**
 * DEMO MODE ONLY: stand-ins for other teams' services, so Team 3 can be
 * demonstrated on its own (only PostgreSQL and this service running).
 *
 * <ul>
 *   <li>{@link com.railway.booking.demo.DemoAuthController}: stands in for Team 1's
 *       login backend ({@code backend/}, Node + MongoDB). Same endpoints and JSON as
 *       Team 1's /api/auth/login, /refresh, /logout and /me, checked against the
 *       C1 {@code users} table.</li>
 *   <li>{@link com.railway.booking.demo.DemoPaymentController}: stands in for Team 4's
 *       payment (Razorpay). {@code POST /api/bookings/{pnr}/demo-pay} confirms a held
 *       booking without taking any money.</li>
 * </ul>
 *
 * Everything here exists only when {@code booking.demo.enabled=true} (environment
 * variable {@code BOOKING_DEMO=true}). It is off by default, and with it off the
 * service behaves exactly as in the integrated system. Never turn it on next to
 * the real Team 1 and Team 4 services.
 */
package com.railway.booking.demo;
