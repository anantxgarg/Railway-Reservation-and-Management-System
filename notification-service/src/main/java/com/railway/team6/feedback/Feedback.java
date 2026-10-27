package com.railway.team6.feedback;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

/*
 * One submitted feedback, as stored in the MongoDB "feedback" collection.
 *
 * The index is "unique": MongoDB itself refuses a second document with the same (userId, pnr),
 * so each passenger can rate a journey only once, even if two requests arrive at the same moment.
 *
 * Example document in MongoDB:
 * {
 *   "_id": ObjectId("..."),
 *   "userId": "u_123",
 *   "pnr": "4567891234",
 *   "journey": { "trainNumber": "12301", "trainName": "Rajdhani Express", ... },
 *   "ratings": { "washroomCleanliness": 6, "foodQuality": 6, ... },
 *   "comment": "AC was too cold.",
 *   "submittedAt": ISODate("2026-10-21T09:00:00Z")
 * }
 */
@Document(collection = "feedback")
@CompoundIndex(name = "one_feedback_per_journey", def = "{'userId': 1, 'pnr': 1}", unique = true)
public class Feedback {

    @Id
    private String id;

    private String userId;
    private String pnr;

    // A copy of the journey details at the time of feedback, so reports still work
    // even if the notification is deleted later.
    private Map<String, Object> journey;

    private Ratings ratings;
    private String comment;
    private Instant submittedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getPnr() { return pnr; }
    public void setPnr(String pnr) { this.pnr = pnr; }

    public Map<String, Object> getJourney() { return journey; }
    public void setJourney(Map<String, Object> journey) { this.journey = journey; }

    public Ratings getRatings() { return ratings; }
    public void setRatings(Ratings ratings) { this.ratings = ratings; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public Instant getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Instant submittedAt) { this.submittedAt = submittedAt; }
}
