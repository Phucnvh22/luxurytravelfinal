package com.luxurytravel.backend.integration.lazhost;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LazHostSyncLogRepository extends JpaRepository<LazHostSyncLog, Long> {
    List<LazHostSyncLog> findTop200ByOrderByIdDesc();

    long countByDirection(LazHostSyncDirection direction);
}
