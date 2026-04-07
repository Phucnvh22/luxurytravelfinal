package com.luxurytravel.backend.service;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, Long> {
    List<ServiceRequest> findBySellerId(Long sellerId);

    List<ServiceRequest> findByUserId(Long userId);
}
