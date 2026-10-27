package com.example.gateway.web;

import lombok.extern.slf4j.Slf4j;
import org.postgresql.util.PSQLException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Errors in the shape Teams 1, 2 and 3 use:
 * {"error": {"code": "NOT_FOUND", "message": "...", "fields": [{"field", "message"}]}}.
 * fields is only there for a request body that failed validation.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** The error body; SecurityConfig writes the same shape for 401 and 403. */
    public static Map<String, Object> body(String code, String message) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", code);
        error.put("message", message);
        return Map.of("error", error);
    }

    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(body(code, message));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApi(ApiException e) {
        return error(e.getStatus(), e.getCode(), e.getMessage());
    }

    /** @PreAuthorize refusals; without this the catch-all below would turn them into 500s. */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException e) {
        return error(HttpStatus.FORBIDDEN, "FORBIDDEN", "Your role cannot do this");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        List<Map<String, String>> fields = e.getBindingResult().getFieldErrors().stream()
                .map(f -> Map.of("field", f.getField(), "message", String.valueOf(f.getDefaultMessage())))
                .toList();
        Map<String, Object> body = body("VALIDATION_ERROR", "Validation failed");
        @SuppressWarnings("unchecked")
        Map<String, Object> error = (Map<String, Object>) body.get("error");
        error.put("fields", fields);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception e) {
        String message = "Invalid request";
        if (e instanceof MissingServletRequestParameterException m) {
            message = "Missing parameter: " + m.getParameterName();
        } else if (e instanceof MethodArgumentTypeMismatchException m) {
            message = "Invalid value for " + m.getName();
        } else if (e instanceof HttpMessageNotReadableException) {
            message = "Request body is missing or not valid JSON";
        }
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message);
    }

    /**
     * Errors raised on purpose by Team 3's booking functions (cancel_passengers,
     * confirm_booking), by SQLSTATE. Their messages are written for users.
     */
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDatabase(DataAccessException e) {
        PSQLException pg = null;
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof PSQLException p) {
                pg = p;
                break;
            }
        }
        String state = pg == null ? null : pg.getSQLState();
        String message = pg != null && pg.getServerErrorMessage() != null
                ? pg.getServerErrorMessage().getMessage() : null;
        if (state == null || message == null) {
            log.error("Unexpected database error", e);
            return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Internal server error");
        }
        return switch (state) {
            case "P0002" -> error(HttpStatus.NOT_FOUND, "NOT_FOUND", message);              // no such booking or passenger
            case "22023" -> error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", message);        // bad input
            case "23514" -> error(HttpStatus.BAD_REQUEST, "RULE_VIOLATION", message);       // broken booking rule
            case "55000" -> error(HttpStatus.CONFLICT, "WRONG_STATE", message);             // e.g. train already left
            case "40001", "40P01" -> error(HttpStatus.CONFLICT, "CONFLICT", message);       // clash with another request
            default -> {
                log.error("Unexpected database error", e);
                yield error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Internal server error");
            }
        };
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleOther(Exception e) {
        log.error("Unexpected error", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Internal server error");
    }
}
