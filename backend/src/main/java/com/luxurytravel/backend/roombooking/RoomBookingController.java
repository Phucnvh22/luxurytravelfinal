package com.luxurytravel.backend.roombooking;

import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/admin/room-bookings")
public class RoomBookingController {
    private final RoomBookingService roomBookingService;

    public RoomBookingController(RoomBookingService roomBookingService) {
        this.roomBookingService = roomBookingService;
    }

    @GetMapping
    public List<RoomBookingResponse> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return roomBookingService.list(from, to);
    }

    @GetMapping("/{id}")
    public RoomBookingResponse get(@PathVariable Long id) {
        return roomBookingService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomBookingResponse create(@Valid @RequestBody RoomBookingRequest request) {
        return roomBookingService.create(request);
    }

    @PutMapping("/{id}")
    public RoomBookingResponse update(@PathVariable Long id, @Valid @RequestBody RoomBookingRequest request) {
        return roomBookingService.update(id, request);
    }

    @PostMapping("/{id}/check-in")
    public RoomBookingResponse markCheckIn(@PathVariable Long id) {
        return roomBookingService.markCheckIn(id);
    }

    @PostMapping("/{id}/check-out")
    public RoomBookingResponse markCheckOut(@PathVariable Long id) {
        return roomBookingService.markCheckOut(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        roomBookingService.delete(id);
    }
}
