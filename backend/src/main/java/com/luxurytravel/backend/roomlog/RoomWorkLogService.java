package com.luxurytravel.backend.roomlog;

import com.luxurytravel.backend.room.Room;
import com.luxurytravel.backend.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RoomWorkLogService {
    private final RoomWorkLogRepository roomWorkLogRepository;

    public RoomWorkLogService(RoomWorkLogRepository roomWorkLogRepository) {
        this.roomWorkLogRepository = roomWorkLogRepository;
    }

    @Transactional
    public void log(Room room, RoomWorkLogAction action, User actor, String details) {
        if (room == null || actor == null) {
            return;
        }

        RoomWorkLog log = new RoomWorkLog();
        log.setRoomId(room.getId());
        log.setRoomCode(room.getCode());
        log.setRoomName(room.getName());
        log.setAction(action);
        log.setActorUsername(actor.getUsername());
        log.setActorName(actor.getFullName());
        log.setActorRole(actor.getRole());
        log.setDetails(details == null ? "" : details.trim());
        roomWorkLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public List<RoomWorkLogResponse> listRecent() {
        return listRecentFiltered(null, null);
    }

    @Transactional(readOnly = true)
    public List<RoomWorkLogResponse> listRecentByActor(String username) {
        return listRecentFiltered(null, username);
    }

    @Transactional(readOnly = true)
    public List<RoomWorkLogResponse> listRecentFiltered(String roomCode, String actorUsername) {
        String normalizedRoomCode = roomCode == null ? "" : roomCode.trim();
        String normalizedActorUsername = actorUsername == null ? "" : actorUsername.trim();

        return roomWorkLogRepository.findTop100ByOrderByOccurredAtDesc().stream()
                .filter(log -> normalizedRoomCode.isBlank() || log.getRoomCode().equalsIgnoreCase(normalizedRoomCode))
                .filter(log -> normalizedActorUsername.isBlank() || log.getActorUsername().equalsIgnoreCase(normalizedActorUsername))
                .map(RoomWorkLogResponse::from)
                .toList();
    }
}
