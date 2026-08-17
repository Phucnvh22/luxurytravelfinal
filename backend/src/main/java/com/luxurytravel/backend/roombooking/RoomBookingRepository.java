package com.luxurytravel.backend.roombooking;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RoomBookingRepository extends JpaRepository<RoomBooking, Long> {
    boolean existsByRoomCodeIgnoreCase(String roomCode);

    Optional<RoomBooking> findByExternalSystemIgnoreCaseAndExternalReservationId(String externalSystem, String externalReservationId);

    @Query("""
            select rb
            from RoomBooking rb
            where lower(rb.externalSystem) = lower(:externalSystem)
              and lower(rb.roomCode) = lower(:roomCode)
              and rb.checkInAt >= :fromAt
              and rb.checkInAt < :toAt
            order by rb.checkInAt asc, rb.id asc
            """)
    List<RoomBooking> findExternalBookingsForRoomInRange(
            @Param("externalSystem") String externalSystem,
            @Param("roomCode") String roomCode,
            @Param("fromAt") LocalDateTime fromAt,
            @Param("toAt") LocalDateTime toAt
    );

    @Query("""
            select rb
            from RoomBooking rb
            where (:fromAt is null or rb.checkInAt < :toAt)
              and (:toAt is null or rb.checkOutAt > :fromAt)
            order by rb.roomCode asc, rb.checkInAt asc, rb.id asc
            """)
    List<RoomBooking> findInRange(
            @Param("fromAt") LocalDateTime fromAt,
            @Param("toAt") LocalDateTime toAt
    );

    @Query("""
            select count(rb) > 0
            from RoomBooking rb
            where lower(rb.roomCode) = lower(:roomCode)
              and rb.status <> com.luxurytravel.backend.roombooking.RoomBookingStatus.CANCELLED
              and (:excludeId is null or rb.id <> :excludeId)
              and rb.checkInAt < :checkOutAt
              and rb.checkOutAt > :checkInAt
            """)
    boolean existsOverlap(
            @Param("roomCode") String roomCode,
            @Param("checkInAt") LocalDateTime checkInAt,
            @Param("checkOutAt") LocalDateTime checkOutAt,
            @Param("excludeId") Long excludeId
    );
}
