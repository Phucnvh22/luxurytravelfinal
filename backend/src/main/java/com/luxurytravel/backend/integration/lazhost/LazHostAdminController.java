package com.luxurytravel.backend.integration.lazhost;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.format.annotation.DateTimeFormat;
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
@RequestMapping("/api/admin/integrations/lazhost")
public class LazHostAdminController {
    private final LazHostSyncService syncService;
    private final LazHostVillaMappingService mappingService;
    private final LazHostCatalogService catalogService;
    private final LazHostAvailabilityService availabilityService;

    public LazHostAdminController(
            LazHostSyncService syncService,
            LazHostVillaMappingService mappingService,
            LazHostCatalogService catalogService,
            LazHostAvailabilityService availabilityService
    ) {
        this.syncService = syncService;
        this.mappingService = mappingService;
        this.catalogService = catalogService;
        this.availabilityService = availabilityService;
    }

    @GetMapping("/status")
    public LazHostConnectionStatusResponse status() {
        return syncService.getConnectionStatus();
    }

    @GetMapping("/villa-mappings")
    public List<LazHostVillaMapping> listMappings() {
        return mappingService.list();
    }

    @PostMapping("/villa-mappings")
    @ResponseStatus(HttpStatus.CREATED)
    public LazHostVillaMapping createMapping(@Valid @RequestBody LazHostVillaMappingUpsertRequest request) {
        return mappingService.create(request);
    }

    @PutMapping("/villa-mappings/{id}")
    public LazHostVillaMapping updateMapping(@PathVariable Long id, @Valid @RequestBody LazHostVillaMappingUpsertRequest request) {
        return mappingService.update(id, request);
    }

    @DeleteMapping("/villa-mappings/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMapping(@PathVariable Long id) {
        mappingService.delete(id);
    }

    @GetMapping("/sync-logs")
    public List<LazHostSyncLog> listSyncLogs() {
        return syncService.listRecentSyncLogs();
    }

    @GetMapping("/webhook-events")
    public List<LazHostWebhookEvent> listWebhookEvents() {
        return syncService.listRecentWebhookEvents();
    }

    @GetMapping("/property/live")
    public JsonNode propertyLive() {
        return catalogService.getPropertyLive();
    }

    @GetMapping("/rooms/live")
    public JsonNode roomsLive() {
        return catalogService.getRoomsLive();
    }

    @GetMapping("/rate-plans/live")
    public JsonNode ratePlansLive() {
        return catalogService.getRatePlansLive();
    }

    @GetMapping("/bookings/live/{externalBookingId}")
    public JsonNode bookingLive(@PathVariable String externalBookingId) {
        return catalogService.getBookingLive(externalBookingId);
    }

    @GetMapping("/availability/live")
    public JsonNode availabilityLive(
            @RequestParam String roomCode,
            @RequestParam(required = false) String ratePlanCode,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut,
            @RequestParam(required = false) Integer adults
    ) {
        return availabilityService.getAvailabilityRaw(roomCode, ratePlanCode, checkIn, checkOut, adults);
    }

    @GetMapping("/catalog/cache")
    public LazHostCatalogCacheResponse catalogCache() {
        return catalogService.getCachedCatalog();
    }

    @PostMapping("/catalog/refresh")
    public LazHostCatalogCacheResponse refreshCatalog() {
        return catalogService.refreshCache("ADMIN");
    }

    @PostMapping("/sync/room-bookings/{bookingId}")
    public LazHostSyncLog syncRoomBooking(@PathVariable Long bookingId) {
        return syncService.syncBooking(bookingId);
    }
}
