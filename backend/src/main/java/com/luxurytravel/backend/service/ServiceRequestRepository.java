package com.luxurytravel.backend.service;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, Long> {
    List<ServiceRequest> findAllByOrderByCreatedAtDescIdDesc();

    List<ServiceRequest> findBySellerIdOrderByCreatedAtDescIdDesc(Long sellerId);

    List<ServiceRequest> findByUserIdOrderByCreatedAtDescIdDesc(Long userId);

    long countByStatus(com.luxurytravel.backend.booking.BookingStatus status);

    ServiceRequest findTopByOrderByCreatedAtDescIdDesc();
}
