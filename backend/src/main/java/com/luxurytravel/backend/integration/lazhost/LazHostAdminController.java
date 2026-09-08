package com.luxurytravel.backend.integration.lazhost;

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
@RequestMapping("/api/admin/integrations/lazhost")
public class LazHostAdminController {
    private final LazHostSyncService syncService;
    private final LazHostVillaMappingService mappingService;

    public LazHostAdminController(LazHostSyncService syncService, LazHostVillaMappingService mappingService) {
        this.syncService = syncService;
        this.mappingService = mappingService;
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

    @PostMapping("/sync/room-bookings/{bookingId}")
    public LazHostSyncLog syncRoomBooking(@PathVariable Long bookingId) {
        return syncService.syncBooking(bookingId);
    }
}
