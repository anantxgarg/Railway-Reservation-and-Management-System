import { useEffect, useState } from 'react';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
export const rupees = (amount) => (amount == null ? '–' : inr.format(Number(amount)));

// Dates from the API are plain ISO dates (2026-11-02): format them without a
// time zone so they never shift by a day.
export const formatDate = (isoDate) => {
  if (!isoDate) return '–';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
};

export const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN') : '–');

/** Today's date (local) as yyyy-mm-dd, plus `days`. */
export const isoDate = (days = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const BOOKING_STATUS_COLOR = {
  HELD: 'warning', CONFIRMED: 'success', CANCELLED: 'default', EXPIRED: 'default',
};

export const PASSENGER_STATUS_COLOR = {
  CONFIRMED: 'success', RAC: 'info', WAITLIST: 'warning', CANCELLED: 'default',
};

export const GENDERS = [
  { value: 'F', label: 'Female' },
  { value: 'M', label: 'Male' },
  { value: 'O', label: 'Other' },
];

/** What a new booking of this class would get right now: AVL 12, RAC 3 or WL 4. */
export const availabilityLabel = (c) => {
  if (c.availableSeats > 0) return { text: `AVL ${c.availableSeats}`, color: 'success' };
  if (c.racAvailable > 0) return { text: `RAC ${c.racCapacity - c.racAvailable + 1}`, color: 'info' };
  return { text: `WL ${c.waitlistCount + 1}`, color: 'warning' };
};

/** Milliseconds left until `expiresAt` (ISO), ticking every second; null without a deadline. */
export function useCountdown(expiresAt) {
  const deadline = expiresAt ? new Date(expiresAt).getTime() : null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (deadline == null) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return deadline == null ? null : Math.max(0, deadline - now);
}

export const mmss = (ms) => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
