package com.railway.train.error;

import java.sql.SQLException;
import java.util.Map;

import org.postgresql.util.PSQLException;
import org.postgresql.util.ServerErrorMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Turns exceptions into the shared error body.
 *
 * The same mapping as booking-service, so every backend answers alike.
 * Database errors are mapped by SQLSTATE. The C2 triggers raise these on
 * purpose (e.g. trg_validate_route_sequence), and their messages are written
 * for users, so they are passed through:
 *   P0002 not found            -> 404
 *   22023 / 22P02 bad input    -> 422
 *   23502 / 23503 missing or unknown value -> 422
 *   23514 broken rule          -> 422, with the rule's constraint name
 *   55000 wrong state          -> 409 (e.g. hold expired, already cancelled)
 *   23505 / 23P01 / 40001 / 40P01 clash with another request -> 409
 *   42501 not allowed          -> 403
 * Anything else is a 500 and is logged.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    // Plain CHECK constraints come with PostgreSQL's own wording ("new row for
    // relation ... violates check constraint ..."); these read better. The
    // trigger rules (trg_*) already raise readable messages.
    private static final Map<String, String> CHECK_MESSAGES = Map.of(
            "chk_train_run_status", "Run status must be SCHEDULED, DEPARTED, DELAYED, CANCELLED or ARRIVED",
            "chk_train_run_delay", "Delay must not be negative",
            "chk_train_schedule_run_day", "Run day must be a weekday name, e.g. Monday",
            "chk_travel_class_seats", "Seats per coach must be more than 0",
            "chk_travel_class_base_fare", "Base fare per km must be more than 0",
            "chk_route_station_distance", "Distance must not be negative",
            "chk_station_num_platforms", "Number of platforms must be more than 0");

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorResponse> api(ApiException e) {
        return ResponseEntity.status(e.status()).body(ErrorResponse.of(e.code(), e.getMessage()));
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ErrorResponse> database(DataAccessException e) {
        PSQLException pg = findCause(e, PSQLException.class);
        SQLException sql = pg != null ? pg : findCause(e, SQLException.class);
        String state = sql == null ? null : sql.getSQLState();
        ServerErrorMessage server = pg == null ? null : pg.getServerErrorMessage();
        String message = server != null && server.getMessage() != null ? server.getMessage() : "Database error";
        String constraint = server == null ? null : server.getConstraint();

        if (state != null) {
            switch (state) {
                case "P0002":
                    return error(HttpStatus.NOT_FOUND, "NOT_FOUND", message, null);
                case "22023", "22P02":
                    return error(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_INPUT", message, null);
                case "23502":
                    return error(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_INPUT",
                            "Missing value for " + server.getColumn(), null);
                case "23503":
                    // the detail names the value: Key (class_code)=(XX) is not present in table ...,
                    // or, on delete: Key (train_no)=(12952) is still referenced from table ...
                    return error(message.startsWith("update or delete") ? HttpStatus.CONFLICT
                                    : HttpStatus.UNPROCESSABLE_ENTITY,
                            message.startsWith("update or delete") ? "IN_USE" : "INVALID_INPUT",
                            server.getDetail() != null ? server.getDetail() : message, constraint);
                case "23514":
                    if (message.startsWith("new row for relation")) {
                        message = CHECK_MESSAGES.getOrDefault(constraint,
                                "The request breaks the rule " + constraint);
                    }
                    return error(HttpStatus.UNPROCESSABLE_ENTITY, "RULE_VIOLATION", message, constraint);
                case "55000":
                    return error(HttpStatus.CONFLICT, "WRONG_STATE", message, null);
                case "23505", "23P01", "40001", "40P01":
                    return error(HttpStatus.CONFLICT, "CONFLICT",
                            "The request clashed with another one; please try again", constraint);
                case "42501":
                    return error(HttpStatus.FORBIDDEN, "FORBIDDEN", message, null);
                default:
                    break;
            }
        }
        log.error("Unmapped database error (SQLSTATE {})", state, e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Something went wrong", null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> invalidBody(MethodArgumentNotValidException e) {
        var field = e.getBindingResult().getFieldError();
        String message = field == null ? "Invalid request body" : field.getField() + " " + field.getDefaultMessage();
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message, null);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class, HandlerMethodValidationException.class})
    ResponseEntity<ErrorResponse> badRequest(Exception e) {
        String message = "Invalid request";
        if (e instanceof MissingServletRequestParameterException m) {
            message = "Missing parameter: " + m.getParameterName();
        } else if (e instanceof MethodArgumentTypeMismatchException m) {
            message = "Invalid value for " + m.getName();
        } else if (e instanceof HttpMessageNotReadableException) {
            message = "Request body is missing or not valid JSON";
        }
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message, null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ErrorResponse> noRoute(NoResourceFoundException e) {
        return error(HttpStatus.NOT_FOUND, "NOT_FOUND", "No such endpoint", null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ErrorResponse> wrongMethod(HttpRequestMethodNotSupportedException e) {
        return error(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED", e.getMessage(), null);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(Exception e) {
        log.error("Unhandled error", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Something went wrong", null);
    }

    private static ResponseEntity<ErrorResponse> error(HttpStatus status, String code, String message,
                                                       String constraint) {
        return ResponseEntity.status(status).body(ErrorResponse.of(code, message, constraint));
    }

    private static <T extends Throwable> T findCause(Throwable e, Class<T> type) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (type.isInstance(t)) {
                return type.cast(t);
            }
        }
        return null;
    }
}
