package com.luxurytravel.backend.villaservice;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VillaServiceOrderRepository extends JpaRepository<VillaServiceOrder, Long> {
    List<VillaServiceOrder> findAllByOrderByUpdatedAtDescIdDesc();

    Optional<VillaServiceOrder> findByOrderTypeAndBookingId(String orderType, Long bookingId);
}
