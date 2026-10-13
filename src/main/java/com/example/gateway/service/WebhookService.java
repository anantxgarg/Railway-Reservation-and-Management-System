package com.example.gateway.service;

import com.example.gateway.domain.RefundStatus;
import com.example.gateway.web.ApiException;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Webhooks are the safety net: if the passenger closes the tab right after paying,
 * the browser never calls /verify, but Razorpay still tells us the payment happened.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebhookService {

    private final PaymentService paymentService;
    private final RefundService refundService;
    private final com.example.gateway.repo.ProcessedWebhookEventRepository processedEvents;

    @Value("${razorpay.webhook-secret}")
    private String webhookSecret;

    public void handle(String payload, String signature) {
        try {
            if (signature == null || !Utils.verifyWebhookSignature(payload, signature, webhookSecret)) {
                throw ApiException.badRequest("Invalid webhook signature");
            }
        } catch (RazorpayException e) {
            throw ApiException.badRequest("Webhook signature check failed: " + e.getMessage());
        }

        JSONObject json = new JSONObject(payload);
        String eventId = json.optString("id", null);
        if (eventId != null && processedEvents.existsByEventId(eventId)) {
            log.info("Webhook event {} already processed. Skipping duplicate.", eventId);
            return;
        }

        String event = json.getString("event");
        JSONObject body = json.getJSONObject("payload");
        log.info("Razorpay webhook: {} (id: {})", event, eventId);

        switch (event) {
            case "payment.captured" -> {
                JSONObject pay = body.getJSONObject("payment").getJSONObject("entity");
                paymentService.markPaid(pay.getString("order_id"), pay.getString("id"));
            }
            case "payment.failed" ->
                    // Keep the order open: the customer can retry on the same order.
                    log.info("Payment attempt failed for order {}",
                            body.getJSONObject("payment").getJSONObject("entity").optString("order_id"));
            case "refund.processed" -> refundService.updateStatus(
                    body.getJSONObject("refund").getJSONObject("entity").getString("id"), RefundStatus.PROCESSED);
            case "refund.failed" -> refundService.updateStatus(
                    body.getJSONObject("refund").getJSONObject("entity").getString("id"), RefundStatus.FAILED);
            default -> log.debug("Ignoring event {}", event);
        }

        if (eventId != null) {
            processedEvents.save(new com.example.gateway.domain.ProcessedWebhookEvent(
                    eventId, event, "Processed successfully"));
        }
    }
}
