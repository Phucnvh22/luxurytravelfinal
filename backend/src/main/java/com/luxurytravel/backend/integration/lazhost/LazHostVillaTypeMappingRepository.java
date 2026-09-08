package com.luxurytravel.backend.integration.lazhost;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LazHostVillaTypeMappingRepository extends JpaRepository<LazHostVillaTypeMapping, Long> {
    List<LazHostVillaTypeMapping> findAllByOrderByVillaTypeCodeAsc();

    Optional<LazHostVillaTypeMapping> findByVillaTypeCodeIgnoreCase(String villaTypeCode);

    boolean existsByVillaTypeCodeIgnoreCase(String villaTypeCode);

    boolean existsByVillaTypeCodeIgnoreCaseAndIdNot(String villaTypeCode, Long id);

    boolean existsByLazHostRoomCodeIgnoreCase(String lazHostRoomCode);

    boolean existsByLazHostRoomCodeIgnoreCaseAndIdNot(String lazHostRoomCode, Long id);
}
