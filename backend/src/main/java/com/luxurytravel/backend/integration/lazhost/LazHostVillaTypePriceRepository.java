package com.luxurytravel.backend.integration.lazhost;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface LazHostVillaTypePriceRepository extends JpaRepository<LazHostVillaTypePrice, Long> {
    List<LazHostVillaTypePrice> findAllByFromDateAndToDate(LocalDate fromDate, LocalDate toDate);

    Optional<LazHostVillaTypePrice> findByVillaTypeCodeIgnoreCaseAndChannelAndFromDateAndToDate(
            String villaTypeCode,
            LazHostPriceChannel channel,
            LocalDate fromDate,
            LocalDate toDate
    );
}
