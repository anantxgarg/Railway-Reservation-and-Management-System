package com.railway.team6.notification;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

/*
 * The repository is how we talk to the "notifications" collection in MongoDB.
 *
 * We only write an interface (no code inside the methods!). Spring Data reads each method's NAME
 * and writes the MongoDB query for us. For example:
 *
 *   findByUserIdOrderByCreatedAtDesc("u_123")
 *     -> db.notifications.find({ userId: "u_123" }).sort({ createdAt: -1 })
 *
 * By extending MongoRepository<Notification, String> we also get ready-made methods for free:
 *   save(...), saveAll(...), findById(...), findAll(...), deleteAll(), count(), ...
 * (<Notification, String> = "stores Notification objects whose id is a String".)
 */
public interface NotificationRepository extends MongoRepository<Notification, String> {

    // One user's notifications, newest first (what the bell icon dropdown shows).
    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);

    // How many of this user's notifications are still unread.
    // -> db.notifications.countDocuments({ userId: ..., read: false })
    long countByUserIdAndReadFalse(String userId);

    // All unread notifications of a user (used by "mark all as read").
    List<Notification> findByUserIdAndReadFalse(String userId);

    // The latest notification of one type for a user + PNR.
    // The feedback feature uses this to find the JOURNEY_COMPLETED notification for a journey.
    // Optional = "might be empty" (no such notification yet).
    Optional<Notification> findFirstByUserIdAndPnrAndTypeOrderByCreatedAtDesc(
            String userId, String pnr, NotificationType type);
}
