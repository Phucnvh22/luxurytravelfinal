package com.luxurytravel.backend.integration.lazhost;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LazHostCatalogSnapshotRepository extends JpaRepository<LazHostCatalogSnapshot, Long> {
    Optional<LazHostCatalogSnapshot> findBySnapshotTypeIgnoreCase(String snapshotType);
}
