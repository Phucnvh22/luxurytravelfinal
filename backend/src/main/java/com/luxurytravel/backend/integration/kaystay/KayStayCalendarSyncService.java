package com.luxurytravel.backend.integration.kaystay;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.luxurytravel.backend.room.Room;
import com.luxurytravel.backend.room.RoomRepository;
import com.luxurytravel.backend.roombooking.RoomBooking;
import com.luxurytravel.backend.roombooking.RoomBookingRepository;
import com.luxurytravel.backend.roombooking.RoomBookingStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class KayStayCalendarSyncService {
    static final String SYSTEM_NAME = "KAYSTAY_SMARTORDER";
    static final String BLOCK_SOURCE = "KayStay";
    private static final Pattern ROOM_CODE_PATTERN = Pattern.compile("\\b([A-Z]-?\\d{2,6}(?:[A-Z])?)\\b");
    private static final String H5_API_V2 = "/pms-h5-app-api/v2";
    private static final String ENDPOINT_ROOM_LIST = "/core/pro/wap/accomLink/grid/roomList/public";
    private static final String ENDPOINT_ORDER = "/core/pro/wap/accomLink/grid/order/public";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final DateTimeFormatter SMARTORDER_DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String DEBUG_ENV_FILE = ".dbg/kaystay-sync-errors.env";
    private static final String DEBUG_FALLBACK_URL = "http://127.0.0.1:7777/event";
    private static final String DEBUG_SESSION_ID = "kaystay-sync-errors";

    private final Logger log = LoggerFactory.getLogger(KayStayCalendarSyncService.class);
    private final RoomRepository roomRepository;
    private final RoomBookingRepository roomBookingRepository;
    private final KayStaySyncProperties properties;
    private final HttpClient httpClient;

    public KayStayCalendarSyncService(
            RoomRepository roomRepository,
            RoomBookingRepository roomBookingRepository,
            KayStaySyncProperties properties
    ) {
        this.roomRepository = roomRepository;
        this.roomBookingRepository = roomBookingRepository;
        this.properties = properties;
        this.httpClient = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofMillis(Math.max(1_000L, properties.getTimeoutMs())))
                .build();
    }

    @Scheduled(
            fixedDelayString = "${application.integrations.kaystay-sync.fixed-delay-ms:7200000}",
            initialDelayString = "${application.integrations.kaystay-sync.initial-delay-ms:120000}"
    )
    public void scheduledSync() {
        if (!properties.isEnabled() || !properties.isAutoEnabled()) {
            return;
        }
        KayStaySyncRunResponse result = runSync(null, false, null, null);
        if (!result.success()) {
            log.warn("KayStay sync completed with issues: {}", result.message());
        }
    }

    public KayStaySyncRunResponse syncNow(String roomCode, LocalDate from, LocalDate to) {
        return runSync(roomCode, true, from, to);
    }

    private KayStaySyncRunResponse runSync(String roomCode, boolean includeLogs, LocalDate requestedFrom, LocalDate requestedTo) {
        List<String> logs = new ArrayList<>();
        if (!properties.isEnabled()) {
            logs.add("KayStay sync is disabled in configuration.");
            return new KayStaySyncRunResponse(false, "KayStay sync is disabled.", logs);
        }
        String reviewCode = properties.getPremierReviewCode();
        if (reviewCode == null || reviewCode.isBlank()) {
            logs.add("Missing premierReviewCode is not configured for KayStay.");
            return new KayStaySyncRunResponse(false, "Missing KayStay premierReviewCode configuration.", logs);
        }

        LocalDate today = LocalDate.now(ZoneId.of(properties.getZoneId()));
        LocalDate syncFrom = requestedFrom != null ? requestedFrom : today;
        LocalDate inclusiveTo = requestedTo != null ? requestedTo : today.plusDays(Math.max(1, properties.getHorizonDays()) - 1L);
        if (inclusiveTo.isBefore(syncFrom)) {
            logs.add("Invalid sync range: 'to' is before 'from'.");
            return new KayStaySyncRunResponse(false, "Invalid KayStay sync range.", logs);
        }
        LocalDate syncUntilExclusive = inclusiveTo.plusDays(1);

        logs.add("KayStay sync range: " + syncFrom + " -> " + inclusiveTo + " (reviewCode " + reviewCode);
        // #region debug-point A:run-sync-start
        debugReport("pre-fix", "A", "KayStayCalendarSyncService:112", "[DEBUG] runSync start", Map.of(
                "roomCode", roomCode == null ? "" : roomCode,
                "syncFrom", syncFrom.toString(),
                "syncTo", inclusiveTo.toString(),
                "reviewCode", reviewCode
        ));
        // #endregion

        // 1. Fetch room list from SmartOrder -> map smartOrder roomId -> smartRoomName (V332...)
        Map<String, String> smartRoomIdToName;
        try {
            smartRoomIdToName = fetchSmartOrderRoomList(reviewCode, syncFrom, inclusiveTo, includeLogs ? logs : null);
        } catch (IOException | InterruptedException ex) {
            logs.add("Failed to fetch KayStay room list: " + ex.getMessage());
            log.warn("KayStay room list fetch failed", ex);
            return new KayStaySyncRunResponse(false, "KayStay room list fetch failed.", logs);
        }

        // Map smart room name (V3xx) -> our DB Room entity (via room code)
        Map<String, Room> matchedRoomsBySmartRoomId = new HashMap<>();
        Map<String, String> unmatchedSmartNames = new HashMap<>();
        for (Map.Entry<String, String> entry : smartRoomIdToName.entrySet()) {
            String smartRoomId = entry.getKey();
            String smartRoomName = entry.getValue();
            Optional<String> roomCodeOpt = extractRoomCode(smartRoomName);
            if (roomCodeOpt.isEmpty()) {
                unmatchedSmartNames.put(smartRoomId, smartRoomName);
                continue;
            }
            String extractedCode = roomCodeOpt.get();
            Optional<Room> roomOpt = roomRepository.findByCodeIgnoreCase(extractedCode)
                    .filter(Room::isActive);
            if (roomOpt.isEmpty()) {
                unmatchedSmartNames.put(smartRoomId, smartRoomName + " (code " + extractedCode + " not in DB)");
                continue;
            }
            matchedRoomsBySmartRoomId.put(smartRoomId, roomOpt.get());
        }

        if (matchedRoomsBySmartRoomId.isEmpty()) {
            logs.add("No KayStay rooms matched our villa DB. SmartOrder names: " + unmatchedSmartNames.values());
            return new KayStaySyncRunResponse(false, "No villa matched with KayStay rooms.", logs);
        }
        logs.add("Matched " + matchedRoomsBySmartRoomId.size() + " KayStay rooms with DB villas. Unmatched skipped: " + unmatchedSmartNames.size());
        // #region debug-point D:room-match-summary
        debugReport("pre-fix", "D", "KayStayCalendarSyncService:149", "[DEBUG] room match summary", Map.of(
                "smartRoomCount", smartRoomIdToName.size(),
                "matchedRoomCount", matchedRoomsBySmartRoomId.size(),
                "unmatchedRoomCount", unmatchedSmartNames.size(),
                "unmatchedPreview", unmatchedSmartNames.values().stream().limit(5).toList().toString()
        ));
        // #endregion

        // Filter by roomCode if specified
        List<Map.Entry<String, Room>> targetEntries;
        if (roomCode != null && !roomCode.isBlank()) {
            String normalized = roomCode.trim().toUpperCase(Locale.ROOT);
            Optional<Map.Entry<String, Room>> found = matchedRoomsBySmartRoomId.entrySet().stream()
                    .filter(e -> normalized.equalsIgnoreCase(e.getValue().getCode()))
                    .findFirst();
            if (found.isEmpty()) {
                logs.add("Villa " + normalized + " not found in KayStay matched rooms.");
                return new KayStaySyncRunResponse(false, "Villa not matched for KayStay sync.", logs);
            }
            targetEntries = List.of(found.get());
        } else {
            Set<String> allowedCodes = properties.getRoomCodes().stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .map(String::toUpperCase)
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toSet());
            targetEntries = matchedRoomsBySmartRoomId.entrySet().stream()
                    .filter(e -> allowedCodes.isEmpty() || allowedCodes.contains(e.getValue().getCode().toUpperCase(Locale.ROOT)))
                    .toList();
        }
        Set<String> targetSmartRoomIds = targetEntries.stream().map(Map.Entry::getKey).collect(Collectors.toSet());

        // 2. Fetch orders (bookings from KayStay /grid/order/public
        List<SmartOrderBooking> orders;
        try {
            orders = fetchSmartOrderBookings(reviewCode, syncFrom, inclusiveTo, targetSmartRoomIds, includeLogs ? logs : null);
        } catch (IOException | InterruptedException ex) {
            logs.add("Failed to fetch KayStay bookings: " + ex.getMessage());
            log.warn("KayStay bookings fetch failed", ex);
            return new KayStaySyncRunResponse(false, "KayStay bookings fetch failed.", logs);
        }
        logs.add("Fetched " + orders.size() + " reservation(s) from KayStay SmartOrder.");

        // 3. Per matched room -> apply orders -> KAYSTAY_BLOCK for each day in range
        SyncStats stats = new SyncStats();
        for (Map.Entry<String, Room> entry : targetEntries) {
            String smartRoomId = entry.getKey();
            Room room = entry.getValue();
            try {
                applyRoomBookings(room, smartRoomId, syncFrom, syncUntilExclusive, orders, stats, includeLogs ? logs : null);
            } catch (Exception ex) {
                stats.errorCount++;
                String msg = "Failed to apply KayStay bookings for " + room.getCode() + ": " + ex.getMessage();
                logs.add(msg);
                log.warn(msg, ex);
                // #region debug-point A:apply-room-error
                debugReport("pre-fix", "A", "KayStayCalendarSyncService:198", "[DEBUG] applyRoomBookings failed", Map.of(
                        "roomCode", room.getCode(),
                        "smartRoomId", smartRoomId,
                        "exceptionType", ex.getClass().getName(),
                        "exceptionMessage", ex.getMessage() == null ? "" : ex.getMessage()
                ));
                // #endregion
            }
        }

        String summary = "KayStay sync finished: "
                + targetEntries.size() + " villa(s), "
                + stats.blockedDays + " blocked days, "
                + stats.releasedDays + " released days, "
                + stats.orderCount + " reservation(s) processed, "
                + stats.errorCount + " error(s).";
        logs.add(summary);
        return new KayStaySyncRunResponse(stats.errorCount == 0, summary, logs);
    }

    private void applyRoomBookings(Room room, String smartRoomId, LocalDate syncFrom, LocalDate syncUntilExclusive, List<SmartOrderBooking> allOrders, SyncStats stats, List<String> logs) {
        // Gather set of blocked days occupied by ANY KayStay for this room (CI <= day < CO
        Set<LocalDate> blockedDaysSet = new HashSet<>();
        List<SmartOrderBooking> roomOrders = allOrders.stream()
                .filter(o -> smartRoomId.equals(o.smartRoomId)).toList();
        stats.orderCount += roomOrders.size();
        StringBuilder sbNotes = new StringBuilder();
        for (SmartOrderBooking order : roomOrders) {
            LocalDate start = order.checkInDate().toLocalDate();
            LocalDate endExclusive = order.checkOutDate().toLocalDate();
            if (endExclusive.isBefore(start)) {
                continue;
            }
            for (LocalDate d = start; d.isBefore(endExclusive); d = d.plusDays(1)) {
                if (!d.isBefore(syncFrom) && d.isBefore(syncUntilExclusive)) {
                    blockedDaysSet.add(d);
                }
            }
            String noteRow = "KayStay Order#" + trim(order.orderId(), 10)
                    + (order.contactName() == null ? "" : " / " + order.contactName())
                    + " " + start + " -> " + endExclusive
                    + (order.remark() == null ? "" : " (" + trim(order.remark(), 60) + ")");
            if (!sbNotes.isEmpty()) {
                sbNotes.append("\n");
            }
            sbNotes.append(noteRow);
        }
        String ordersNote = sbNotes.toString();

        Map<LocalDate, RoomBooking> existingBlocksMap = roomBookingRepository.findExternalBookingsForRoomInRange(
                        SYSTEM_NAME,
                        room.getCode(),
                        syncFrom.atStartOfDay(),
                        syncUntilExclusive.atStartOfDay()
                ).stream()
                .filter(b -> b.getExternalReservationId() != null && !b.getExternalReservationId().isBlank())
                .collect(Collectors.toMap(
                        b -> b.getCheckInAt().toLocalDate(),
                        b -> b,
                        (l, r) -> l,
                        HashMap::new
                ));

        for (LocalDate date = syncFrom; date.isBefore(syncUntilExclusive); date = date.plusDays(1)) {
            boolean blocked = blockedDaysSet.contains(date);
            RoomBooking existing = existingBlocksMap.get(date);
            if (blocked) {
                // #region debug-point C:upsert-block-attempt
                debugReport("pre-fix", "C", "KayStayCalendarSyncService:259", "[DEBUG] upsert block attempt", Map.of(
                        "roomCode", room.getCode(),
                        "date", date.toString(),
                        "hasExistingBooking", existing != null,
                        "ordersForRoom", roomOrders.size()
                ));
                // #endregion
                upsertBlockedDate(room, date, existing, ordersNote);
                stats.blockedDays++;
                appendLog(logs, room.getCode() + " " + date + " -> KAYSTAY_BLOCKED");
            } else {
                if (existing != null && existing.getStatus() == RoomBookingStatus.KAYSTAY_BLOCK) {
                    existing.setStatus(RoomBookingStatus.CANCELLED);
                    existing.setNotes("Released by KayStay SmartOrder for " + date);
                    roomBookingRepository.save(existing);
                    stats.releasedDays++;
                    appendLog(logs, room.getCode() + " " + date + " -> RELEASED");
                }
            }
        }
    }

    private void upsertBlockedDate(Room room, LocalDate date, RoomBooking existing, String ordersNote) {
        RoomBooking booking = existing;
        if (booking == null) {
            booking = roomBookingRepository.findByExternalSystemIgnoreCaseAndExternalReservationId(SYSTEM_NAME, buildExternalReservationId(room, date))
                    .orElseGet(RoomBooking::new);
        }
        booking.setRoomCode(room.getCode().trim().toUpperCase(Locale.ROOT));
        booking.setGuestName("KayStay Block");
        booking.setSource(BLOCK_SOURCE);
        booking.setPhone("");
        booking.setAdults(1);
        booking.setChildren(0);
        int ciHour = Math.max(0, Math.min(23, properties.getBlockCheckInHour()));
        int coHour = Math.max(0, Math.min(23, properties.getBlockCheckOutHour()));
        booking.setCheckInAt(date.atTime(ciHour, 0));
        booking.setCheckOutAt(date.plusDays(1).atTime(coHour, 0));
        booking.setStatus(RoomBookingStatus.KAYSTAY_BLOCK);
        booking.setVillaRate(null);
        booking.setDepositAmount(null);
        booking.setRemainingAmount(null);
        booking.setExternalSystem(SYSTEM_NAME);
        booking.setExternalReservationId(buildExternalReservationId(room, date));
        String baseNote = "Synced from KayStay SmartOrder calendar for " + date;
        booking.setNotes(ordersNote == null || ordersNote.isBlank() ? baseNote : (baseNote + "\n\n" + ordersNote));
        roomBookingRepository.save(booking);
    }

    private String buildExternalReservationId(Room room, LocalDate date) {
        return room.getCode().trim().toUpperCase(Locale.ROOT) + "-KS-" + date;
    }

    // ---------- HTTP ----------

    Map<String, String> fetchSmartOrderRoomList(String reviewCode, LocalDate from, LocalDate to, List<String> logs) throws IOException, InterruptedException {
        ObjectNode body = OBJECT_MAPPER.createObjectNode();
        body.put("serialNum", reviewCode);
        body.put("reviewCode", reviewCode);
        body.put("startDate", from.toString());
        body.put("endDate", to.toString());
        JsonNode data = postSmartOrder(ENDPOINT_ROOM_LIST, body, "roomList");
        Map<String, String> out = new HashMap<>();
        JsonNode list = data.path("list");
        if (!list.isArray()) {
            appendLog(logs, "KayStay roomList missing list array");
            return out;
        }
        for (JsonNode typeGroup : list) {
            JsonNode roomList = typeGroup.path("roomList");
            if (!roomList.isArray()) continue;
            for (JsonNode room : roomList) {
                String id = text(room, "roomId");
                String name = text(room, "roomName");
                if (id != null && !id.isBlank() && name != null) {
                    out.put(id, name);
                }
            }
        }
        appendLog(logs, "KayStay roomList: " + out.size() + " rooms -> " + out.values());
        return out;
    }

    List<SmartOrderBooking> fetchSmartOrderBookings(String reviewCode, LocalDate from, LocalDate to, Collection<String> smartRoomIdFilter, List<String> logs) throws IOException, InterruptedException {
        ObjectNode body = OBJECT_MAPPER.createObjectNode();
        body.put("serialNum", reviewCode);
        body.put("reviewCode", reviewCode);
        body.put("startDate", from.toString());
        body.put("endDate", to.toString());
        // Add array fields (empty array if filter null => all
        body.set("roomIds", OBJECT_MAPPER.valueToTree(
                smartRoomIdFilter == null ? new String[0] : smartRoomIdFilter.toArray(String[]::new)
        ));
        body.set("roomTypeIds", OBJECT_MAPPER.createArrayNode());
        JsonNode data = postSmartOrder(ENDPOINT_ORDER, body, "orders");
        List<SmartOrderBooking> out = new ArrayList<>();
        JsonNode list = data.path("list");
        if (!list.isArray()) {
            appendLog(logs, "KayStay order list not an array");
            return out;
        }
        int kept = 0;
        int skippedBadDate = 0;
        for (JsonNode order : list) {
            String orderId = text(order, "orderId");
            String smartRoomId = text(order, "roomId");
            String ci = text(order, "checkinTime");
            String co = text(order, "checkoutTime");
            String contactName = text(order, "contactName");
            String remark = text(order, "remark");
            if (smartRoomIdFilter != null && !smartRoomIdFilter.isEmpty() && !smartRoomIdFilter.contains(smartRoomId)) {
                continue;
            }
            LocalDateTime ciDt = parseSmartOrderDT(ci);
            LocalDateTime coDt = parseSmartOrderDT(co);
            if (ciDt == null || coDt == null) {
                skippedBadDate++;
                continue;
            }
            kept++;
            out.add(new SmartOrderBooking(orderId == null ? "" : orderId,
                    smartRoomId == null ? "" : smartRoomId,
                    ciDt,
                    coDt,
                    contactName,
                    remark));
        }
        appendLog(logs, "KayStay orders: kept=" + kept + " skippedBadDate=" + skippedBadDate);
        return out;
    }

    private JsonNode postSmartOrder(String endpoint, JsonNode body, String label) throws IOException, InterruptedException {
        String url = properties.getBaseUrl() + H5_API_V2 + endpoint;
        String bodyStr = OBJECT_MAPPER.writeValueAsString(body);
        IOException lastEx = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                        .timeout(Duration.ofMillis(Math.max(1_000L, properties.getTimeoutMs())))
                        .header("Accept", "application/json, text/plain, */*")
                        .header("Content-Type", "application/json;charset=UTF-8")
                        .header("Accept-Language", "en-US,en;q=0.9")
                        .header("User-Agent", properties.getUserAgent())
                        .header("Origin", "https://www.smartorder.ai")
                        .header("Referer", properties.getBaseUrl() + "/pms-h5-app-pro/shareHotelStatus?reviewCode=" + urlEncode(body.path("reviewCode").asText("")))
                        .POST(HttpRequest.BodyPublishers.ofString(bodyStr, StandardCharsets.UTF_8))
                        .build();
                HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                if (resp.statusCode() >= 400) {
                    throw new IOException("SmartOrder returned HTTP " + resp.statusCode());
                }
                JsonNode root = OBJECT_MAPPER.readTree(resp.body());
                String codeText = text(root, "code");
                String msg = text(root, "msg");
                if (!"1".equals(codeText)) {
                    throw new IOException("SmartOrder " + label + " code=" + codeText + " msg=" + msg);
                }
                return root.path("data").isMissingNode() ? OBJECT_MAPPER.createObjectNode() : root.path("data");
            } catch (IOException ex) {
                lastEx = ex;
                log.warn("SmartOrder {} attempt {} failed: {}", label, attempt, ex.getMessage());
            }
        }
        throw new IOException("SmartOrder " + label + " failed after 3 attempts. Last: " + (lastEx == null ? "unknown" : lastEx.getMessage()), lastEx);
    }

    static Optional<String> extractRoomCode(String smartRoomName) {
        if (smartRoomName == null || smartRoomName.isBlank()) {
            return Optional.empty();
        }
        Matcher m = ROOM_CODE_PATTERN.matcher(smartRoomName.toUpperCase(Locale.ROOT));
        List<String> candidates = new ArrayList<>();
        while (m.find()) {
            candidates.add(m.group(1).replace("-", ""));
        }
        if (candidates.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(candidates.get(0));
    }

    static LocalDateTime parseSmartOrderDT(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value, SMARTORDER_DATETIME);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        JsonNode c = node.get(field);
        if (c == null || c.isMissingNode() || c.isNull()) return null;
        return c.asText(null);
    }

    private static String trim(String value, int max) {
        if (value == null) return null;
        String v = value.replace("\r", "").replace("\n", " ").trim();
        return v.length() <= max ? v : v.substring(0, max) + "...";
    }

    private static String urlEncode(String value) {
        try {
            return java.net.URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return value == null ? "" : value;
        }
    }

    private static void appendLog(List<String> logs, String line) {
        if (logs != null) {
            logs.add(line);
        }
    }

    // #region debug-point helpers
    private void debugReport(String runId, String hypothesisId, String location, String msg, Map<String, ?> data) {
        try {
            String url = DEBUG_FALLBACK_URL;
            String sessionId = DEBUG_SESSION_ID;
            Path envPath = Path.of(DEBUG_ENV_FILE);
            if (Files.exists(envPath)) {
                for (String line : Files.readAllLines(envPath, StandardCharsets.UTF_8)) {
                    if (line.startsWith("DEBUG_SERVER_URL=")) {
                        url = line.substring("DEBUG_SERVER_URL=".length()).trim();
                    } else if (line.startsWith("DEBUG_SESSION_ID=")) {
                        sessionId = line.substring("DEBUG_SESSION_ID=".length()).trim();
                    }
                }
            }
            Map<String, Object> event = new HashMap<>();
            event.put("sessionId", sessionId);
            event.put("runId", runId);
            event.put("hypothesisId", hypothesisId);
            event.put("location", location);
            event.put("msg", msg);
            event.put("data", data == null ? Map.of() : data);
            event.put("ts", System.currentTimeMillis());
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(2))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(event), StandardCharsets.UTF_8))
                    .build();
            httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding());
        } catch (Exception ignored) {
        }
    }
    // #endregion

    record SmartOrderBooking(
            String orderId,
            String smartRoomId,
            LocalDateTime checkInDate,
            LocalDateTime checkOutDate,
            String contactName,
            String remark
    ) {}

    static class SyncStats {
        int blockedDays;
        int releasedDays;
        int orderCount;
        int errorCount;
    }
}
