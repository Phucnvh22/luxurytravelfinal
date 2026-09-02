package com.luxurytravel.backend.villaservice;

import com.luxurytravel.backend.user.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class VillaServiceOrderController {
    private final VillaServiceOrderService villaServiceOrderService;

    public VillaServiceOrderController(VillaServiceOrderService villaServiceOrderService) {
        this.villaServiceOrderService = villaServiceOrderService;
    }

    @GetMapping("/api/admin/villa-service-orders")
    public List<VillaServiceOrderResponse> list(
            @RequestParam(required = false) String orderType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String query
    ) {
        return villaServiceOrderService.list(orderType, status, query);
    }

    @PostMapping("/api/admin/villa-service-orders")
    @ResponseStatus(HttpStatus.CREATED)
    public VillaServiceOrderResponse createStandaloneOrder(
            @Valid @RequestBody VillaServiceOrderUpsertRequest request,
            @AuthenticationPrincipal User user
    ) {
        return villaServiceOrderService.createStandaloneOrder(request, user);
    }

    @PutMapping("/api/admin/villa-service-orders/{id}")
    public VillaServiceOrderResponse updateStandaloneOrder(
            @PathVariable Long id,
            @Valid @RequestBody VillaServiceOrderUpsertRequest request,
            @AuthenticationPrincipal User user
    ) {
        return villaServiceOrderService.updateStandaloneOrder(id, request, user);
    }

    @PutMapping("/api/admin/villa-service-orders/{id}/status")
    public VillaServiceOrderResponse updateOrderStatus(
            @PathVariable Long id,
            @Valid @RequestBody VillaServiceOrderStatusRequest request,
            @AuthenticationPrincipal User user
    ) {
        return villaServiceOrderService.updateOrderStatus(id, request.getStatus(), user);
    }

    @DeleteMapping("/api/admin/villa-service-orders/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteOrder(
            @PathVariable Long id,
            @AuthenticationPrincipal User user
    ) {
        villaServiceOrderService.deleteOrder(id, user);
    }

    @GetMapping("/api/admin/room-bookings/{bookingId}/service-order")
    public VillaServiceBookingOrderResponse getBookingOrder(@PathVariable Long bookingId) {
        return villaServiceOrderService.getBookingOrder(bookingId);
    }

    @PutMapping("/api/admin/room-bookings/{bookingId}/service-order")
    public VillaServiceBookingOrderResponse saveBookingOrder(
            @PathVariable Long bookingId,
            @Valid @RequestBody VillaServiceOrderUpsertRequest request,
            @AuthenticationPrincipal User user
    ) {
        return villaServiceOrderService.saveBookingOrder(bookingId, request, user);
    }
}
