package com.railway.booking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

/**
 * Booking, PNR and seats API (Team 3).
 *
 * The booking rules live in the database (database/c3-booking): this service
 * checks who is calling, calls the functions and views, and turns database
 * errors into HTTP errors. Logins are Team 1's; this service only verifies
 * their tokens.
 */
// No local users: authentication comes only from Team 1's JWT.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class BookingServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(BookingServiceApplication.class, args);
    }
}
