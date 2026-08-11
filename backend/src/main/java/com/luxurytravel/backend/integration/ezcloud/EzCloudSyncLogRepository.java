package com.luxurytravel.backend.integration.ezcloud;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EzCloudSyncLogRepository extends JpaRepository<EzCloudSyncLog, Long> {
    List<EzCloudSyncLog> findTop50ByOrderByCreatedAtDesc();
}
