package com.luxurytravel.backend.integration.lazhost;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LazHostOperationRecorderTest {
    @Mock
    private LazHostOperationRepository operationRepository;

    @Test
    void recordStoresExtractedOperationIdAndStatus() {
        LazHostOperationRecorder recorder = new LazHostOperationRecorder(operationRepository, new ObjectMapper());
        when(operationRepository.findByOperationIdIgnoreCase("op-123")).thenReturn(Optional.empty());
        when(operationRepository.save(any(LazHostOperation.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LazHostOperation saved = recorder.record(
                "CREATE_BOOKING",
                "req-1",
                "idem-1",
                Map.of("holdId", "hold-1"),
                Map.of("operation", Map.of("id", "op-123", "status", "completed")),
                "Created booking"
        );

        assertNotNull(saved);
        assertEquals("op-123", saved.getOperationId());
        assertEquals("CREATE_BOOKING", saved.getOperationType());
        assertEquals(LazHostOperationStatus.SUCCESS, saved.getStatus());
        assertEquals("req-1", saved.getRequestId());
        assertEquals("idem-1", saved.getIdempotencyKey());

        ArgumentCaptor<LazHostOperation> captor = ArgumentCaptor.forClass(LazHostOperation.class);
        verify(operationRepository).save(captor.capture());
        assertEquals("op-123", captor.getValue().getOperationId());
        assertEquals(LazHostOperationStatus.SUCCESS, captor.getValue().getStatus());
    }
}
