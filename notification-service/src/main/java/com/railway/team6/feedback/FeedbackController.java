package com.railway.team6.feedback;

import com.railway.team6.notification.Notification;
import com.railway.team6.notification.NotificationRepository;
import com.railway.team6.notification.NotificationType;
import jakarta.validation.Valid;
import org.bson.Document;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/*
 * REST API for the star-rating feedback system. All URLs start with /api/feedback.
 *
 *   GET  /api/feedback/form?userId=u_123&pnr=4567891234  -> journey details for the form's top card
 *   POST /api/feedback                                   -> submit the star ratings
 *   GET  /api/feedback/user/{userId}                     -> one user's past feedback
 *   GET  /api/feedback                                   -> all feedback (Staff/Admin)
 *   GET  /api/feedback/summary?trainNumber=12301         -> average per category (trainNumber optional)
 *
 * The flow from the work plan:
 *   Journey Completed -> notification in the app -> user taps it -> feedback form opens
 *
 *   1. Train status team sends a JOURNEY_COMPLETED notification (see NotificationHandle).
 *   2. Frontend shows it in the bell list. When tapped, it calls getForm(userId, pnr)
 *      to get the journey details for the top card.
 *   3. User gives stars and presses Submit -> submit(request) saves it.
 *   4. Staff/Admin can view all feedback and the average per category (summary).
 */
@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private final FeedbackRepository repository;
    // Feedback is only allowed after a JOURNEY_COMPLETED notification, so we look those up too.
    private final NotificationRepository notificationRepository;
    // MongoTemplate = lower-level MongoDB access, for queries too complex for repository
    // method names (here: the aggregation in summary()).
    private final MongoTemplate mongoTemplate;

    public FeedbackController(FeedbackRepository repository,
                              NotificationRepository notificationRepository,
                              MongoTemplate mongoTemplate) {
        this.repository = repository;
        this.notificationRepository = notificationRepository;
        this.mongoTemplate = mongoTemplate;
    }

    // Step 2: data for the "Journey Details" card. 404 if the journey hasn't been completed yet.
    // @RequestParam reads "?userId=...&pnr=..." from the URL.
    @GetMapping("/form")
    public FeedbackForm getForm(@RequestParam String userId, @RequestParam String pnr) {
        Notification journeyCompleted = findCompletedJourney(userId, pnr);
        return new FeedbackForm(userId, pnr, journeyCompleted.getData(),
                repository.existsByUserIdAndPnr(userId, pnr));
    }

    // Step 3: save the user's ratings. 201 Created = a new feedback document was made.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Feedback submit(@Valid @RequestBody FeedbackRequest request) {
        // Only allowed after a JOURNEY_COMPLETED notification exists for this user + PNR.
        Notification journeyCompleted = findCompletedJourney(request.userId(), request.pnr());

        // Only one feedback per journey. 409 Conflict = "this already exists".
        if (repository.existsByUserIdAndPnr(request.userId(), request.pnr())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Feedback for PNR " + request.pnr() + " was already submitted");
        }

        Feedback feedback = new Feedback();
        feedback.setUserId(request.userId());
        feedback.setPnr(request.pnr());
        feedback.setJourney(journeyCompleted.getData());  // copy train/route/seat from the notification
        feedback.setRatings(request.ratings());
        feedback.setComment(request.comment());
        feedback.setSubmittedAt(Instant.now());

        try {
            return repository.save(feedback);
        } catch (DuplicateKeyException e) {
            // Two submits at the exact same moment: the unique index in MongoDB stopped the second one.
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Feedback for PNR " + request.pnr() + " was already submitted");
        }
    }

    @GetMapping("/user/{userId}")
    public List<Feedback> getForUser(@PathVariable String userId) {
        return repository.findByUserIdOrderBySubmittedAtDesc(userId);
    }

    @GetMapping
    public List<Feedback> getAll() {
        return repository.findAllByOrderBySubmittedAtDesc();
    }

    /*
     * Step 4: average rating per category, for all trains or one train.
     * required = false: the URL works with or without ?trainNumber=...
     *
     * This uses a MongoDB "aggregation pipeline": the documents pass through stages, like an
     * assembly line. The query MongoDB runs is:
     *
     *   db.feedback.aggregate([
     *     { $match: { "journey.trainNumber": "12301" } },              // only if trainNumber given
     *     { $group: { _id: null,                                        // one group = all documents
     *                 totalFeedbacks: { $sum: 1 },
     *                 washroomCleanliness: { $avg: "$ratings.washroomCleanliness" },
     *                 ... same for the other 5 ratings ... } }
     *   ])
     *
     * $avg skips missing/null values, so the optional foodQuality averages only the people who rated it.
     * (In PostgreSQL this would be: SELECT COUNT(*), AVG(washroom_cleanliness), ... FROM feedback WHERE ...)
     */
    @GetMapping("/summary")
    public Map<String, Object> summary(@RequestParam(required = false) String trainNumber) {
        List<AggregationOperation> stages = new ArrayList<>();

        if (trainNumber != null && !trainNumber.isBlank()) {
            stages.add(Aggregation.match(Criteria.where("journey.trainNumber").is(trainNumber)));
        }

        stages.add(Aggregation.group()   // group() with no field = put every document in one group
                .count().as("totalFeedbacks")
                .avg("ratings.washroomCleanliness").as("washroomCleanliness")
                .avg("ratings.foodQuality").as("foodQuality")
                .avg("ratings.coachCleaning").as("coachCleaning")
                .avg("ratings.electricalAppliances").as("electricalAppliances")
                .avg("ratings.seatMaterialQuality").as("seatMaterialQuality")
                .avg("ratings.bedsheetBlanket").as("bedsheetBlanket"));

        // Run it on the "feedback" collection; each result comes back as a raw MongoDB Document (a Map).
        Document result = mongoTemplate
                .aggregate(Aggregation.newAggregation(stages), "feedback", Document.class)
                .getUniqueMappedResult();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("trainNumber", trainNumber == null || trainNumber.isBlank() ? "ALL" : trainNumber);

        if (result == null) {   // no feedback matched yet
            summary.put("totalFeedbacks", 0);
            return summary;
        }

        summary.put("totalFeedbacks", result.get("totalFeedbacks"));
        // Copy each average, rounded to 1 decimal place (6.333... -> 6.3). null = nobody rated it.
        for (String category : List.of("washroomCleanliness", "foodQuality", "coachCleaning",
                "electricalAppliances", "seatMaterialQuality", "bedsheetBlanket")) {
            Object average = result.get(category);
            summary.put(category, average == null ? null
                    : Math.round(((Number) average).doubleValue() * 10) / 10.0);
        }
        return summary;
    }

    // Shared check: find the JOURNEY_COMPLETED notification, or reply 404 explaining why.
    private Notification findCompletedJourney(String userId, String pnr) {
        return notificationRepository
                .findFirstByUserIdAndPnrAndTypeOrderByCreatedAtDesc(userId, pnr, NotificationType.JOURNEY_COMPLETED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No completed journey for user " + userId + " and PNR " + pnr
                                + ". Feedback opens only after a JOURNEY_COMPLETED notification."));
    }
}
