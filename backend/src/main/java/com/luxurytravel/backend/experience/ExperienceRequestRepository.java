package com.luxurytravel.backend.experience;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExperienceRequestRepository extends JpaRepository<ExperienceRequest, Long> {
    List<ExperienceRequest> findBySellerId(Long sellerId);

    List<ExperienceRequest> findByUserId(Long userId);
}

