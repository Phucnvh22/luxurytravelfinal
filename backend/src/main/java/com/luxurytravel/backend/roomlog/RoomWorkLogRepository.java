package com.luxurytravel.backend.roomlog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoomWorkLogRepository extends JpaRepository<RoomWorkLog, Long> {
    List<RoomWorkLog> findTop100ByOrderByOccurredAtDesc();

    List<RoomWorkLog> findTop100ByActorUsernameIgnoreCaseOrderByOccurredAtDesc(String actorUsername);
}
