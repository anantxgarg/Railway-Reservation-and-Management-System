-- =====================================================================
-- C3 Booking — 00: extensions and enum types
-- Run after C1 identity (database/c1-identity/) and C2 network
-- (database/c2-network/), which owns train_type_enum and the network tables.
--
-- Identity enums (role_name_enum, user_status_enum) belong to C1 and
-- payment/refund enums belong to Team 4, so they are not created here.
-- =====================================================================

-- btree_gist: lets the seat_allocation exclusion constraint combine
-- equality on seat_id/run_id with overlap on the journey segment.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------
-- Quota (Team 3)
-- ---------------------------------------------------------------------
CREATE TYPE quota_name_enum AS ENUM (
    'General',
    'Tatkal',
    'Ladies',
    'Senior'
);

-- ---------------------------------------------------------------------
-- Booking (Team 3)
-- ---------------------------------------------------------------------

-- HELD: created, awaiting payment (seats held until hold_expires_at)
-- CONFIRMED: paid · CANCELLED: cancelled by user/staff · EXPIRED: hold lapsed
CREATE TYPE booking_status_enum AS ENUM (
    'HELD',
    'CONFIRMED',
    'CANCELLED',
    'EXPIRED'
);

-- CONFIRMED: has a seat_allocation row · RAC: shares a berth, no seat row
-- WAITLIST: queued, no seat · CANCELLED: removed from the booking
CREATE TYPE passenger_status_enum AS ENUM (
    'CONFIRMED',
    'RAC',
    'WAITLIST',
    'CANCELLED'
);
