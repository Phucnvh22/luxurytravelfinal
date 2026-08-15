package com.luxurytravel.backend.roombooking;

import jakarta.validation.constraints.NotBlank;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/public/room-calendar")
public class PublicRoomCalendarController {
    private final RoomBookingService roomBookingService;

    public PublicRoomCalendarController(RoomBookingService roomBookingService) {
        this.roomBookingService = roomBookingService;
    }

    @GetMapping
    public PublicRoomCalendarResponse list(
            @RequestParam List<@NotBlank String> roomCodes,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return roomBookingService.listPublic(roomCodes, from, to);
    }
}
