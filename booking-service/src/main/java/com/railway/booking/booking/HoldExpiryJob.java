package com.railway.booking.booking;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Expires unpaid holds and hands their seats to the queue, every
 * booking.expire-holds.interval-ms (default one minute). Turn it off with
 * booking.expire-holds.enabled=false, e.g. in tests.
 */
@Component
@EnableScheduling
@ConditionalOnProperty(name = "booking.expire-holds.enabled", havingValue = "true", matchIfMissing = true)
public class HoldExpiryJob {

    private static final Logger log = LoggerFactory.getLogger(HoldExpiryJob.class);

    private final BookingRepository bookings;

    public HoldExpiryJob(BookingRepository bookings) {
        this.bookings = bookings;
    }

    @Scheduled(fixedDelayString = "${booking.expire-holds.interval-ms:60000}")
    public void run() {
        try {
            int expired = bookings.expireHolds();
            if (expired > 0) {
                log.info("Expired {} unpaid booking(s)", expired);
            }
        } catch (RuntimeException e) {
            log.error("expire_holds failed; will retry next run", e);
        }
    }
}
