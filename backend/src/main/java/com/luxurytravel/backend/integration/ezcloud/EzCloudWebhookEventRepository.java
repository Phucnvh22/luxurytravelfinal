package com.luxurytravel.backend.integration.ezcloud;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EzCloudWebhookEventRepository extends JpaRepository<EzCloudWebhookEvent, Long> {
    List<EzCloudWebhookEvent> findTop50ByOrderByCreatedAtDesc();
}
