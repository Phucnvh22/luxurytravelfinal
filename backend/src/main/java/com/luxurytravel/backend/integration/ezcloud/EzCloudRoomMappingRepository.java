package com.luxurytravel.backend.integration.ezcloud;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EzCloudRoomMappingRepository extends JpaRepository<EzCloudRoomMapping, Long> {
    List<EzCloudRoomMapping> findAllByOrderByRoomCodeAsc();

    Optional<EzCloudRoomMapping> findByRoomCodeIgnoreCase(String roomCode);

    Optional<EzCloudRoomMapping> findByEzCloudRoomCodeIgnoreCase(String ezCloudRoomCode);

    boolean existsByRoomCodeIgnoreCase(String roomCode);

    boolean existsByRoomCodeIgnoreCaseAndIdNot(String roomCode, Long id);

    boolean existsByEzCloudRoomCodeIgnoreCase(String ezCloudRoomCode);

    boolean existsByEzCloudRoomCodeIgnoreCaseAndIdNot(String ezCloudRoomCode, Long id);
}
