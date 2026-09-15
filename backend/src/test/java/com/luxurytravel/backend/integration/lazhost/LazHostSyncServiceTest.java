package com.luxurytravel.backend.integration.lazhost;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luxurytravel.backend.room.RoomRepository;
import com.luxurytravel.backend.roombooking.RoomBooking;
import com.luxurytravel.backend.roombooking.RoomBookingRepository;
import com.luxurytravel.backend.roombooking.RoomBookingStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LazHostSyncServiceTest {
    @Mock
    private LazHostVillaMappingRepository mappingRepository;
    @Mock
    private RoomRepository roomRepository;
    @Mock
    private LazHostHoldRepository holdRepository;
    @Mock
    private LazHostSyncLogRepository syncLogRepository;
    @Mock
    private LazHostWebhookEventRepository webhookEventRepository;
    @Mock
    private RoomBookingRepository roomBookingRepository;
    @Mock
    private LazHostOperationRepository operationRepository;

    private StubLazHostClient lazHostClient;
    private LazHostProperties properties;
    private LazHostVillaMappingService mappingService;
    private LazHostOperationRecorder operationRecorder;
    private LazHostSyncService syncService;

    @BeforeEach
    void setUp() {
        lazHostClient = new StubLazHostClient();
        properties = new LazHostProperties();
        mappingService = new LazHostVillaMappingService(mappingRepository, roomRepository);
        operationRecorder = new LazHostOperationRecorder(operationRepository, new ObjectMapper());
        syncService = new LazHostSyncService(
                lazHostClient,
                properties,
                mappingService,
                mappingRepository,
                holdRepository,
                syncLogRepository,
                webhookEventRepository,
                operationRecorder,
                roomBookingRepository,
                new ObjectMapper()
        );
    }

    @Test
    void syncBookingReleasesHoldWhenCreateBookingFails() {
        RoomBooking booking = new RoomBooking();
        booking.setId(10L);
        booking.setRoomCode("V101");
        booking.setGuestName("Alex");
        booking.setAdults(2);
        booking.setCheckInAt(LocalDateTime.of(2026, 10, 2, 14, 0));
        booking.setCheckOutAt(LocalDateTime.of(2026, 10, 4, 12, 0));
        booking.setNotes("Late arrival");
        booking.setStatus(RoomBookingStatus.CONFIRMED);
        booking.setUpdatedAt(Instant.parse("2026-10-01T10:15:30Z"));

        LazHostVillaMapping mapping = new LazHostVillaMapping();
        mapping.setRoomCode("V101");
        mapping.setLazHostRoomCode("lh-deluxe");
        mapping.setLazHostRatePlanCode("rate-flex");
        mapping.setActive(true);

        AtomicReference<LazHostHold> savedHold = new AtomicReference<>();

        when(roomBookingRepository.findById(10L)).thenReturn(Optional.of(booking));
        when(mappingRepository.findByRoomCodeIgnoreCase("V101")).thenReturn(Optional.of(mapping));
        when(syncLogRepository.save(any(LazHostSyncLog.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(holdRepository.findByHoldIdIgnoreCase("H-1")).thenAnswer(invocation -> Optional.ofNullable(savedHold.get()));
        when(holdRepository.save(any(LazHostHold.class))).thenAnswer(invocation -> {
            LazHostHold hold = invocation.getArgument(0);
            savedHold.set(hold);
            return hold;
        });
        lazHostClient.holdResponse = new LazHostClient.LazHostHoldResponse("H-1", Map.of("holdId", "H-1"));
        lazHostClient.createBookingFailure = new RuntimeException("booking timeout");

        LazHostSyncLog log = syncService.syncBooking(10L);

        assertEquals(LazHostSyncStatus.FAILED, log.getStatus());
        assertEquals("H-1", log.getHoldId());
        assertEquals(LazHostHoldStatus.RELEASED, savedHold.get().getStatus());
        assertTrue(savedHold.get().getLastError().contains("booking timeout"));
        assertTrue(lazHostClient.deleteHoldCalled);
    }

    private static final class StubLazHostClient extends LazHostClient {
        private LazHostHoldResponse holdResponse;
        private RuntimeException createBookingFailure;
        private boolean deleteHoldCalled;

        private StubLazHostClient() {
            super(null, null, RestClient.builder());
        }

        @Override
        public LazHostHoldResponse createHoldResponse(LazHostCreateHoldRequest request, String idempotencyKey, String requestId) {
            return holdResponse;
        }

        @Override
        public Map<?, ?> createBooking(LazHostCreateBookingRequest request, String idempotencyKey, String requestId) {
            throw createBookingFailure;
        }

        @Override
        public void deleteHold(String holdId, String idempotencyKey, String requestId) {
            deleteHoldCalled = true;
        }
    }
}
