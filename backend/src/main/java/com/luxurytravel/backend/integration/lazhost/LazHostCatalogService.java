package com.luxurytravel.backend.integration.lazhost;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class LazHostCatalogService {
    private static final String PROPERTY = "PROPERTY";
    private static final String ROOMS = "ROOMS";
    private static final String RATE_PLANS = "RATE_PLANS";

    private final LazHostClient client;
    private final LazHostCatalogSnapshotRepository snapshotRepository;
    private final ObjectMapper objectMapper;

    public LazHostCatalogService(
            LazHostClient client,
            LazHostCatalogSnapshotRepository snapshotRepository,
            ObjectMapper objectMapper
    ) {
        this.client = client;
        this.snapshotRepository = snapshotRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public JsonNode getPropertyLive() {
        return client.getProperty("catalog-property-live");
    }

    @Transactional(readOnly = true)
    public JsonNode getRoomsLive() {
        return fetchPagedCollection("catalog-rooms-live", CollectionType.ROOMS);
    }

    @Transactional(readOnly = true)
    public JsonNode getRatePlansLive() {
        return fetchPagedCollection("catalog-rate-plans-live", CollectionType.RATE_PLANS);
    }

    @Transactional(readOnly = true)
    public JsonNode getBookingLive(String externalBookingId) {
        return client.getBooking(externalBookingId, "booking-live-" + externalBookingId);
    }

    @Transactional
    public LazHostCatalogCacheResponse refreshCache(String source) {
        Instant refreshedAt = Instant.now();
        saveSnapshot(PROPERTY, source, client.getProperty("catalog-property-refresh"), refreshedAt);
        saveSnapshot(ROOMS, source, fetchPagedCollection("catalog-rooms-refresh", CollectionType.ROOMS), refreshedAt);
        saveSnapshot(RATE_PLANS, source, fetchPagedCollection("catalog-rate-plans-refresh", CollectionType.RATE_PLANS), refreshedAt);
        return getCachedCatalog();
    }

    @Transactional(readOnly = true)
    public LazHostCatalogCacheResponse getCachedCatalog() {
        List<LazHostCatalogSnapshotResponse> snapshots = snapshotRepository.findAll().stream()
                .sorted(Comparator.comparing(LazHostCatalogSnapshot::getSnapshotType))
                .map(snapshot -> new LazHostCatalogSnapshotResponse(
                        snapshot.getSnapshotType(),
                        snapshot.getSource(),
                        snapshot.getRefreshedAt(),
                        parsePayload(snapshot.getPayload())
                ))
                .toList();
        return new LazHostCatalogCacheResponse(snapshots);
    }

    private JsonNode fetchPagedCollection(String requestIdPrefix, CollectionType type) {
        ArrayNode items = objectMapper.createArrayNode();
        String cursor = null;
        int page = 0;
        while (true) {
            JsonNode response = type == CollectionType.ROOMS
                    ? client.getRooms(cursor, 100, requestIdPrefix + "-" + page)
                    : client.getRatePlans(cursor, 100, requestIdPrefix + "-" + page);
            appendItems(items, response);
            String nextCursor = textAt(response, "meta.nextCursor");
            if (nextCursor == null || nextCursor.isBlank()) {
                ObjectNode root = objectMapper.createObjectNode();
                root.put("count", items.size());
                root.set("items", items);
                return root;
            }
            cursor = nextCursor;
            page++;
        }
    }

    private void appendItems(ArrayNode items, JsonNode response) {
        List<JsonNode> nodes = new ArrayList<>();
        JsonNode data = response == null ? null : response.get("data");
        if (data != null && data.isArray()) {
            data.forEach(nodes::add);
        } else {
            JsonNode nestedItems = response == null ? null : response.get("items");
            if (nestedItems != null && nestedItems.isArray()) {
                nestedItems.forEach(nodes::add);
            }
        }
        nodes.forEach(items::add);
    }

    private void saveSnapshot(String type, String source, JsonNode payload, Instant refreshedAt) {
        LazHostCatalogSnapshot snapshot = snapshotRepository.findBySnapshotTypeIgnoreCase(type)
                .orElseGet(LazHostCatalogSnapshot::new);
        snapshot.setSnapshotType(type);
        snapshot.setSource(normalizeSource(source));
        snapshot.setPayload(toJson(payload));
        snapshot.setRefreshedAt(refreshedAt);
        snapshotRepository.save(snapshot);
    }

    private String normalizeSource(String source) {
        if (source == null || source.isBlank()) {
            return "MANUAL";
        }
        return source.trim().toUpperCase();
    }

    private JsonNode parsePayload(String payload) {
        try {
            return objectMapper.readTree(payload == null || payload.isBlank() ? "{}" : payload);
        } catch (Exception ex) {
            ObjectNode fallback = objectMapper.createObjectNode();
            fallback.put("raw", payload == null ? "" : payload);
            return fallback;
        }
    }

    private String toJson(JsonNode payload) {
        try {
            return objectMapper.writeValueAsString(payload == null ? objectMapper.createObjectNode() : payload);
        } catch (Exception ex) {
            return "{}";
        }
    }

    private String textAt(JsonNode root, String path) {
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
        if (current == null || current.isNull()) {
            return null;
        }
        String value = current.asText();
        return value == null || value.isBlank() ? null : value.trim();
    }

    private enum CollectionType {
        ROOMS,
        RATE_PLANS
    }
}
