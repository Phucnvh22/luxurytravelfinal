package com.luxurytravel.backend.experience;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExperienceRequestRepository extends JpaRepository<ExperienceRequest, Long> {
    List<ExperienceRequest> findAllByOrderByCreatedAtDescIdDesc();

    List<ExperienceRequest> findBySellerIdOrderByCreatedAtDescIdDesc(Long sellerId);

    List<ExperienceRequest> findByUserIdOrderByCreatedAtDescIdDesc(Long userId);

    long countByStatus(com.luxurytravel.backend.booking.BookingStatus status);

    ExperienceRequest findTopByOrderByCreatedAtDescIdDesc();
}
