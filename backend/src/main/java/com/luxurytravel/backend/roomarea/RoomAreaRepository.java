package com.luxurytravel.backend.roomarea;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomAreaRepository extends JpaRepository<RoomArea, Long> {
    List<RoomArea> findAllByOrderBySortOrderAscNameAsc();

    Optional<RoomArea> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
