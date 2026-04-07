package com.luxurytravel.backend.destination;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DestinationRepository extends JpaRepository<Destination, Long> {
    boolean existsByNameIgnoreCase(String name);

    List<Destination> findAllByOrderByCreatedAtDescIdDesc();
}
