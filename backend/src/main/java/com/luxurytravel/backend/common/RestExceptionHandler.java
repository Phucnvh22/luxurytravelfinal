package com.luxurytravel.backend.common;

import com.luxurytravel.backend.destination.DestinationNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class RestExceptionHandler {
    @ExceptionHandler(DestinationNotFoundException.class)
    public ResponseEntity<ApiError> handleDestinationNotFound(DestinationNotFoundException ex) {
        ApiError body = new ApiError(ex.getMessage(), Instant.now(), null);
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fields.put(error.getField(), error.getDefaultMessage());
        }
        ApiError body = new ApiError("Validation failed", Instant.now(), fields);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
