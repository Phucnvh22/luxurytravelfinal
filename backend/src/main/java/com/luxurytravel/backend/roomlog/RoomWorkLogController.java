package com.luxurytravel.backend.roomlog;

import com.luxurytravel.backend.user.User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class RoomWorkLogController {
    private final RoomWorkLogService roomWorkLogService;

    public RoomWorkLogController(RoomWorkLogService roomWorkLogService) {
        this.roomWorkLogService = roomWorkLogService;
    }

    @GetMapping("/api/admin/room-work-logs")
    public List<RoomWorkLogResponse> listAdminLogs(
            @RequestParam(name = "mineOnly", defaultValue = "false") boolean mineOnly,
            @RequestParam(name = "roomCode", required = false) String roomCode,
            @RequestParam(name = "actorUsername", required = false) String actorUsername,
            @AuthenticationPrincipal User user
    ) {
        if (mineOnly && user != null) {
            return roomWorkLogService.listRecentFiltered(roomCode, user.getUsername());
        }
        return roomWorkLogService.listRecentFiltered(roomCode, actorUsername);
    }

    @GetMapping("/api/cleaner/room-work-logs")
    public List<RoomWorkLogResponse> listCleanerLogs(
            @RequestParam(name = "roomCode", required = false) String roomCode,
            @AuthenticationPrincipal User user
    ) {
        return user == null ? List.of() : roomWorkLogService.listRecentFiltered(roomCode, user.getUsername());
    }

    @GetMapping("/api/maintenance/room-work-logs")
    public List<RoomWorkLogResponse> listMaintenanceLogs(
            @RequestParam(name = "roomCode", required = false) String roomCode,
            @AuthenticationPrincipal User user
    ) {
        return user == null ? List.of() : roomWorkLogService.listRecentFiltered(roomCode, user.getUsername());
    }
}
