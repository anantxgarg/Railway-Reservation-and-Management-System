package com.railway.booking.error;

import org.springframework.http.HttpStatus;

/** An error with a known HTTP status, thrown by the service layer. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
    }

    public static ApiException invalid(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_INPUT", message);
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }
}
