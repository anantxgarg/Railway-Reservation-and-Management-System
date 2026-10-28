package com.railway.booking.notify;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Delivers Team 6's notifications. Every team writes them to the
 * notification_outbox table in the transaction of the change they describe
 * (database/c3-booking/08_notifications.sql); this job sends the unsent ones
 * to notification-service with Team 6's NotificationHandle and marks them
 * sent. When Team 6 is down or refuses one, it is tried again later, waiting
 * twice as long each time (2 s, 4 s, ... about an hour), up to 20 times.
 *
 * It also queues journey reminders: once per paid booking, when the train
 * leaves the boarding stop within booking.notifications.reminder-hours.
 *
 * Off with booking.notifications.enabled=false (e.g. in tests).
 */
@Component
@EnableScheduling
@ConditionalOnProperty(name = "booking.notifications.enabled", havingValue = "true", matchIfMissing = true)
public class NotificationOutboxJob {

    private static final Logger log = LoggerFactory.getLogger(NotificationOutboxJob.class);
    private static final ZoneId INDIA = ZoneId.of("Asia/Kolkata");

    private static final String DUE_SQL = """
            SELECT event_id, type, user_id, pnr, source_team, data::TEXT AS data, event_time
            FROM notification_outbox
            WHERE sent_at IS NULL AND attempts < 20
              AND (attempts = 0 OR clock_timestamp() > event_time + make_interval(secs => power(2, least(attempts, 12))))
            ORDER BY event_id
            LIMIT 50
            FOR UPDATE SKIP LOCKED""";

    private record Event(long id, String type, int userId, String pnr, String sourceTeam, String data,
                         OffsetDateTime eventTime) {
    }

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final ObjectMapper json;
    private final String url;
    private final String apiKey;
    private final int reminderHours;
    // one handle per sending team, so Team 6's log shows who the event came from
    private final Map<String, NotificationHandle> handles = new ConcurrentHashMap<>();

    public NotificationOutboxJob(JdbcTemplate jdbc, TransactionTemplate tx, ObjectMapper json,
                                 @Value("${booking.notifications.url}") String url,
                                 @Value("${booking.notifications.api-key:}") String apiKey,
                                 @Value("${booking.notifications.reminder-hours:24}") int reminderHours) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.json = json;
        this.url = url;
        this.apiKey = apiKey;
        this.reminderHours = reminderHours;
    }

    @Scheduled(fixedDelayString = "${booking.notifications.interval-ms:5000}")
    public void run() {
        try {
            Integer reminders = jdbc.queryForObject("SELECT queue_journey_reminders(make_interval(hours => ?))",
                    Integer.class, reminderHours);
            if (reminders != null && reminders > 0) {
                log.info("Queued {} journey reminder(s)", reminders);
            }
            Integer sent = tx.execute(status -> deliverDue());
            if (sent != null && sent > 0) {
                log.debug("Delivered {} notification(s) to Team 6", sent);
            }
        } catch (RuntimeException e) {
            log.error("Notification delivery failed; will retry next run", e);
        }
    }

    /** Sends the due events, in one transaction that keeps them locked; returns how many Team 6 accepted. */
    int deliverDue() {
        List<Event> due = jdbc.query(DUE_SQL, (rs, i) -> new Event(rs.getLong("event_id"), rs.getString("type"),
                rs.getInt("user_id"), rs.getString("pnr"), rs.getString("source_team"), rs.getString("data"),
                rs.getObject("event_time", OffsetDateTime.class)));
        int sent = 0;
        for (Event e : due) {
            String error;
            try {
                Map<String, Object> data = json.readValue(e.data(), new TypeReference<>() { });
                LocalDateTime when = e.eventTime().atZoneSameInstant(INDIA).toLocalDateTime();
                error = handle(e.sourceTeam()).sendRaw(e.type(), String.valueOf(e.userId()), e.pnr(), data, when);
            } catch (Exception ex) {
                error = ex.getMessage();
            }
            if (error == null) {
                jdbc.update("UPDATE notification_outbox SET sent_at = clock_timestamp(), last_error = NULL WHERE event_id = ?", e.id());
                sent++;
            } else {
                jdbc.update("UPDATE notification_outbox SET attempts = attempts + 1, last_error = left(?, 500) WHERE event_id = ?",
                        error, e.id());
                log.warn("Team 6 notification {} for PNR {} not delivered: {}", e.type(), e.pnr(), error);
            }
        }
        return sent;
    }

    private NotificationHandle handle(String sourceTeam) {
        return handles.computeIfAbsent(sourceTeam, team -> new NotificationHandle(url, team, apiKey));
    }
}
