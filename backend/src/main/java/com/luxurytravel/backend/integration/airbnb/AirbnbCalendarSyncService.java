package com.luxurytravel.backend.integration.airbnb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
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
public class AirbnbCalendarSyncService {
    static final String SYSTEM_NAME = "AIRBNB_SCRAPE";
    static final String BLOCK_GUEST_NAME = "Airbnb Block";
    static final String BLOCK_SOURCE = "Airbnb";
    private static final int BLOCK_CHECK_IN_HOUR = 15;
    private static final int BLOCK_CHECK_OUT_HOUR = 11;
    private static final Pattern PRODUCT_ID_QUERY_PATTERN = Pattern.compile("(^|[?&])productId=(\\d+)(?:&|$)", Pattern.CASE_INSENSITIVE);
    private static final Pattern STAY_PATH_PATTERN = Pattern.compile("/(?:rooms|stays)/(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final String AIRBNB_API_KEY = "d306zoyjsyarp7ifhu67rjxn52tv0t20";
    private static final String AVAILABILITY_QUERY_NAME = "StaysPdpAtomicAvailabilityCalendarQuery";
    private static final String AVAILABILITY_QUERY_ID = "2fa45ec4191ff61522e5612ffe984d401c72451148b4a7093cf0680253de953b";
    private static final DateTimeFormatter ISO_DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final Logger log = LoggerFactory.getLogger(AirbnbCalendarSyncService.class);
    private final RoomRepository roomRepository;
    private final RoomBookingRepository roomBookingRepository;
    private final AirbnbSyncProperties properties;
    private final HttpClient httpClient;

    public AirbnbCalendarSyncService(
            RoomRepository roomRepository,
            RoomBookingRepository roomBookingRepository,
            AirbnbSyncProperties properties
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
            fixedDelayString = "${application.integrations.airbnb-sync.fixed-delay-ms:7200000}",
            initialDelayString = "${application.integrations.airbnb-sync.initial-delay-ms:120000}"
    )
    public void scheduledSync() {
        if (!properties.isEnabled()) {
            return;
        }
        AirbnbSyncRunResponse result = runSync(null, false);
        if (!result.success()) {
            log.warn("Airbnb sync completed with issues: {}", result.message());
        }
    }

    public void syncConfiguredRooms() {
        runSync(null, false);
    }

    public AirbnbSyncRunResponse syncNow(String roomCode) {
        return runSync(roomCode, true);
    }

    public AirbnbSyncRunResponse syncNow(String roomCode, LocalDate from, LocalDate to) {
        return runSync(roomCode, true, from, to);
    }

    private AirbnbSyncRunResponse runSync(String roomCode, boolean includeLogs) {
        return runSync(roomCode, includeLogs, null, null);
    }

    private AirbnbSyncRunResponse runSync(String roomCode, boolean includeLogs, LocalDate requestedFrom, LocalDate requestedTo) {
        List<String> logs = new ArrayList<>();
        if (!properties.isEnabled()) {
            logs.add("Airbnb sync is disabled in configuration.");
            return new AirbnbSyncRunResponse(false, "Airbnb sync is disabled.", logs);
        }

        LocalDate today = LocalDate.now(ZoneId.of(properties.getZoneId()));
        LocalDate syncFrom = requestedFrom != null ? requestedFrom : today;
        LocalDate inclusiveTo = requestedTo != null ? requestedTo : today.plusDays(Math.max(1, properties.getHorizonDays()) - 1L);
        if (inclusiveTo.isBefore(syncFrom)) {
            logs.add("Invalid sync range: 'to' is before 'from'.");
            return new AirbnbSyncRunResponse(false, "Invalid Airbnb sync range.", logs);
        }
        LocalDate syncUntil = inclusiveTo.plusDays(1);
        List<Room> targetRooms = resolveTargetRooms(roomCode, logs);

        if (targetRooms.isEmpty()) {
            logs.add("No active villa with a valid Airbnb URL matched this sync request.");
            return new AirbnbSyncRunResponse(false, "No eligible Airbnb villa found to sync.", logs);
        }

        logs.add("Sync range: " + syncFrom + " -> " + inclusiveTo);
        SyncStats stats = new SyncStats();
        for (Room room : targetRooms) {
            logs.add("Start sync for " + room.getCode() + " (" + room.getAirbnbUrl() + ")");
            try {
                syncRoom(room, syncFrom, syncUntil, stats, includeLogs ? logs : null);
            } catch (Exception exception) {
                stats.errorCount++;
                String line = "Sync failed for " + room.getCode() + ": " + exception.getMessage();
                logs.add(line);
                log.warn(line, exception);
            }
        }

        String summary = "Airbnb sync finished: "
                + targetRooms.size() + " villa(s), "
                + stats.availableCount + " available, "
                + stats.blockedCount + " blocked, "
                + stats.releasedCount + " released, "
                + stats.unknownCount + " unknown, "
                + stats.errorCount + " error(s).";
        logs.add(summary);
        return new AirbnbSyncRunResponse(stats.errorCount == 0, summary, logs);
    }

    void syncRoom(Room room, LocalDate fromDate, LocalDate toDateExclusive, SyncStats stats, List<String> logs) throws IOException, InterruptedException {
        if (!isRoomAllowed(room)) {
            return;
        }

        Map<LocalDate, AvailabilityResult> availabilityByDate = fetchAvailabilityForRange(room.getAirbnbUrl(), fromDate, toDateExclusive, logs);
        Map<LocalDate, RoomBooking> existingBlocks = roomBookingRepository.findExternalBookingsForRoomInRange(
                        SYSTEM_NAME,
                        room.getCode(),
                        fromDate.atStartOfDay(),
                        toDateExclusive.atStartOfDay()
                ).stream()
                .filter(booking -> booking.getExternalReservationId() != null && !booking.getExternalReservationId().isBlank())
                .collect(Collectors.toMap(
                        booking -> booking.getCheckInAt().toLocalDate(),
                        booking -> booking,
                        (left, right) -> left,
                        HashMap::new
                ));

        for (LocalDate date = fromDate; date.isBefore(toDateExclusive); date = date.plusDays(1)) {
            AvailabilityResult availability = availabilityByDate.getOrDefault(date, AvailabilityResult.UNKNOWN);
            if (availability == AvailabilityResult.UNKNOWN) {
                stats.unknownCount++;
                appendLog(logs, room.getCode() + " " + date + " -> UNKNOWN");
                continue;
            }

            RoomBooking existing = existingBlocks.get(date);
            if (availability == AvailabilityResult.BLOCKED) {
                upsertBlockedDate(room, date, existing);
                stats.blockedCount++;
                appendLog(logs, room.getCode() + " " + date + " -> BLOCKED");
                continue;
            }

            stats.availableCount++;
            appendLog(logs, room.getCode() + " " + date + " -> AVAILABLE");

            if (existing != null && existing.getStatus() == RoomBookingStatus.AIRBNB_BLOCK) {
                existing.setStatus(RoomBookingStatus.CANCELLED);
                existing.setNotes(buildBlockNotes(date, false));
                roomBookingRepository.save(existing);
                stats.releasedCount++;
                appendLog(logs, room.getCode() + " " + date + " -> RELEASED");
            }
        }
    }

    Map<LocalDate, AvailabilityResult> fetchAvailabilityForRange(
            String airbnbUrl,
            LocalDate fromDate,
            LocalDate toDateExclusive,
            List<String> logs
    ) throws IOException, InterruptedException {
        Optional<String> productId = extractProductId(airbnbUrl);
        if (productId.isEmpty()) {
            return Map.of();
        }

        LocalDate firstMonth = fromDate.withDayOfMonth(1);
        LocalDate lastMonth = toDateExclusive.minusDays(1).withDayOfMonth(1);
        int monthCount = (int) ChronoUnit.MONTHS.between(firstMonth, lastMonth) + 1;

        Map<LocalDate, AvailabilityResult> fetchedAvailability = fetchAvailabilityMonths(productId.get(), firstMonth, monthCount);
        Map<LocalDate, AvailabilityResult> filteredAvailability = new HashMap<>();

        for (LocalDate monthCursor = firstMonth; !monthCursor.isAfter(lastMonth); monthCursor = monthCursor.plusMonths(1)) {
            LocalDate currentMonth = monthCursor;
            long parsedDays = fetchedAvailability.keySet().stream()
                    .filter(date -> date.getYear() == currentMonth.getYear() && date.getMonthValue() == currentMonth.getMonthValue())
                    .count();
            appendLog(logs, "Fetched Airbnb calendar for " + currentMonth.getMonthValue() + "/" + currentMonth.getYear()
                    + ": " + parsedDays + " parsed day(s)");
        }

        fetchedAvailability.forEach((date, availability) -> {
            if (!date.isBefore(fromDate) && date.isBefore(toDateExclusive)) {
                filteredAvailability.put(date, availability);
            }
        });
        return filteredAvailability;
    }

    Map<LocalDate, AvailabilityResult> fetchAvailabilityMonths(String listingId, LocalDate monthStart, int monthCount) throws IOException, InterruptedException {
        String apiUrl = buildAvailabilityApiUrl(listingId, monthStart, monthCount, properties);
        IOException lastException = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                HttpRequest request = HttpRequest.newBuilder(URI.create(apiUrl))
                        .timeout(Duration.ofMillis(Math.max(1_000L, properties.getTimeoutMs())))
                        .header("Accept", "application/json")
                        .header("Accept-Language", "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7")
                        .header("Cache-Control", "no-cache")
                        .header("Pragma", "no-cache")
                        .header("Referer", properties.getBaseUrl() + "/rooms/" + listingId)
                        .header("User-Agent", properties.getUserAgent())
                        .header("X-Airbnb-API-Key", AIRBNB_API_KEY)
                        .header("X-CSRF-Without-Token", "1")
                        .GET()
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                if (response.statusCode() >= 400) {
                    throw new IOException("Airbnb calendar API returned HTTP " + response.statusCode());
                }
                return parseAvailabilityResponse(response.body());
            } catch (IOException exception) {
                lastException = exception;
                log.warn("Airbnb calendar API attempt {} failed for listing {}: {}", attempt, listingId, exception.getMessage());
            }
        }

        throw new IOException("Calendar API fetch failed for " + monthStart + " after 3 attempts. Last error: "
                + (lastException == null ? "unknown" : lastException.getMessage()), lastException);
    }

    static Map<LocalDate, AvailabilityResult> parseAvailabilityResponse(String responseBody) throws IOException {
        Map<LocalDate, AvailabilityResult> parsed = new HashMap<>();
        if (responseBody == null || responseBody.isBlank()) {
            return parsed;
        }

        JsonNode root = OBJECT_MAPPER.readTree(responseBody);
        JsonNode errors = root.path("errors");
        if (errors.isArray() && !errors.isEmpty()) {
            throw new IOException("Airbnb calendar API returned GraphQL errors: " + errors.toString());
        }

        JsonNode months = root.path("data")
                .path("merlin")
                .path("pdpAvailabilityCalendar")
                .path("calendarMonths");
        if (!months.isArray()) {
            throw new IOException("Airbnb calendar API response is missing calendarMonths.");
        }

        for (JsonNode month : months) {
            JsonNode days = month.path("days");
            if (!days.isArray()) {
                continue;
            }
            for (JsonNode day : days) {
                LocalDate date = parseIsoDate(day.path("calendarDate").asText(null));
                if (date == null) {
                    continue;
                }
                AvailabilityResult availability = classifyApiDay(day);
                if (availability != AvailabilityResult.UNKNOWN) {
                    parsed.put(date, availability);
                }
            }
        }
        return parsed;
    }

    static AvailabilityResult classifyApiDay(JsonNode dayNode) {
        if (dayNode == null || dayNode.isMissingNode()) {
            return AvailabilityResult.UNKNOWN;
        }
        boolean hasAvailable = dayNode.hasNonNull("available");
        boolean hasBookable = dayNode.hasNonNull("bookable");
        if (!hasAvailable && !hasBookable) {
            return AvailabilityResult.UNKNOWN;
        }
        boolean available = dayNode.path("available").asBoolean(false);
        boolean bookable = dayNode.path("bookable").asBoolean(available);
        if (!available || !bookable) {
            return AvailabilityResult.BLOCKED;
        }
        return AvailabilityResult.AVAILABLE;
    }

    static String buildAvailabilityApiUrl(String listingId, LocalDate monthStart, int monthCount, AirbnbSyncProperties properties) {
        String variables = "{\"request\":{\"listingId\":\"" + listingId + "\",\"month\":" + monthStart.getMonthValue()
                + ",\"year\":" + monthStart.getYear()
                + ",\"count\":" + Math.max(1, monthCount) + "}}";
        String extensions = "{\"persistedQuery\":{\"version\":1,\"sha256Hash\":\"" + AVAILABILITY_QUERY_ID + "\"}}";
        return properties.getBaseUrl()
                + "/api/v3/" + AVAILABILITY_QUERY_NAME + "/" + AVAILABILITY_QUERY_ID
                + "?operationName=" + urlEncode(AVAILABILITY_QUERY_NAME)
                + "&locale=vi"
                + "&currency=" + urlEncode(properties.getCurrency())
                + "&variables=" + urlEncode(variables)
                + "&extensions=" + urlEncode(extensions);
    }

    static Optional<String> extractProductId(String airbnbUrl) {
        if (airbnbUrl == null || airbnbUrl.isBlank()) {
            return Optional.empty();
        }

        Matcher queryMatcher = PRODUCT_ID_QUERY_PATTERN.matcher(airbnbUrl);
        if (queryMatcher.find()) {
            return Optional.ofNullable(queryMatcher.group(2));
        }

        Matcher pathMatcher = STAY_PATH_PATTERN.matcher(airbnbUrl);
        if (pathMatcher.find()) {
            return Optional.ofNullable(pathMatcher.group(1));
        }

        return Optional.empty();
    }

    private void upsertBlockedDate(Room room, LocalDate date, RoomBooking existing) {
        RoomBooking booking = existing;
        if (booking == null) {
            booking = roomBookingRepository.findByExternalSystemIgnoreCaseAndExternalReservationId(SYSTEM_NAME, buildExternalReservationId(room, date))
                    .orElseGet(RoomBooking::new);
        }

        booking.setRoomCode(room.getCode().trim().toUpperCase(Locale.ROOT));
        booking.setGuestName(BLOCK_GUEST_NAME);
        booking.setSource(BLOCK_SOURCE);
        booking.setPhone("");
        booking.setAdults(Math.max(1, properties.getAdults()));
        booking.setChildren(0);
        booking.setCheckInAt(date.atTime(BLOCK_CHECK_IN_HOUR, 0));
        booking.setCheckOutAt(date.plusDays(1).atTime(BLOCK_CHECK_OUT_HOUR, 0));
        booking.setStatus(RoomBookingStatus.AIRBNB_BLOCK);
        booking.setVillaRate(null);
        booking.setDepositAmount(null);
        booking.setRemainingAmount(null);
        booking.setExternalSystem(SYSTEM_NAME);
        booking.setExternalReservationId(buildExternalReservationId(room, date));
        booking.setNotes(buildBlockNotes(date, true));
        roomBookingRepository.save(booking);
    }

    private String buildExternalReservationId(Room room, LocalDate date) {
        return room.getCode().trim().toUpperCase(Locale.ROOT) + "-" + date;
    }

    private String buildBlockNotes(LocalDate date, boolean blocked) {
        return (blocked ? "Synced from Airbnb calendar for " : "Released by Airbnb calendar for ") + date;
    }

    private boolean isRoomAllowed(Room room) {
        Set<String> allowedCodes = properties.getRoomCodes().stream()
                .filter(Objects::nonNull)
                .map(value -> value.trim().toUpperCase(Locale.ROOT))
                .filter(value -> !value.isBlank())
                .collect(Collectors.toSet());

        if (allowedCodes.isEmpty()) {
            return true;
        }

        return allowedCodes.contains(room.getCode().trim().toUpperCase(Locale.ROOT));
    }

    private List<Room> resolveTargetRooms(String roomCode, List<String> logs) {
        String normalizedRoomCode = roomCode == null ? "" : roomCode.trim().toUpperCase(Locale.ROOT);
        if (!normalizedRoomCode.isBlank()) {
            Optional<Room> room = roomRepository.findByCodeIgnoreCase(normalizedRoomCode)
                    .filter(value -> value.isActive())
                    .filter(value -> value.getAirbnbUrl() != null && !value.getAirbnbUrl().isBlank());
            if (room.isEmpty()) {
                logs.add("Villa " + normalizedRoomCode + " is missing, inactive, or does not have an Airbnb URL.");
                return List.of();
            }
            return List.of(room.get());
        }

        return roomRepository.findAllByOrderByLocationAscFloorNumberAscCodeAsc().stream()
                .filter(room -> room.isActive())
                .filter(room -> room.getAirbnbUrl() != null && !room.getAirbnbUrl().isBlank())
                .filter(this::isRoomAllowed)
                .toList();
    }

    private void appendLog(List<String> logs, String line) {
        if (logs != null) {
            logs.add(line);
        }
    }

    private static String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static LocalDate parseIsoDate(String value) {
        try {
            return LocalDate.parse(value, ISO_DATE_FORMATTER);
        } catch (DateTimeParseException exception) {
            return null;
        }
    }

    enum AvailabilityResult {
        AVAILABLE,
        BLOCKED,
        UNKNOWN
    }

    static class SyncStats {
        private int availableCount;
        private int blockedCount;
        private int releasedCount;
        private int unknownCount;
        private int errorCount;
    }
}
