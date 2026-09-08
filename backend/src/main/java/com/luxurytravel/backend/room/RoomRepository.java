package com.luxurytravel.backend.room;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {
    List<Room> findAllByOrderByArea_SortOrderAscArea_NameAscLocationAscFloorNumberAscCodeAsc();
    List<Room> findAllByAssignedCleanerIdOrderByArea_SortOrderAscArea_NameAscLocationAscFloorNumberAscCodeAsc(Long assignedCleanerId);

    Optional<Room> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);

    boolean existsByArea_Id(Long areaId);

    boolean existsByTypeIgnoreCase(String type);

    boolean existsByBedroomLayoutIgnoreCase(String bedroomLayout);

    boolean existsByHostIgnoreCase(String host);

    List<Room> findAllByTypeIgnoreCase(String type);

    List<Room> findAllByBedroomLayoutIgnoreCase(String bedroomLayout);

    List<Room> findAllByHostIgnoreCase(String host);

    long countByTypeIgnoreCaseAndActiveTrue(String type);

    @Query("""
            select lower(r.type), count(r)
            from Room r
            where r.active = true
            group by lower(r.type)
            """)
    List<Object[]> countActiveUnitsByRoomType();
}
