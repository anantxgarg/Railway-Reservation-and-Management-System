package com.railway.train.error;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Error body, the same shape as Team 1's API:
 * {"error": {"code": "...", "message": "...", "constraint": "..."}}.
 * constraint is the database rule that refused the request, when there is one.
 */
public record ErrorResponse(Body error) {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Body(String code, String message, String constraint) {
    }

    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(new Body(code, message, null));
    }

    public static ErrorResponse of(String code, String message, String constraint) {
        return new ErrorResponse(new Body(code, message, constraint));
    }
}
