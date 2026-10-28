package com.railway.team6.notification;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;

/*
 * One notification, exactly as it is stored in MongoDB.
 *
 * In MongoDB, data is stored as "documents" (JSON-like objects) inside "collections"
 * (like tables in PostgreSQL, but without a fixed set of columns).
 * Every Notification object we save becomes one document in the "notifications" collection.
 *
 * @CompoundIndex creates an index on (userId ascending, createdAt descending).
 * An index is like the index at the back of a book: MongoDB can jump straight to one
 * user's notifications, already sorted newest first, instead of reading every document.
 */
@Document(collection = "notifications")
@CompoundIndex(name = "user_newest_first", def = "{'userId': 1, 'createdAt': -1}")
public class Notification {

    // @Id = MongoDB's "_id" field. We leave it empty and MongoDB fills in a unique id when we save.
    @Id
    private String id;

    private String userId;          // who should see this notification
    private NotificationType type;  // stored as text, e.g. "BOOKING_CONFIRMED"
    private String pnr;
    private String sourceTeam;      // which team sent it (useful in the log)

    // title + message are built by us (NotificationController), so the frontend can just display them.
    private String title;
    private String message;

    // The raw "data" object the other team sent. A Map holds any key -> value pairs,
    // and MongoDB stores it as a nested object. We keep it so the frontend can use
    // the details later (e.g. the feedback form reads train name, coach, seat from here).
    private Map<String, Object> data;

    private boolean read;              // false until the user opens/clicks it (drives the blinking bell)
    private LocalDateTime eventTime;   // when the event happened, as told by the sending team
    private Instant createdAt;         // when WE received it; used for "order by newest first"

    // Below: getters and setters. Spring uses them to read/write fields when it
    // converts this object to JSON (for API responses) and to MongoDB documents.

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public NotificationType getType() { return type; }
    public void setType(NotificationType type) { this.type = type; }

    public String getPnr() { return pnr; }
    public void setPnr(String pnr) { this.pnr = pnr; }

    public String getSourceTeam() { return sourceTeam; }
    public void setSourceTeam(String sourceTeam) { this.sourceTeam = sourceTeam; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }

    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }

    public LocalDateTime getEventTime() { return eventTime; }
    public void setEventTime(LocalDateTime eventTime) { this.eventTime = eventTime; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
