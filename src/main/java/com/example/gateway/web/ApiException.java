package com.example.gateway.web;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    /** The error code in the shared error body, the same codes Team 3's booking-service uses. */
    public String getCode() {
        return switch (status) {
            case NOT_FOUND -> "NOT_FOUND";
            case BAD_REQUEST -> "INVALID_INPUT";
            case CONFLICT -> "WRONG_STATE";
            case BAD_GATEWAY -> "GATEWAY_ERROR";
            default -> status.name();
        };
    }

    public static ApiException notFound(String msg) {
        return new ApiException(HttpStatus.NOT_FOUND, msg);
    }

    public static ApiException badRequest(String msg) {
        return new ApiException(HttpStatus.BAD_REQUEST, msg);
    }

    public static ApiException conflict(String msg) {
        return new ApiException(HttpStatus.CONFLICT, msg);
    }

    public static ApiException gateway(String msg) {
        return new ApiException(HttpStatus.BAD_GATEWAY, msg);
    }
}
