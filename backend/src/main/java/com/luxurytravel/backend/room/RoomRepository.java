package com.luxurytravel.backend.room;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {
    List<Room> findAllByOrderByArea_SortOrderAscArea_NameAscLocationAscFloorNumberAscCodeAsc();
    List<Room> findAllByAssignedCleanerIdOrderByArea_SortOrderAscArea_NameAscLocationAscFloorNumberAscCodeAsc(Long assignedCleanerId);

    Optional<Room> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);

    boolean existsByArea_Id(Long areaId);
}
