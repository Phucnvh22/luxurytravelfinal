package com.luxurytravel.backend.room;

import jakarta.validation.Valid;
import com.luxurytravel.backend.user.User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/rooms")
public class RoomController {
    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @GetMapping
    public List<Room> list() {
        return roomService.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Room create(@Valid @RequestBody RoomUpsertRequest request) {
        return roomService.create(request);
    }

    @PutMapping("/{id}")
    public Room update(@PathVariable Long id, @Valid @RequestBody RoomUpsertRequest request) {
        return roomService.update(id, request);
    }

    @PostMapping("/{id}/mark-ready")
    public Room markReady(@PathVariable Long id, @AuthenticationPrincipal User user) {
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

    @PostMapping("/{id}/resolve-repair")
    public Room resolveRepair(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return roomService.resolveRepair(id, user);
    }

    @PostMapping("/{id}/mark-ooi")
    public Room markOutOfInventory(
            @PathVariable Long id,
            @Valid @RequestBody RoomOOIRequest request,
            @AuthenticationPrincipal User user
    ) {
        return roomService.markOutOfInventory(id, request.getDetails(), user);
    }

    @PostMapping("/{id}/clear-ooi")
    public Room clearOutOfInventory(@PathVariable Long id, @AuthenticationPrincipal User user) {
        return roomService.clearOutOfInventory(id, user);
    }

    @PostMapping("/{id}/assign-cleaner")
    public Room assignCleaner(@PathVariable Long id, @RequestBody RoomCleanerAssignmentRequest request) {
        return roomService.assignCleaner(id, request == null ? null : request.getCleanerId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        roomService.delete(id);
    }
}
