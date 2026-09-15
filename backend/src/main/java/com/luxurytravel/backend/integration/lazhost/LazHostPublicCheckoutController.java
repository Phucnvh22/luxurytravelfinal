package com.luxurytravel.backend.integration.lazhost;

import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/public/lazhost")
public class LazHostPublicCheckoutController {
    private final LazHostPublicCheckoutService checkoutService;

    public LazHostPublicCheckoutController(LazHostPublicCheckoutService checkoutService) {
        this.checkoutService = checkoutService;
    }

    @GetMapping("/availability")
    public LazHostAvailabilityResponse availability(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut,
            @RequestParam(required = false) Integer adults
    ) {
        return checkoutService.searchAvailability(checkIn, checkOut, adults);
    }

    @PostMapping("/holds")
    @ResponseStatus(HttpStatus.CREATED)
    public LazHostHoldActionResponse createHold(@Valid @RequestBody LazHostHoldCreateRequest request) {
        return checkoutService.createHold(request);
    }

    @GetMapping("/holds/{holdId}")
    public LazHostHoldActionResponse getHold(@PathVariable String holdId) {
        return checkoutService.getHold(holdId);
    }

    @PostMapping("/holds/{holdId}/confirm")
    public LazHostHoldActionResponse confirmHold(@PathVariable String holdId, @Valid @RequestBody LazHostHoldConfirmRequest request) {
        return checkoutService.confirmHold(holdId, request);
    }

    @PostMapping("/holds/{holdId}/cancel")
    public LazHostHoldActionResponse cancelBooking(@PathVariable String holdId) {
        return checkoutService.cancelBooking(holdId);
    }

    @PostMapping("/holds/{holdId}/release")
    public LazHostHoldActionResponse releaseHold(@PathVariable String holdId) {
        return checkoutService.releaseHold(holdId);
    }
}
