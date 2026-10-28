package com.railway.train.model;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

// Body of PATCH /api/schedules/runs/{runId}/status. delayMinutes is optional
// (left as it is when missing).
public record RunStatusUpdate(
        @NotBlank(message = "is required")
        @Pattern(regexp = "SCHEDULED|DEPARTED|DELAYED|CANCELLED|ARRIVED",
                 message = "must be SCHEDULED, DEPARTED, DELAYED, CANCELLED or ARRIVED")
        String status,
        @Min(value = 0, message = "must not be negative")
        Integer delayMinutes) {
}
