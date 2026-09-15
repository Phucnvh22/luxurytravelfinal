package com.luxurytravel.backend.integration.lazhost;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class LazHostAvailabilityService {
    private final LazHostClient client;
    private final LazHostVillaTypeDashboardService dashboardService;

    public LazHostAvailabilityService(LazHostClient client, LazHostVillaTypeDashboardService dashboardService) {
        this.client = client;
        this.dashboardService = dashboardService;
    }

    @Transactional(readOnly = true)
    public JsonNode getAvailabilityRaw(String roomCode, String ratePlanCode, LocalDate checkIn, LocalDate checkOut, Integer adults) {
        validateDateRange(checkIn, checkOut);
        if (roomCode == null || roomCode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "roomCode is required");
        }
        return client.getAvailability(
                roomCode.trim(),
                ratePlanCode == null || ratePlanCode.isBlank() ? null : ratePlanCode.trim(),
                checkIn,
                checkOut,
                adults == null ? 1 : adults,
                "availability-" + roomCode.trim()
        );
    }

    @Transactional(readOnly = true)
    public LazHostAvailabilityResponse getPublicAvailability(LocalDate checkIn, LocalDate checkOut, Integer adults) {
        validateDateRange(checkIn, checkOut);
        LazHostVillaTypeDashboardResponse dashboard = dashboardService.load(checkIn, checkOut.minusDays(1));
        List<LazHostAvailabilityResponse.Item> items = new ArrayList<>();

        for (LazHostVillaTypeDashboardResponse.LazHostVillaTypeDashboardItem item : dashboard.items()) {
            if (!item.mappingActive() || item.lazHostRoomCode() == null || item.lazHostRoomCode().isBlank()) {
                continue;
            }
            JsonNode raw = client.getAvailability(
                    item.lazHostRoomCode(),
                    item.lazHostRatePlanCode(),
                    checkIn,
                    checkOut,
                    adults == null ? 1 : adults,
                    "public-availability-" + item.lazHostRoomCode()
            );
            long totalUnits = firstLong(raw, "data.availableInventory.totalUnits", "data.totalUnits", "totalUnits", "inventory.totalUnits");
            long availableUnits = firstLong(raw, "data.availableInventory.availableUnits", "data.availableUnits", "availableUnits", "inventory.availableUnits");
            boolean available = firstBoolean(raw, "data.available", "available", "data.availableInventory.available");
            if (!available && availableUnits > 0) {
                available = true;
            }
            Double totalPrice = firstDouble(raw, "data.totalPrice", "totalPrice", "price.total", "data.price.total");
            String currency = firstText(raw, "data.currency", "currency", "price.currency", "data.price.currency");
            if (currency == null || currency.isBlank()) {
                currency = item.currency();
            }

            items.add(new LazHostAvailabilityResponse.Item(
                    item.villaTypeCode(),
                    totalUnits,
                    availableUnits,
                    available,
                    item.lazHostRoomCode(),
                    item.lazHostRatePlanCode(),
                    totalPrice,
                    item.pmsPrice(),
                    item.otaPrice(),
                    currency
            ));
        }

        return new LazHostAvailabilityResponse(checkIn, checkOut, items);
    }

    private void validateDateRange(LocalDate checkIn, LocalDate checkOut) {
        if (checkIn == null || checkOut == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "checkIn and checkOut are required");
        }
        if (!checkOut.isAfter(checkIn)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "checkOut must be after checkIn");
        }
    }

    private String firstText(JsonNode root, String... paths) {
        if (paths == null) {
            return null;
        }
        for (String path : paths) {
            JsonNode node = at(root, path);
            if (node != null && !node.isNull()) {
                String value = node.asText();
                if (value != null && !value.isBlank()) {
                    return value.trim();
                }
            }
        }
        return null;
    }

    private long firstLong(JsonNode root, String... paths) {
        if (paths == null) {
            return 0L;
        }
        for (String path : paths) {
            JsonNode node = at(root, path);
            if (node != null && node.isNumber()) {
                return node.asLong();
            }
            if (node != null && !node.isNull()) {
                String value = node.asText();
                if (value != null && !value.isBlank()) {
                    try {
                        return Long.parseLong(value.trim());
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }
        return 0L;
    }

    private Double firstDouble(JsonNode root, String... paths) {
        if (paths == null) {
            return null;
        }
        for (String path : paths) {
            JsonNode node = at(root, path);
            if (node != null && node.isNumber()) {
                return node.asDouble();
            }
            if (node != null && !node.isNull()) {
                String value = node.asText();
                if (value != null && !value.isBlank()) {
                    try {
                        return Double.parseDouble(value.trim());
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }
        return null;
    }

    private boolean firstBoolean(JsonNode root, String... paths) {
        if (paths == null) {
            return false;
        }
        for (String path : paths) {
            JsonNode node = at(root, path);
            if (node != null && node.isBoolean()) {
                return node.asBoolean();
            }
            if (node != null && !node.isNull()) {
                String value = node.asText();
                if (value != null && !value.isBlank()) {
                    return Boolean.parseBoolean(value.trim());
                }
            }
        }
        return false;
    }

    private JsonNode at(JsonNode root, String path) {
        if (root == null || path == null || path.isBlank()) {
            return null;
        }
        JsonNode current = root;
        for (String part : path.split("\\.")) {
            if (current == null) {
                return null;
            }
            current = current.get(part);
        }
        return current;
    }
}
