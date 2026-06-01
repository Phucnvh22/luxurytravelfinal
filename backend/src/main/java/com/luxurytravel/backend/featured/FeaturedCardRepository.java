package com.luxurytravel.backend.featured;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FeaturedCardRepository extends JpaRepository<FeaturedCard, Long> {
    Optional<FeaturedCard> findByCategoryAndItemId(FeaturedCardCategory category, Long itemId);

    List<FeaturedCard> findAllByOrderByCreatedAtDesc();
}
