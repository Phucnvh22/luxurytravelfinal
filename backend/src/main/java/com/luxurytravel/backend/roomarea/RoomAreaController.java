package com.luxurytravel.backend.roomarea;

import jakarta.validation.Valid;
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
@RequestMapping("/api/admin/room-areas")
public class RoomAreaController {
    private final RoomAreaService roomAreaService;

    public RoomAreaController(RoomAreaService roomAreaService) {
        this.roomAreaService = roomAreaService;
    }

    @GetMapping
    public List<RoomArea> list() {
        return roomAreaService.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomArea create(@Valid @RequestBody RoomAreaUpsertRequest request) {
        return roomAreaService.create(request);
    }

    @PutMapping("/{id}")
    public RoomArea update(@PathVariable Long id, @Valid @RequestBody RoomAreaUpsertRequest request) {
        return roomAreaService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        roomAreaService.delete(id);
    }
}
