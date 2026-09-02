package com.luxurytravel.backend.villaservice;

import java.time.Instant;

public record VillaServiceLogResponse(
        Long id,
        String targetType,
        Long targetId,
        String action,
        String actorUsername,
        String actorName,
        String details,
        Instant occurredAt
) {
    public static VillaServiceLogResponse from(VillaServiceLog log) {
        return new VillaServiceLogResponse(
                log.getId(),
                log.getTargetType(),
                log.getTargetId(),
                log.getAction(),
                log.getActorUsername(),
                log.getActorName(),
                log.getDetails(),
                log.getOccurredAt()
        );
    }
}
