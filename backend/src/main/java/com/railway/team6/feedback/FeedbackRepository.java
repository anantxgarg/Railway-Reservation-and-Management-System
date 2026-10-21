package com.railway.team6.feedback;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

/*
 * Talks to the "feedback" collection. Like NotificationRepository, Spring Data writes the
 * MongoDB queries from the method names.
 */
public interface FeedbackRepository extends MongoRepository<Feedback, String> {

    // -> db.feedback.countDocuments({ userId: ..., pnr: ... }) > 0
    boolean existsByUserIdAndPnr(String userId, String pnr);

    // Everything one user has submitted, newest first.
    List<Feedback> findByUserIdOrderBySubmittedAtDesc(String userId);

    // Everything from everyone, newest first (Staff / Admin view).
    List<Feedback> findAllByOrderBySubmittedAtDesc();
}
