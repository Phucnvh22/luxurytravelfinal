package com.luxurytravel.backend.integration.lazhost;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LazHostVillaMappingRepository extends JpaRepository<LazHostVillaMapping, Long> {
    List<LazHostVillaMapping> findAllByOrderByRoomCodeAsc();

    Optional<LazHostVillaMapping> findByRoomCodeIgnoreCase(String roomCode);

    Optional<LazHostVillaMapping> findByLazHostRoomCodeIgnoreCase(String lazHostRoomCode);

    boolean existsByRoomCodeIgnoreCase(String roomCode);

    boolean existsByRoomCodeIgnoreCaseAndIdNot(String roomCode, Long id);

    boolean existsByLazHostRoomCodeIgnoreCase(String lazHostRoomCode);

    boolean existsByLazHostRoomCodeIgnoreCaseAndIdNot(String lazHostRoomCode, Long id);
}
