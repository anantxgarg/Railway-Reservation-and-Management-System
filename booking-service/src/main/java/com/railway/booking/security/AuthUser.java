package com.railway.booking.security;

/**
 * The caller, from a verified Team 1 token. role is read from the database
 * on every request (as Team 1's authenticate middleware does), so a role
 * change takes effect before the token expires.
 */
public record AuthUser(int userId, String role) {

    public boolean isStaff() {
        return "STAFF".equals(role) || "ADMIN".equals(role);
    }
}
