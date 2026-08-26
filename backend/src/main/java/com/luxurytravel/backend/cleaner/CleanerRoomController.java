package com.luxurytravel.backend.cleaner;

import com.luxurytravel.backend.room.Room;
import com.luxurytravel.backend.room.RoomRepairRequest;
import com.luxurytravel.backend.room.RoomService;
import jakarta.validation.Valid;
import com.luxurytravel.backend.user.User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/cleaner/rooms")
public class CleanerRoomController {
    private final RoomService roomService;

    public CleanerRoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @GetMapping
    public List<Room> listNeedsCleaning(@AuthenticationPrincipal User user) {
        return roomService.findNeedsCleaningForCleaner(user).stream()
                .sorted(Comparator.comparing(Room::getCleaningRequestedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(Room::getLocation, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(Room::getCode, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
    }

    @PostMapping("/{id}/done")
    public Room markDone(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return roomService.markReady(id, user);
    }

    @PostMapping("/{id}/report-repair")
    public Room reportRepair(
            @PathVariable Long id,
            @Valid @RequestBody RoomRepairRequest request,
            @AuthenticationPrincipal User user
    ) {
        return roomService.reportRepair(id, request.getDetails(), user);
    }
}
