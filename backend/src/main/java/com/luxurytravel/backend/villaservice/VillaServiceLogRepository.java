package com.luxurytravel.backend.villaservice;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VillaServiceLogRepository extends JpaRepository<VillaServiceLog, Long> {
    List<VillaServiceLog> findByTargetTypeAndTargetIdOrderByOccurredAtDescIdDesc(String targetType, Long targetId);

    List<VillaServiceLog> findTop100ByOrderByOccurredAtDescIdDesc();

    void deleteByTargetTypeAndTargetId(String targetType, Long targetId);
}
