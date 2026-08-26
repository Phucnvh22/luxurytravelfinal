package com.luxurytravel.backend.roomlog;

import com.luxurytravel.backend.user.Role;

import java.time.Instant;

public record RoomWorkLogResponse(
        Long id,
        Long roomId,
        String roomCode,
        String roomName,
        RoomWorkLogAction action,
        String actorUsername,
        String actorName,
        Role actorRole,
        String details,
        Instant occurredAt
) {
    public static RoomWorkLogResponse from(RoomWorkLog log) {
        return new RoomWorkLogResponse(
                log.getId(),
                log.getRoomId(),
                log.getRoomCode(),
                log.getRoomName(),
                log.getAction(),
                log.getActorUsername(),
                log.getActorName(),
                log.getActorRole(),
                log.getDetails(),
                log.getOccurredAt()
        );
    }
}
