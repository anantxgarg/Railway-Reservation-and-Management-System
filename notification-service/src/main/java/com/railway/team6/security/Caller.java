package com.railway.team6.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

/*
 * Who is calling us, taken from their Team 1 login token (see JwtAuthFilter).
 *
 *   userId = Team 1's user id as text, e.g. "7". It is the "userId" we store on notifications.
 *   role   = CUSTOMER, STAFF or ADMIN.
 *
 * The controllers use it so a user can only see and change their own notifications
 * and feedback. Staff and admins may look at anyone's.
 */
public record Caller(String userId, String role) {

    public boolean isStaff() {
        return "STAFF".equals(role) || "ADMIN".equals(role);
    }

    // The caller of the current request, or null if they sent no token.
    public static Caller current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof Caller caller ? caller : null;
    }

    // Stops with 404 unless the caller is this user (or staff). 404, not 403, so nobody can find out
    // which user ids have notifications.
    public static void requireSelfOrStaff(String userId) {
        Caller caller = current();
        if (caller == null || !(caller.isStaff() || caller.userId().equals(userId))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Nothing found for user " + userId);
        }
    }
}
