package com.luxurytravel.backend.maintenance;

import com.luxurytravel.backend.room.Room;
import com.luxurytravel.backend.room.RoomService;
import com.luxurytravel.backend.user.User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/maintenance/rooms")
public class MaintenanceRoomController {
    private final RoomService roomService;

    public MaintenanceRoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @GetMapping
    public List<Room> listNeedsRepair() {
        return roomService.findNeedsRepair().stream()
                .sorted(Comparator.comparing(Room::getRepairReportedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(Room::getLocation, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(Room::getCode, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
    }

    @PostMapping("/{id}/done")
    public Room resolveRepair(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return roomService.resolveRepair(id, user);
    }
}
