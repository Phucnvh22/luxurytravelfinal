package com.luxurytravel.backend.integration.ezcloud;

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
@RequestMapping("/api/admin/integrations/ezcloud")
public class EzCloudAdminController {
    private final EzCloudSyncService syncService;
    private final EzCloudRoomMappingService mappingService;

    public EzCloudAdminController(EzCloudSyncService syncService, EzCloudRoomMappingService mappingService) {
        this.syncService = syncService;
        this.mappingService = mappingService;
    }

    @GetMapping("/status")
    public EzCloudConnectionStatusResponse status() {
        return syncService.getConnectionStatus();
    }

    @GetMapping("/room-mappings")
    public List<EzCloudRoomMapping> listMappings() {
        return mappingService.list();
    }

    @PostMapping("/room-mappings")
    @ResponseStatus(HttpStatus.CREATED)
    public EzCloudRoomMapping createMapping(@Valid @RequestBody EzCloudRoomMappingUpsertRequest request) {
        return mappingService.create(request);
    }

    @PutMapping("/room-mappings/{id}")
    public EzCloudRoomMapping updateMapping(@PathVariable Long id, @Valid @RequestBody EzCloudRoomMappingUpsertRequest request) {
        return mappingService.update(id, request);
    }

    @DeleteMapping("/room-mappings/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMapping(@PathVariable Long id) {
        mappingService.delete(id);
    }

    @GetMapping("/sync-logs")
    public List<EzCloudSyncLog> listSyncLogs() {
        return syncService.listRecentSyncLogs();
    }

    @GetMapping("/webhook-events")
    public List<EzCloudWebhookEvent> listWebhookEvents() {
        return syncService.listRecentWebhookEvents();
    }

    @PostMapping("/sync/room-bookings/{bookingId}")
    public EzCloudSyncLog syncRoomBooking(@PathVariable Long bookingId) {
        return syncService.syncBooking(bookingId);
    }

    @PostMapping("/pull-reservations")
    public EzCloudSyncLog pullReservations(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return syncService.pullReservations(from, to);
    }
}
