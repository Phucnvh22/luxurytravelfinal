package com.luxurytravel.backend.integration.lazhost;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface LazHostHoldRepository extends JpaRepository<LazHostHold, Long> {
    Optional<LazHostHold> findByHoldIdIgnoreCase(String holdId);

    Optional<LazHostHold> findTopByExternalBookingIdIgnoreCaseOrderByIdDesc(String externalBookingId);

    List<LazHostHold> findTop100ByStatusAndExpiresAtBeforeOrderByExpiresAtAsc(LazHostHoldStatus status, Instant expiresAt);

    List<LazHostHold> findTop200ByOrderByIdDesc();
}
