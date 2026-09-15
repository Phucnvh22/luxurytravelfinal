package com.luxurytravel.backend.integration.lazhost;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
public class LazHostPublicCheckoutService {
    private final LazHostAvailabilityService availabilityService;
    private final LazHostHoldService holdService;

    public LazHostPublicCheckoutService(LazHostAvailabilityService availabilityService, LazHostHoldService holdService) {
        this.availabilityService = availabilityService;
        this.holdService = holdService;
    }

    @Transactional(readOnly = true)
    public LazHostAvailabilityResponse searchAvailability(LocalDate checkIn, LocalDate checkOut, Integer adults) {
        return availabilityService.getPublicAvailability(checkIn, checkOut, adults);
    }

    @Transactional
    public LazHostHoldActionResponse createHold(LazHostHoldCreateRequest request) {
        return LazHostHoldActionResponse.from(holdService.createHold(request), "", "Hold created");
    }

    @Transactional(readOnly = true)
    public LazHostHoldActionResponse getHold(String holdId) {
        return LazHostHoldActionResponse.from(holdService.getHold(holdId), "", "Hold loaded");
    }

    @Transactional
    public LazHostHoldActionResponse confirmHold(String holdId, LazHostHoldConfirmRequest request) {
        return holdService.confirmHold(holdId, request);
    }

    @Transactional
    public LazHostHoldActionResponse cancelBooking(String holdId) {
        return holdService.cancelConfirmedBooking(holdId);
    }

    @Transactional
    public LazHostHoldActionResponse releaseHold(String holdId) {
        return LazHostHoldActionResponse.from(holdService.releaseHold(holdId), "", "Hold released");
    }
}
