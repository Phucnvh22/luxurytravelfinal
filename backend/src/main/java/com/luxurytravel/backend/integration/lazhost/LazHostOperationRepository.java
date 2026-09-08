package com.luxurytravel.backend.integration.lazhost;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LazHostOperationRepository extends JpaRepository<LazHostOperation, Long> {
    Optional<LazHostOperation> findByOperationIdIgnoreCase(String operationId);

    List<LazHostOperation> findTop200ByOrderByIdDesc();

    List<LazHostOperation> findTop100ByStatusOrderByUpdatedAtAsc(LazHostOperationStatus status);
}
