package com.luxurytravel.backend.integration.sophia;

import com.luxurytravel.backend.room.Room;
import com.luxurytravel.backend.room.RoomRepository;
import com.luxurytravel.backend.roombooking.RoomBooking;
import com.luxurytravel.backend.roombooking.RoomBookingRepository;
import com.luxurytravel.backend.roombooking.RoomBookingStatus;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
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
public class SophiaCalendarSyncService {
    static final String SYSTEM_NAME = "SOPHIA_PMS";
    static final String BLOCK_SOURCE = "Sophia";
    private static final String DEFAULT_GUEST_NAME = "Sophia Block";
    private static final String SCHEDULER_EVENT_TARGET = "ctl00$MainContent$RadScheduler1";
    private static final String NAVIGATE_TO_NEXT_PERIOD_ARGUMENT = "{\"Command\":\"NavigateToNextPeriod\"}";
    private static final Pattern BOOKING_CODE_PATTERN = Pattern.compile("(?i)Booking\\s*Code\\s*:\\s*([^\\r\\n]+)");
    private static final Pattern VILLA_PATTERN = Pattern.compile("(?i)\\bvilla\\s+((?:\\d{3})(?:\\s*/\\s*\\d{3})*)");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("\\b(\\d{3})\\b");
    private static final Pattern STYLE_WIDTH_PATTERN = Pattern.compile("width\\s*:\\s*([0-9.]+)px", Pattern.CASE_INSENSITIVE);
    private static final Pattern SOPHIA_DATE_STATE_PATTERN = Pattern.compile("\\[\\[(\\d{4}),(\\d{1,2}),(\\d{1,2})\\]\\]");
    private static final Pattern ISO_DATE_IN_ID_PATTERN = Pattern.compile("\\b(\\d{4}-\\d{2}-\\d{2})\\b");
    private static final Pattern DAY_MONTH_RANGE_PATTERN = Pattern.compile("(\\d{1,2})/(\\d{1,2})\\s*-\\s*(\\d{1,2})/(\\d{1,2})");
    private static final Pattern DAY_MONTH_PATTERN = Pattern.compile("\\b(?:T\\d|CN),\\s*(\\d{1,2})/(\\d{1,2})\\b", Pattern.CASE_INSENSITIVE);
    private static final DateTimeFormatter DATE_ID_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;

    private final Logger log = LoggerFactory.getLogger(SophiaCalendarSyncService.class);
    private final RoomRepository roomRepository;
    private final RoomBookingRepository roomBookingRepository;
    private final SophiaSyncProperties properties;
    private final HttpClient httpClient;

    public SophiaCalendarSyncService(
            RoomRepository roomRepository,
            RoomBookingRepository roomBookingRepository,
            SophiaSyncProperties properties
    ) {
        this.roomRepository = roomRepository;
        this.roomBookingRepository = roomBookingRepository;
        this.properties = properties;
        CookieManager cookieManager = new CookieManager();
        cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);
        this.httpClient = HttpClient.newBuilder()
                .cookieHandler(cookieManager)
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofMillis(Math.max(1_000L, properties.getTimeoutMs())))
                .build();
    }

    @Scheduled(
            fixedDelayString = "${application.integrations.sophia-sync.fixed-delay-ms:7200000}",
            initialDelayString = "${application.integrations.sophia-sync.initial-delay-ms:120000}"
    )
    public void scheduledSync() {
        if (!properties.isEnabled() || !properties.isAutoEnabled()) {
            return;
        }
        SophiaSyncRunResponse result = runSync(null, false, null, null);
        if (!result.success()) {
            log.warn("Sophia sync completed with issues: {}", result.message());
        }
    }

    public SophiaSyncRunResponse syncNow(String roomCode, LocalDate from, LocalDate to) {
        return runSync(roomCode, true, from, to);
    }

    private SophiaSyncRunResponse runSync(String roomCode, boolean includeLogs, LocalDate requestedFrom, LocalDate requestedTo) {
        List<String> logs = new ArrayList<>();
        if (!properties.isEnabled()) {
            appendLog(logs, "Sophia sync is disabled in configuration.");
            return new SophiaSyncRunResponse(false, "Sophia sync is disabled.", logs);
        }
        if (isBlank(properties.getUsername()) || isBlank(properties.getPassword())) {
            appendLog(logs, "Sophia username or password is missing.");
            return new SophiaSyncRunResponse(false, "Sophia sync credentials are missing.", logs);
        }

        LocalDate today = LocalDate.now(ZoneId.of(properties.getZoneId()));
        LocalDate syncFrom = requestedFrom != null ? requestedFrom : today;
        if (syncFrom.isBefore(today)) {
            appendLog(logs, "Sophia sync start date " + syncFrom + " is in the past. Clamping to " + today + " to avoid Sophia postback failure.");
            syncFrom = today;
        }
        LocalDate inclusiveTo = requestedTo != null ? requestedTo : today.plusDays(Math.max(1, properties.getHorizonDays()) - 1L);
        if (inclusiveTo.isBefore(syncFrom)) {
            appendLog(logs, "Invalid sync range: 'to' is before 'from'.");
            return new SophiaSyncRunResponse(false, "Invalid Sophia sync range.", logs);
        }

        String normalizedRequestedRoom = normalizeCode(roomCode);
        List<Room> activeRooms = roomRepository.findAllByOrderByLocationAscFloorNumberAscCodeAsc().stream()
                .filter(Room::isActive)
                .toList();
        RoomAliasResolver roomAliasResolver = new RoomAliasResolver(activeRooms);
        String resolvedRequestedRoom = normalizedRequestedRoom;
        if (!normalizedRequestedRoom.isBlank() && roomAliasResolver.findRequestedRoom(normalizedRequestedRoom).isEmpty()) {
            appendLog(logs, "Villa " + normalizedRequestedRoom + " is missing or inactive.");
            return new SophiaSyncRunResponse(false, "No eligible Sophia villa found to sync.", logs);
        }
        if (!normalizedRequestedRoom.isBlank()) {
            resolvedRequestedRoom = roomAliasResolver.findRequestedRoom(normalizedRequestedRoom)
                    .map(Room::getCode)
                    .map(SophiaCalendarSyncService::normalizeCode)
                    .orElse(normalizedRequestedRoom);
        }

        appendLog(logs, "Sync range: " + syncFrom + " -> " + inclusiveTo);
        Set<String> seenExternalIds = new LinkedHashSet<>();
        SyncStats stats = new SyncStats();
        List<SyncRange> fetchedRanges = new ArrayList<>();

        LocalDate requestedToExclusive = inclusiveTo.plusDays(1);
        for (LocalDate cursor = syncFrom; !cursor.isAfter(inclusiveTo); ) {
            LocalDate chunkStart = cursor;
            try {
                ParsedSchedulerWindow window = fetchSchedulerWindow(chunkStart, includeLogs ? logs : null);
                LocalDate visibleFrom = maxDate(chunkStart, window.windowStart());
                LocalDate visibleToExclusive = minDate(requestedToExclusive, window.windowStart().plusDays(window.dayCount()));
                if (!visibleToExclusive.isAfter(visibleFrom)) {
                    appendLog(logs, "Sophia returned a window outside the requested range: " + window.windowStart() + " -> " + window.windowStart().plusDays(window.dayCount() - 1L));
                    cursor = chunkStart.plusDays(Math.max(1, window.dayCount()));
                    continue;
                }
                fetchedRanges.add(new SyncRange(visibleFrom, visibleToExclusive));
                applyWindow(
                        window,
                        visibleFrom,
                        visibleToExclusive,
                        resolvedRequestedRoom,
                        roomAliasResolver,
                        seenExternalIds,
                        stats,
                        includeLogs ? logs : null
                );
                cursor = visibleToExclusive;
            } catch (Exception exception) {
                stats.errorCount++;
                String line = "Sophia sync failed for window starting " + chunkStart + ": " + exception.getMessage();
                appendLog(logs, line);
                log.warn(line, exception);
                cursor = chunkStart.plusDays(1);
            }
        }

        for (SyncRange fetchedRange : fetchedRanges) {
            releaseMissingBlocks(
                    fetchedRange.from(),
                    fetchedRange.toExclusive(),
                    resolvedRequestedRoom,
                    activeRooms,
                    seenExternalIds,
                    stats,
                    includeLogs ? logs : null
            );
        }

        String summary = "Sophia sync finished: "
                + stats.roomCodes.size() + " villa(s), "
                + stats.reservationCount + " reservation(s), "
                + stats.blockedCount + " blocked day(s), "
                + stats.releasedCount + " released day(s), "
                + stats.missingRoomCount + " unmapped villa mention(s), "
                + stats.errorCount + " error(s).";
        appendLog(logs, summary);
        return new SophiaSyncRunResponse(stats.errorCount == 0, summary, logs);
    }

    private ParsedSchedulerWindow fetchSchedulerWindow(LocalDate windowStart, List<String> logs) throws IOException, InterruptedException {
        URI bookingListUri = buildBookingListUri();
        HttpResponse<String> initial = get(bookingListUri);
        // #region debug-point A:initial-response
        debugReport("A", "SophiaCalendarSyncService.fetchSchedulerWindow:181", "[DEBUG] Initial Sophia response received", Map.of(
                "windowStart", Objects.toString(windowStart, ""),
                "uri", Objects.toString(initial.uri(), ""),
                "statusCode", Integer.toString(initial.statusCode()),
                "isLoginPage", Boolean.toString(isLoginPage(initial.body())),
                "hasSchedulerTable", Boolean.toString(initial.body() != null && initial.body().contains("rsHorizontalHeaderTable")),
                "hasSelectedDateInput", Boolean.toString(initial.body() != null && initial.body().contains("SelectedDateCalendar_SD"))
        ));
        // #endregion
        if (isLoginPage(initial.body())) {
            appendLog(logs, "Authenticating with Sophia.");
            initial = login(bookingListUri, initial);
            // #region debug-point A:post-login-response
            debugReport("A", "SophiaCalendarSyncService.fetchSchedulerWindow:191", "[DEBUG] Sophia response after login", Map.of(
                    "windowStart", Objects.toString(windowStart, ""),
                    "uri", Objects.toString(initial.uri(), ""),
                    "statusCode", Integer.toString(initial.statusCode()),
                    "isLoginPage", Boolean.toString(isLoginPage(initial.body())),
                    "hasSchedulerTable", Boolean.toString(initial.body() != null && initial.body().contains("rsHorizontalHeaderTable")),
                    "hasSelectedDateInput", Boolean.toString(initial.body() != null && initial.body().contains("SelectedDateCalendar_SD"))
            ));
            // #endregion
        }

        Document currentPage = Jsoup.parse(initial.body(), initial.uri().toString());
        ParsedSchedulerWindow currentWindow = parseSchedulerWindow(initial.body());
        if (isWithinWindow(windowStart, currentWindow)) {
            appendLog(logs, "Using current Sophia BookingList window " + currentWindow.windowStart() + " -> " + currentWindow.windowStart().plusDays(currentWindow.dayCount() - 1L));
            return currentWindow;
        }
        if (!isLoginPage(initial.body()) && matchesRequestedWindow(currentPage, windowStart, properties.getViewDays())) {
            return parseSchedulerWindow(initial.body());
        }

        ParsedSchedulerWindow navigatedWindow = currentWindow;
        Document navigatedPage = currentPage;
        URI currentUri = initial.uri();
        int maxPeriods = Math.max(1, properties.getHorizonDays()) + 2;
        int periodsNavigated = 0;
        while (!isWithinWindow(windowStart, navigatedWindow) && periodsNavigated < maxPeriods) {
            HttpResponse<String> switched = navigateToNextPeriod(navigatedPage, currentUri);
            // #region debug-point D:navigate-next-period
            debugReport("D", "SophiaCalendarSyncService.fetchSchedulerWindow:navigateNext", "[DEBUG] Sophia response after next-period navigation", Map.of(
                    "windowStart", Objects.toString(windowStart, ""),
                    "uri", Objects.toString(switched.uri(), ""),
                    "statusCode", Integer.toString(switched.statusCode()),
                    "isLoginPage", Boolean.toString(isLoginPage(switched.body())),
                    "hasSchedulerTable", Boolean.toString(switched.body() != null && switched.body().contains("rsHorizontalHeaderTable")),
                    "hasSelectedDateInput", Boolean.toString(switched.body() != null && switched.body().contains("SelectedDateCalendar_SD")),
                    "hasSummaryIds", Boolean.toString(switched.body() != null && switched.body().contains("sum-"))
            ));
            // #endregion
            if (isLoginPage(switched.body())) {
                switched = login(buildBookingListUri(), switched);
            }
            if (!hasSchedulerData(switched.body())) {
                throw new IOException("Sophia navigation did not return scheduler data.");
            }
            navigatedPage = Jsoup.parse(switched.body(), switched.uri().toString());
            currentUri = switched.uri();
            navigatedWindow = parseSchedulerWindow(switched.body());
            periodsNavigated++;
            appendLog(logs, "Navigated Sophia window to " + navigatedWindow.windowStart() + " -> " + navigatedWindow.windowStart().plusDays(navigatedWindow.dayCount() - 1L));
        }
        if (!isWithinWindow(windowStart, navigatedWindow)) {
            throw new IOException("Sophia could not navigate to window containing " + windowStart + ".");
        }
        if (!navigatedWindow.windowStart().equals(windowStart)) {
            appendLog(logs, "Sophia returned window starting at " + navigatedWindow.windowStart() + " instead of " + windowStart + ".");
        }
        return navigatedWindow;
    }

    private void applyWindow(
            ParsedSchedulerWindow window,
            LocalDate requestedFrom,
            LocalDate requestedToExclusive,
            String normalizedRequestedRoom,
            RoomAliasResolver roomAliasResolver,
            Set<String> seenExternalIds,
            SyncStats stats,
            List<String> logs
    ) {
        for (ParsedReservation reservation : window.reservations()) {
            LocalDate effectiveStart = maxDate(reservation.startDate(), requestedFrom);
            LocalDate effectiveEnd = minDate(reservation.endDateExclusive(), requestedToExclusive);
            if (!effectiveEnd.isAfter(effectiveStart)) {
                continue;
            }

            List<Room> matchedRooms = roomAliasResolver.resolve(reservation.villaCodes(), normalizedRequestedRoom);
            if (matchedRooms.isEmpty()) {
                stats.missingRoomCount++;
                appendLog(logs, "Unmapped Sophia villa: " + reservation.villaCodes() + " (" + reservation.bookingCode() + ")");
                continue;
            }

            stats.reservationCount++;
            for (Room room : matchedRooms) {
                stats.roomCodes.add(room.getCode().trim().toUpperCase(Locale.ROOT));
                for (LocalDate date = effectiveStart; date.isBefore(effectiveEnd); date = date.plusDays(1)) {
                    String externalId = buildExternalReservationId(room.getCode(), reservation.bookingCode(), date);
                    upsertBlockedDate(room, reservation, date, externalId);
                    seenExternalIds.add(externalId);
                    stats.blockedCount++;
                    appendLog(logs, room.getCode() + " " + date + " -> SOPHIA_BLOCK");
                }
            }
        }
    }

    private void releaseMissingBlocks(
            LocalDate syncFrom,
            LocalDate syncUntilExclusive,
            String normalizedRequestedRoom,
            List<Room> activeRooms,
            Set<String> seenExternalIds,
            SyncStats stats,
            List<String> logs
    ) {
        for (Room room : activeRooms) {
            String normalizedRoomCode = normalizeCode(room.getCode());
            if (!normalizedRequestedRoom.isBlank() && !normalizedRequestedRoom.equals(normalizedRoomCode)) {
                continue;
            }
            List<RoomBooking> existingBlocks = roomBookingRepository.findExternalBookingsForRoomInRange(
                    SYSTEM_NAME,
                    room.getCode(),
                    syncFrom.atStartOfDay(),
                    syncUntilExclusive.atStartOfDay()
            );
            for (RoomBooking booking : existingBlocks) {
                if (booking.getStatus() != RoomBookingStatus.SOPHIA_BLOCK || isBlank(booking.getExternalReservationId())) {
                    continue;
                }
                if (seenExternalIds.contains(booking.getExternalReservationId())) {
                    continue;
                }
                booking.setStatus(RoomBookingStatus.CANCELLED);
                booking.setNotes("Released by Sophia sync for " + booking.getCheckInAt().toLocalDate());
                roomBookingRepository.save(booking);
                stats.releasedCount++;
                appendLog(logs, room.getCode() + " " + booking.getCheckInAt().toLocalDate() + " -> RELEASED");
            }
        }
    }

    private void upsertBlockedDate(Room room, ParsedReservation reservation, LocalDate date, String externalId) {
        RoomBooking booking = roomBookingRepository.findByExternalSystemIgnoreCaseAndExternalReservationId(SYSTEM_NAME, externalId)
                .orElseGet(RoomBooking::new);

        booking.setRoomCode(room.getCode().trim().toUpperCase(Locale.ROOT));
        booking.setGuestName(isBlank(reservation.guestName()) ? DEFAULT_GUEST_NAME : reservation.guestName());
        booking.setSource(isBlank(reservation.source()) ? BLOCK_SOURCE : reservation.source());
        booking.setPhone("");
        booking.setAdults(1);
        booking.setChildren(0);
        booking.setCheckInAt(date.atTime(properties.getBlockCheckInHour(), 0));
        booking.setCheckOutAt(date.plusDays(1).atTime(properties.getBlockCheckOutHour(), 0));
        booking.setStatus(RoomBookingStatus.SOPHIA_BLOCK);
        booking.setVillaRate(null);
        booking.setDepositAmount(null);
        booking.setRemainingAmount(null);
        booking.setExternalSystem(SYSTEM_NAME);
        booking.setExternalReservationId(externalId);
        booking.setNotes(buildBlockNotes(reservation, date));
        roomBookingRepository.save(booking);
    }

    private String buildBlockNotes(ParsedReservation reservation, LocalDate date) {
        StringBuilder builder = new StringBuilder("Synced from Sophia for ").append(date);
        if (!isBlank(reservation.bookingCode())) {
            builder.append(" [").append(reservation.bookingCode()).append("]");
        }
        if (!isBlank(reservation.title())) {
            builder.append(" ").append(reservation.title().replaceAll("\\s+", " ").trim());
        }
        return builder.toString();
    }

    private ParsedSchedulerWindow parseSchedulerWindow(String html) throws IOException {
        Document document = Jsoup.parse(html);
        if (isLoginPage(html)) {
            throw new IOException("Sophia returned login page instead of BookingList.");
        }

        LocalDate windowStart = extractSelectedDate(document)
                .orElseThrow(() -> new IOException("Could not determine Sophia selected date."));
        Elements dayHeaders = document.select(".rsHorizontalHeaderTable th");
        int dayCount = Math.max(1, dayHeaders.size());
        double contentWidth = extractContentWidth(document).orElse(126D * dayCount);
        double dayWidth = dayCount == 0 ? 126D : contentWidth / dayCount;

        List<ParsedReservation> reservations = new ArrayList<>();
        Elements rows = document.select(".rsAllDayTable tr.rsAllDayRow");
        for (int rowIndex = 1; rowIndex < rows.size(); rowIndex++) {
            Element row = rows.get(rowIndex);
            Elements cells = row.children();
            for (int cellIndex = 0; cellIndex < cells.size(); cellIndex++) {
                Element cell = cells.get(cellIndex);
                for (Element appointment : cell.select("> .rsWrap > .rsApt")) {
                    int spanDays = estimateSpanDays(appointment.attr("style"), dayWidth, dayCount - cellIndex);
                    reservations.add(new ParsedReservation(
                            extractBookingCode(appointment.attr("title")),
                            extractGuestName(appointment),
                            extractSource(appointment),
                            extractVillaCodes(appointment.attr("title")),
                            appointment.attr("title"),
                            windowStart.plusDays(cellIndex),
                            windowStart.plusDays(Math.min(dayCount, cellIndex + spanDays))
                    ));
                }
            }
        }

        return new ParsedSchedulerWindow(windowStart, dayCount, reservations);
    }

    private boolean hasSchedulerData(String html) {
        if (html == null || html.isBlank()) {
            return false;
        }
        Document document = Jsoup.parse(html);
        return !document.select(".rsHorizontalHeaderTable th").isEmpty()
                && !document.select(".rsAllDayTable tr.rsAllDayRow").isEmpty();
    }

    private boolean isWithinWindow(LocalDate requestedStart, ParsedSchedulerWindow window) {
        LocalDate windowEndExclusive = window.windowStart().plusDays(window.dayCount());
        return (requestedStart.isEqual(window.windowStart()) || requestedStart.isAfter(window.windowStart()))
                && requestedStart.isBefore(windowEndExclusive);
    }

    private Optional<Double> extractContentWidth(Document document) {
        Element widthHolder = document.selectFirst(".rsHorizontalHeaderWrapper > div[style*=width], .rsContentWrapper[style*=width]");
        if (widthHolder == null) {
            return Optional.empty();
        }
        return extractPixelWidth(widthHolder.attr("style"));
    }

    private boolean matchesRequestedWindow(Document document, LocalDate requestedStart, int minimumDayCount) {
        Optional<LocalDate> selectedDate = extractSelectedDate(document);
        int dayCount = document.select(".rsHorizontalHeaderTable th").size();
        return selectedDate.isPresent() && selectedDate.get().equals(requestedStart) && dayCount >= minimumDayCount;
    }

    private Optional<LocalDate> extractSelectedDate(Document document) {
        // #region debug-point B:date-markers
        Element debugStateInput = document.selectFirst("input[id$=_SelectedDateCalendar_SD], input[name$=SelectedDateCalendar_SD]");
        Element debugSummary = document.selectFirst("[id^=sum-]");
        Element debugHeading = document.selectFirst("h2, .rsTopWrap h2");
        Element debugDayHeader = document.selectFirst(".rsHorizontalHeaderTable th div");
        debugReport("B", "SophiaCalendarSyncService.extractSelectedDate:401", "[DEBUG] Sophia date markers scanned", Map.of(
                "selectedDateValue", debugStateInput != null ? clip(debugStateInput.attr("value"), 120) : "",
                "summaryId", debugSummary != null ? debugSummary.id() : "",
                "headingText", debugHeading != null ? clip(debugHeading.text(), 120) : "",
                "dayHeaderText", debugDayHeader != null ? clip(debugDayHeader.text(), 120) : "",
                "summaryCount", Integer.toString(document.select("[id^=sum-]").size()),
                "dayHeaderCount", Integer.toString(document.select(".rsHorizontalHeaderTable th").size())
        ));
        // #endregion
        Element stateInput = document.selectFirst("input[id$=_SelectedDateCalendar_SD]");
        if (stateInput == null) {
            stateInput = document.selectFirst("input[name$=SelectedDateCalendar_SD]");
        }
        if (stateInput != null) {
            Matcher matcher = SOPHIA_DATE_STATE_PATTERN.matcher(stateInput.attr("value"));
            if (matcher.find()) {
                int year = Integer.parseInt(matcher.group(1));
                int month = Integer.parseInt(matcher.group(2));
                int day = Integer.parseInt(matcher.group(3));
                return Optional.of(LocalDate.of(year, month, day));
            }
        }

        Optional<LocalDate> fromSummaryId = extractDateFromSummaryId(document);
        if (fromSummaryId.isPresent()) {
            return fromSummaryId;
        }

        Optional<LocalDate> fromHeader = extractDateFromRangeHeader(document);
        if (fromHeader.isPresent()) {
            return fromHeader;
        }

        return extractDateFromDayHeader(document);
    }

    // #region debug-point instrumentation
    private void debugReport(String hypothesisId, String location, String message, Map<String, String> data) {
        try {
            DebugConfig config = loadDebugConfig();
            String payload = "{\"sessionId\":\"" + jsonEscape(config.sessionId) + "\","
                    + "\"runId\":\"pre-fix\","
                    + "\"hypothesisId\":\"" + jsonEscape(hypothesisId) + "\","
                    + "\"location\":\"" + jsonEscape(location) + "\","
                    + "\"msg\":\"" + jsonEscape(message) + "\","
                    + "\"data\":" + toJsonObject(data) + ","
                    + "\"ts\":" + System.currentTimeMillis() + "}";
            HttpRequest request = HttpRequest.newBuilder(URI.create(config.serverUrl))
                    .timeout(Duration.ofSeconds(2))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                    .build();
            httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding());
        } catch (Exception ignored) {
        }
    }

    private DebugConfig loadDebugConfig() {
        String serverUrl = "http://127.0.0.1:7777/event";
        String sessionId = "sophia-date-parse";
        try {
            Path envPath = Path.of(".dbg", "sophia-date-parse.env");
            if (Files.exists(envPath)) {
                for (String line : Files.readAllLines(envPath, StandardCharsets.UTF_8)) {
                    if (line.startsWith("DEBUG_SERVER_URL=")) {
                        serverUrl = line.substring("DEBUG_SERVER_URL=".length()).trim();
                    } else if (line.startsWith("DEBUG_SESSION_ID=")) {
                        sessionId = line.substring("DEBUG_SESSION_ID=".length()).trim();
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return new DebugConfig(serverUrl, sessionId);
    }

    private String toJsonObject(Map<String, String> data) {
        return data.entrySet().stream()
                .map(entry -> "\"" + jsonEscape(entry.getKey()) + "\":\"" + jsonEscape(Objects.toString(entry.getValue(), "")) + "\"")
                .collect(Collectors.joining(",", "{", "}"));
    }

    private String jsonEscape(String value) {
        return Objects.toString(value, "")
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    private String clip(String value, int maxLength) {
        String normalized = Objects.toString(value, "").replaceAll("\\s+", " ").trim();
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    record DebugConfig(String serverUrl, String sessionId) {
    }
    // #endregion

    private Optional<LocalDate> extractDateFromSummaryId(Document document) {
        for (Element element : document.select("[id^=sum-]")) {
            Matcher matcher = ISO_DATE_IN_ID_PATTERN.matcher(element.id());
            if (matcher.find()) {
                return parseIsoDate(matcher.group(1));
            }
        }
        return Optional.empty();
    }

    private Optional<LocalDate> extractDateFromRangeHeader(Document document) {
        Element heading = document.selectFirst("h2, .rsTopWrap h2");
        if (heading == null) {
            return Optional.empty();
        }
        Matcher matcher = DAY_MONTH_RANGE_PATTERN.matcher(heading.text());
        if (!matcher.find()) {
            return Optional.empty();
        }

        int startDay = Integer.parseInt(matcher.group(1));
        int startMonth = Integer.parseInt(matcher.group(2));
        int endDay = Integer.parseInt(matcher.group(3));
        int endMonth = Integer.parseInt(matcher.group(4));

        int baseYear = LocalDate.now(ZoneId.of(properties.getZoneId())).getYear();
        int resolvedYear = endMonth < startMonth || (endMonth == startMonth && endDay < startDay) ? baseYear - 1 : baseYear;
        return Optional.of(LocalDate.of(resolvedYear, startMonth, startDay));
    }

    private Optional<LocalDate> extractDateFromDayHeader(Document document) {
        Element dayHeader = document.selectFirst(".rsHorizontalHeaderTable th div");
        if (dayHeader == null) {
            return Optional.empty();
        }
        Matcher matcher = DAY_MONTH_PATTERN.matcher(dayHeader.text());
        if (!matcher.find()) {
            return Optional.empty();
        }
        int day = Integer.parseInt(matcher.group(1));
        int month = Integer.parseInt(matcher.group(2));
        int year = LocalDate.now(ZoneId.of(properties.getZoneId())).getYear();
        return Optional.of(LocalDate.of(year, month, day));
    }

    private Optional<LocalDate> parseIsoDate(String value) {
        try {
            return Optional.of(LocalDate.parse(value, DATE_ID_FORMATTER));
        } catch (Exception exception) {
            return Optional.empty();
        }
    }

    private String extractBookingCode(String title) {
        Matcher matcher = BOOKING_CODE_PATTERN.matcher(Objects.toString(title, ""));
        if (!matcher.find()) {
            return "";
        }
        return matcher.group(1).trim();
    }

    private List<String> extractVillaCodes(String title) {
        Matcher matcher = VILLA_PATTERN.matcher(Objects.toString(title, ""));
        if (!matcher.find()) {
            return List.of();
        }
        Matcher numberMatcher = NUMBER_PATTERN.matcher(matcher.group(1));
        List<String> villas = new ArrayList<>();
        while (numberMatcher.find()) {
            villas.add(numberMatcher.group(1));
        }
        return villas;
    }

    private String extractGuestName(Element appointment) {
        Element guestContainer = appointment.selectFirst(".col-10");
        if (guestContainer == null) {
            return DEFAULT_GUEST_NAME;
        }
        List<String> lines = extractLinesFromHtml(guestContainer.html());
        return lines.isEmpty() ? DEFAULT_GUEST_NAME : lines.get(0);
    }

    private String extractSource(Element appointment) {
        Element guestContainer = appointment.selectFirst(".col-10");
        if (guestContainer == null) {
            return BLOCK_SOURCE;
        }
        List<String> lines = extractLinesFromHtml(guestContainer.html());
        return lines.size() > 1 ? lines.get(1) : BLOCK_SOURCE;
    }

    private List<String> extractLinesFromHtml(String html) {
        String[] parts = Objects.toString(html, "").split("(?i)<br\\s*/?>");
        List<String> lines = new ArrayList<>();
        for (String part : parts) {
            String text = Jsoup.parseBodyFragment(part).text().replaceAll("\\s+", " ").trim();
            if (!text.isBlank()) {
                lines.add(text);
            }
        }
        return lines;
    }

    private int estimateSpanDays(String style, double dayWidth, int remainingColumns) {
        Optional<Double> width = extractPixelWidth(style);
        if (width.isEmpty() || dayWidth <= 0) {
            return 1;
        }
        int estimated = Math.max(1, (int) Math.round(width.get() / dayWidth));
        return Math.min(Math.max(1, remainingColumns), estimated);
    }

    private Optional<Double> extractPixelWidth(String style) {
        Matcher matcher = STYLE_WIDTH_PATTERN.matcher(Objects.toString(style, ""));
        if (!matcher.find()) {
            return Optional.empty();
        }
        return Optional.of(Double.parseDouble(matcher.group(1)));
    }

    private HttpResponse<String> login(URI bookingListUri, HttpResponse<String> loginPageResponse) throws IOException, InterruptedException {
        Document loginPage = Jsoup.parse(loginPageResponse.body(), loginPageResponse.uri().toString());
        Map<String, String> formData = extractFormData(loginPage);
        formData.put("Login1$UserName", properties.getUsername());
        formData.put("Login1$Password", properties.getPassword());
        formData.put("Login1$LoginButton", "Sign In");

        HttpResponse<String> loginResponse = post(resolveFormAction(loginPage, loginPageResponse.uri()), formData);
        if (isLoginPage(loginResponse.body())) {
            throw new IOException("Sophia login failed. Please verify username/password.");
        }
        HttpResponse<String> bookingListResponse = get(bookingListUri);
        if (isLoginPage(bookingListResponse.body())) {
            throw new IOException("Sophia login succeeded but BookingList is still protected.");
        }
        return bookingListResponse;
    }

    private HttpResponse<String> get(URI uri) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofMillis(Math.max(1_000L, properties.getTimeoutMs())))
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7")
                .header("Cache-Control", "no-cache")
                .header("Pragma", "no-cache")
                .header("User-Agent", properties.getUserAgent())
                .GET()
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private HttpResponse<String> post(URI uri, Map<String, String> formData) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofMillis(Math.max(1_000L, properties.getTimeoutMs())))
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7")
                .header("Cache-Control", "no-cache")
                .header("Pragma", "no-cache")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("User-Agent", properties.getUserAgent())
                .POST(HttpRequest.BodyPublishers.ofString(encodeForm(formData), StandardCharsets.UTF_8))
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private HttpResponse<String> navigateToNextPeriod(Document document, URI baseUri) throws IOException, InterruptedException {
        Map<String, String> formData = extractFormData(document);
        formData.put("__EVENTTARGET", SCHEDULER_EVENT_TARGET);
        formData.put("__EVENTARGUMENT", NAVIGATE_TO_NEXT_PERIOD_ARGUMENT);
        formData.put("ctl00$MainContent$txtCompanyId", properties.getCompanyId());
        formData.put("ctl00$MainContent$txtUserId", properties.getUserId());
        return post(resolveFormAction(document, baseUri), formData);
    }

    private Map<String, String> extractFormData(Document document) {
        Element form = document.selectFirst("form");
        if (form == null) {
            return new LinkedHashMap<>();
        }
        Map<String, String> data = new LinkedHashMap<>();
        for (Element input : form.select("input[name]")) {
            String type = input.attr("type").toLowerCase(Locale.ROOT);
            if ("checkbox".equals(type) || "radio".equals(type)) {
                if (!input.hasAttr("checked")) {
                    continue;
                }
            }
            data.put(input.attr("name"), input.attr("value"));
        }
        for (Element select : form.select("select[name]")) {
            data.put(select.attr("name"), select.val());
        }
        for (Element textarea : form.select("textarea[name]")) {
            data.put(textarea.attr("name"), textarea.val());
        }
        return data;
    }

    private URI resolveFormAction(Document document, URI baseUri) {
        Element form = document.selectFirst("form");
        if (form == null || isBlank(form.attr("action"))) {
            return baseUri;
        }
        return baseUri.resolve(form.attr("action"));
    }

    private URI buildBookingListUri() {
        String base = properties.getBaseUrl().endsWith("/") ? properties.getBaseUrl() : properties.getBaseUrl() + "/";
        String url = base + "BookingList?comId="
                + urlEncode(properties.getCompanyId())
                + "&userId="
                + urlEncode(properties.getUserId());
        return URI.create(url);
    }

    private boolean isLoginPage(String body) {
        return body != null && body.contains("Sophia PMS - Login");
    }

    private String encodeForm(Map<String, String> formData) {
        return formData.entrySet().stream()
                .map(entry -> urlEncode(entry.getKey()) + "=" + urlEncode(entry.getValue()))
                .collect(Collectors.joining("&"));
    }

    private String buildExternalReservationId(String roomCode, String bookingCode, LocalDate date) {
        String normalizedBookingCode = isBlank(bookingCode) ? "UNKNOWN" : bookingCode.replaceAll("[^A-Za-z0-9_-]", "").toUpperCase(Locale.ROOT);
        return normalizeCode(roomCode) + "-" + date.format(DATE_ID_FORMATTER) + "-" + normalizedBookingCode;
    }

    private static String normalizeCode(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static void appendLog(List<String> logs, String line) {
        if (logs != null) {
            logs.add(line);
        }
    }

    private static String urlEncode(String value) {
        return URLEncoder.encode(Objects.toString(value, ""), StandardCharsets.UTF_8);
    }

    private static LocalDate minDate(LocalDate left, LocalDate right) {
        return left.isBefore(right) ? left : right;
    }

    private static LocalDate maxDate(LocalDate left, LocalDate right) {
        return left.isAfter(right) ? left : right;
    }

    record ParsedSchedulerWindow(
            LocalDate windowStart,
            int dayCount,
            List<ParsedReservation> reservations
    ) {
    }

    record ParsedReservation(
            String bookingCode,
            String guestName,
            String source,
            List<String> villaCodes,
            String title,
            LocalDate startDate,
            LocalDate endDateExclusive
    ) {
    }

    record SyncRange(
            LocalDate from,
            LocalDate toExclusive
    ) {
    }

    static class SyncStats {
        private final Set<String> roomCodes = new LinkedHashSet<>();
        private int reservationCount;
        private int blockedCount;
        private int releasedCount;
        private int missingRoomCount;
        private int errorCount;
    }

    static class RoomAliasResolver {
        private final Map<String, Room> exactCodeMap;
        private final Map<String, List<Room>> digitMap;

        RoomAliasResolver(Collection<Room> rooms) {
            this.exactCodeMap = new LinkedHashMap<>();
            this.digitMap = new LinkedHashMap<>();
            for (Room room : rooms) {
                String normalized = normalizeCode(room.getCode());
                exactCodeMap.put(normalized, room);
                String digits = normalized.replaceAll("\\D", "");
                if (!digits.isBlank()) {
                    digitMap.computeIfAbsent(digits, ignored -> new ArrayList<>()).add(room);
                }
            }
        }

        Optional<Room> findRequestedRoom(String requestedRoomCode) {
            Room direct = exactCodeMap.get(requestedRoomCode);
            if (direct != null) {
                return Optional.of(direct);
            }
            String digits = requestedRoomCode.replaceAll("\\D", "");
            List<Room> matched = digitMap.getOrDefault(digits, List.of());
            return matched.stream().findFirst();
        }

        List<Room> resolve(List<String> villaCodes, String requestedRoomCode) {
            Set<Room> matched = new LinkedHashSet<>();
            for (String villaCode : villaCodes) {
                matched.addAll(findByVillaCode(villaCode));
            }
            if (matched.isEmpty()) {
                return List.of();
            }
            if (requestedRoomCode.isBlank()) {
                return List.copyOf(matched);
            }
            return matched.stream()
                    .filter(room -> normalizeCode(room.getCode()).equals(requestedRoomCode))
                    .toList();
        }

        private List<Room> findByVillaCode(String villaCode) {
            if (isBlank(villaCode)) {
                return List.of();
            }
            String normalizedVilla = normalizeCode(villaCode);
            Set<Room> matched = new LinkedHashSet<>();
            Optional.ofNullable(exactCodeMap.get(normalizedVilla)).ifPresent(matched::add);
            Optional.ofNullable(exactCodeMap.get("V" + normalizedVilla)).ifPresent(matched::add);
            matched.addAll(digitMap.getOrDefault(normalizedVilla.replaceAll("\\D", ""), Collections.emptyList()));
            matched.addAll(exactCodeMap.values().stream()
                    .filter(room -> normalizeCode(room.getCode()).endsWith(normalizedVilla))
                    .toList());
            return List.copyOf(matched);
        }
    }
}
