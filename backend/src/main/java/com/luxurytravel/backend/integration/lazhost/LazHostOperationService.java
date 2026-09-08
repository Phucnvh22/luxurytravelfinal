package com.luxurytravel.backend.integration.lazhost;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class LazHostOperationService {
    private final LazHostClient client;
    private final LazHostOperationRepository operationRepository;
    private final ObjectMapper objectMapper;

    public LazHostOperationService(LazHostClient client, LazHostOperationRepository operationRepository, ObjectMapper objectMapper) {
        this.client = client;
        this.operationRepository = operationRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<LazHostOperation> listRecent() {
        return operationRepository.findTop200ByOrderByIdDesc();
    }

    @Transactional
    public LazHostOperation refresh(String operationId) {
        LazHostOperation op = operationRepository.findByOperationIdIgnoreCase(operationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Operation not found"));
        return refresh(op);
    }

    @Transactional
    public LazHostOperation refresh(LazHostOperation op) {
        try {
            Map<?, ?> response = client.getOperation(op.getOperationId(), op.getRequestId());
            op.setResponseBody(toJson(response));
            op.setStatus(resolveStatus(response));
            op.setMessage("Refreshed");
            return operationRepository.save(op);
        } catch (Exception ex) {
            op.setStatus(LazHostOperationStatus.FAILED);
            op.setMessage(ex.getMessage());
            return operationRepository.save(op);
        }
    }

    @Scheduled(fixedDelayString = "${application.integrations.lazhost.operations-refresh-fixed-delay-ms:15000}")
    @Transactional
    public void refreshPending() {
        List<LazHostOperation> pending = operationRepository.findTop100ByStatusOrderByUpdatedAtAsc(LazHostOperationStatus.PENDING);
        for (LazHostOperation op : pending) {
            refresh(op);
        }
    }

    private LazHostOperationStatus resolveStatus(Map<?, ?> response) {
        if (response == null) return LazHostOperationStatus.PENDING;
        Object statusValue = response.get("status");
        if (statusValue instanceof String s) {
            String normalized = s.trim().toUpperCase(Locale.ROOT);
            if (normalized.contains("SUCCESS") || normalized.contains("DONE") || normalized.contains("COMPLETED")) {
                return LazHostOperationStatus.SUCCESS;
            }
            if (normalized.contains("FAIL")) {
                return LazHostOperationStatus.FAILED;
            }
        }
        return LazHostOperationStatus.PENDING;
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return "{}";
        }
    }
}
