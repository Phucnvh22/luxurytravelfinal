package com.luxurytravel.backend.integration.lazhost;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LazHostWebhookEventRepository extends JpaRepository<LazHostWebhookEvent, Long> {
    List<LazHostWebhookEvent> findTop200ByOrderByIdDesc();

    boolean existsByEventId(String eventId);

    List<LazHostWebhookEvent> findTop100ByProcessedFalseOrderByIdAsc();
}
