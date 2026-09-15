package com.luxurytravel.backend.integration.lazhost;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Map;

@Service
public class LazHostOperationRecorder {
    private final LazHostOperationRepository operationRepository;
    private final ObjectMapper objectMapper;

    public LazHostOperationRecorder(LazHostOperationRepository operationRepository, ObjectMapper objectMapper) {
        this.operationRepository = operationRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public LazHostOperation record(
            String operationType,
            String requestId,
            String idempotencyKey,
            Object payload,
            Map<?, ?> response,
            String message
    ) {
        String operationId = extractOperationId(response);
        if (operationId == null || operationId.isBlank()) {
            return null;
        }

        LazHostOperation operation = operationRepository.findByOperationIdIgnoreCase(operationId)
                .orElseGet(LazHostOperation::new);
        operation.setOperationId(operationId);
        operation.setOperationType(operationType == null || operationType.isBlank() ? "UNKNOWN" : operationType.trim());
        operation.setRequestId(normalize(requestId));
        operation.setIdempotencyKey(normalize(idempotencyKey));
        operation.setPayload(toJson(payload));
        operation.setResponseBody(toJson(response));
        operation.setStatus(resolveStatus(response));
        operation.setMessage(normalize(message));
        return operationRepository.save(operation);
    }

    public String extractOperationId(Map<?, ?> response) {
        return firstNonBlank(
                textAt(response, "operationId"),
                textAt(response, "operation.id"),
                textAt(response, "data.operationId"),
                textAt(response, "data.operation.id")
        );
    }

    private LazHostOperationStatus resolveStatus(Map<?, ?> response) {
        String status = firstNonBlank(
                textAt(response, "status"),
                textAt(response, "operation.status"),
                textAt(response, "data.status"),
                textAt(response, "data.operation.status")
        );
        if (status == null) {
            return LazHostOperationStatus.PENDING;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (normalized.contains("SUCCESS") || normalized.contains("DONE") || normalized.contains("COMPLETED")) {
            return LazHostOperationStatus.SUCCESS;
        }
        if (normalized.contains("FAIL") || normalized.contains("ERROR")) {
            return LazHostOperationStatus.FAILED;
        }
        return LazHostOperationStatus.PENDING;
    }

    private String textAt(Map<?, ?> root, String path) {
        if (root == null || path == null || path.isBlank()) {
            return null;
        }
        Object current = root;
        for (String part : path.split("\\.")) {
            if (!(current instanceof Map<?, ?> currentMap)) {
                return null;
            }
            current = currentMap.get(part);
        }
        if (current == null) {
            return null;
        }
        String value = String.valueOf(current).trim();
        return value.isEmpty() ? null : value;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : limit(normalized);
    }

    private String toJson(Object value) {
        try {
            return limit(objectMapper.writeValueAsString(value == null ? Map.of() : value));
        } catch (Exception ex) {
            return "{}";
        }
    }

    private String limit(String value) {
        if (value == null) {
            return null;
        }
        if (value.length() <= 3900) {
            return value;
        }
        return value.substring(0, 3900);
    }
}
