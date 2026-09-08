package com.luxurytravel.backend.integration.lazhost;

import com.luxurytravel.backend.room.RoomRepository;
import com.luxurytravel.backend.roombooking.RoomBookingRepository;
import com.luxurytravel.backend.villasetting.VillaSettingCategory;
import com.luxurytravel.backend.villasetting.VillaSettingOption;
import com.luxurytravel.backend.villasetting.VillaSettingRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class LazHostVillaTypeDashboardService {
    private final VillaSettingRepository villaSettingRepository;
    private final RoomRepository roomRepository;
    private final RoomBookingRepository roomBookingRepository;
    private final LazHostVillaTypeMappingRepository mappingRepository;
    private final LazHostVillaTypePriceRepository priceRepository;

    public LazHostVillaTypeDashboardService(
            VillaSettingRepository villaSettingRepository,
            RoomRepository roomRepository,
            RoomBookingRepository roomBookingRepository,
            LazHostVillaTypeMappingRepository mappingRepository,
            LazHostVillaTypePriceRepository priceRepository
    ) {
        this.villaSettingRepository = villaSettingRepository;
        this.roomRepository = roomRepository;
        this.roomBookingRepository = roomBookingRepository;
        this.mappingRepository = mappingRepository;
        this.priceRepository = priceRepository;
    }

    @Transactional(readOnly = true)
    public LazHostVillaTypeDashboardResponse load(LocalDate from, LocalDate to) {
        DateRange range = buildRange(from, to);

        List<VillaSettingOption> roomTypes = villaSettingRepository.findAllByOrderByCategoryAscIdAsc().stream()
                .filter(option -> option.getCategory() == VillaSettingCategory.ROOM_TYPE)
                .filter(VillaSettingOption::isActive)
                .toList();

        Map<String, Long> totals = toCountMap(roomRepository.countActiveUnitsByRoomType());
        Map<String, Long> booked = toCountMap(roomBookingRepository.countBookedUnitsByRoomType(range.fromAt(), range.toAt()));

        Map<String, LazHostVillaTypeMapping> mappings = mappingRepository.findAll().stream()
                .collect(Collectors.toMap(m -> normalizeKey(m.getVillaTypeCode()), m -> m, (a, b) -> a));

        Map<String, LazHostVillaTypePrice> prices = priceRepository.findAllByFromDateAndToDate(range.from(), range.to()).stream()
                .collect(Collectors.toMap(p -> normalizeKey(p.getVillaTypeCode()) + "|" + p.getChannel().name(), p -> p, (a, b) -> a));

        List<LazHostVillaTypeDashboardResponse.LazHostVillaTypeDashboardItem> items = new ArrayList<>();
        for (VillaSettingOption roomType : roomTypes) {
            String code = roomType.getLabel() == null ? "" : roomType.getLabel().trim();
            String key = normalizeKey(code);

            long totalUnits = totals.getOrDefault(key, 0L);
            long bookedUnits = booked.getOrDefault(key, 0L);
            long availableUnits = Math.max(0, totalUnits - bookedUnits);

            LazHostVillaTypeMapping mapping = mappings.get(key);
            LazHostVillaTypePrice pmsPrice = prices.get(key + "|" + LazHostPriceChannel.PMS.name());
            LazHostVillaTypePrice otaPrice = prices.get(key + "|" + LazHostPriceChannel.OTA.name());

            String currency = "VND";
            if (pmsPrice != null && pmsPrice.getCurrency() != null && !pmsPrice.getCurrency().isBlank()) {
                currency = pmsPrice.getCurrency().trim();
            } else if (otaPrice != null && otaPrice.getCurrency() != null && !otaPrice.getCurrency().isBlank()) {
                currency = otaPrice.getCurrency().trim();
            }

            items.add(new LazHostVillaTypeDashboardResponse.LazHostVillaTypeDashboardItem(
                    code,
                    totalUnits,
                    bookedUnits,
                    availableUnits,
                    mapping == null || mapping.isActive(),
                    mapping == null ? "" : safe(mapping.getLazHostRoomCode()),
                    mapping == null ? "" : safe(mapping.getLazHostRatePlanCode()),
                    pmsPrice == null ? null : pmsPrice.getPrice(),
                    otaPrice == null ? null : otaPrice.getPrice(),
                    currency
            ));
        }

        return new LazHostVillaTypeDashboardResponse(range.from(), range.to(), items);
    }

    @Transactional
    public LazHostVillaTypeDashboardResponse upsert(LazHostVillaTypeDashboardUpsertRequest request) {
        DateRange range = buildRange(request.from(), request.to());
        Set<String> activeRoomTypeKeys = villaSettingRepository.findAllByOrderByCategoryAscIdAsc().stream()
                .filter(option -> option.getCategory() == VillaSettingCategory.ROOM_TYPE)
                .filter(VillaSettingOption::isActive)
                .map(VillaSettingOption::getLabel)
                .filter(label -> label != null && !label.isBlank())
                .map(this::normalizeKey)
                .collect(Collectors.toSet());

        if (request.items() != null) {
            for (LazHostVillaTypeDashboardUpsertRequest.Item item : request.items()) {
                if (item == null) continue;
                String code = safe(item.villaTypeCode());
                if (code.isBlank()) continue;
                String key = normalizeKey(code);
                if (!activeRoomTypeKeys.contains(key)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Villa type khong hop le: " + code);
                }

                upsertMapping(code, item);
                upsertPrice(code, LazHostPriceChannel.PMS, range.from(), range.to(), item.pmsPrice(), item.currency());
                upsertPrice(code, LazHostPriceChannel.OTA, range.from(), range.to(), item.otaPrice(), item.currency());
            }
        }

        return load(range.from(), range.to());
    }

    private void upsertMapping(String villaTypeCode, LazHostVillaTypeDashboardUpsertRequest.Item item) {
        String lazHostRoomCode = safe(item.lazHostRoomCode());
        String lazHostRatePlanCode = trimToNull(item.lazHostRatePlanCode());
        boolean active = item.mappingActive() == null || item.mappingActive();

        LazHostVillaTypeMapping existing = mappingRepository.findByVillaTypeCodeIgnoreCase(villaTypeCode).orElse(null);
        if (lazHostRoomCode.isBlank()) {
            if (existing != null) {
                existing.setActive(active);
                existing.setNotes("");
                existing.setLazHostRoomCode(existing.getLazHostRoomCode());
                existing.setLazHostRatePlanCode(existing.getLazHostRatePlanCode());
                mappingRepository.save(existing);
            }
            return;
        }

        if (existing == null) {
            if (mappingRepository.existsByLazHostRoomCodeIgnoreCase(lazHostRoomCode)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Ma roomCode LazHost da duoc su dung: " + lazHostRoomCode);
            }
            LazHostVillaTypeMapping mapping = new LazHostVillaTypeMapping();
            mapping.setVillaTypeCode(villaTypeCode.trim());
            mapping.setLazHostRoomCode(lazHostRoomCode);
            mapping.setLazHostRatePlanCode(lazHostRatePlanCode);
            mapping.setActive(active);
            mappingRepository.save(mapping);
            return;
        }

        if (mappingRepository.existsByLazHostRoomCodeIgnoreCaseAndIdNot(lazHostRoomCode, existing.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ma roomCode LazHost da duoc su dung: " + lazHostRoomCode);
        }
        existing.setLazHostRoomCode(lazHostRoomCode);
        existing.setLazHostRatePlanCode(lazHostRatePlanCode);
        existing.setActive(active);
        mappingRepository.save(existing);
    }

    private void upsertPrice(String villaTypeCode, LazHostPriceChannel channel, LocalDate from, LocalDate to, Double price, String currency) {
        if (price == null) {
            return;
        }
        if (price < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Gia khong hop le");
        }

        String normalizedCurrency = currency == null || currency.isBlank() ? "VND" : currency.trim().toUpperCase(Locale.ROOT);

        LazHostVillaTypePrice existing = priceRepository.findByVillaTypeCodeIgnoreCaseAndChannelAndFromDateAndToDate(villaTypeCode, channel, from, to)
                .orElse(null);
        if (existing == null) {
            LazHostVillaTypePrice next = new LazHostVillaTypePrice();
            next.setVillaTypeCode(villaTypeCode.trim());
            next.setChannel(channel);
            next.setFromDate(from);
            next.setToDate(to);
            next.setPrice(price);
            next.setCurrency(normalizedCurrency);
            priceRepository.save(next);
            return;
        }
        existing.setPrice(price);
        existing.setCurrency(normalizedCurrency);
        priceRepository.save(existing);
    }

    private DateRange buildRange(LocalDate from, LocalDate to) {
        LocalDate rangeStart = from;
        LocalDate rangeEnd = to;
        LocalDate today = LocalDate.now();

        if (rangeStart == null && rangeEnd == null) {
            rangeStart = today;
            rangeEnd = today.plusDays(6);
        } else if (rangeStart != null && rangeEnd == null) {
            rangeEnd = rangeStart.plusDays(6);
        } else if (rangeStart == null) {
            rangeStart = rangeEnd.minusDays(6);
        }
        if (rangeEnd.isBefore(rangeStart)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date must be on or after start date");
        }

        LocalDateTime fromAt = rangeStart.atStartOfDay();
        LocalDateTime toAt = rangeEnd.plusDays(1).atStartOfDay();
        return new DateRange(rangeStart, rangeEnd, fromAt, toAt);
    }

    private Map<String, Long> toCountMap(List<Object[]> rows) {
        Map<String, Long> result = new HashMap<>();
        if (rows == null) return result;
        for (Object[] row : rows) {
            if (row == null || row.length < 2) continue;
            Object keyValue = row[0];
            Object countValue = row[1];
            if (!(keyValue instanceof String keyString)) continue;
            long count = 0L;
            if (countValue instanceof Number n) {
                count = n.longValue();
            }
            result.put(normalizeKey(keyString), count);
        }
        return result;
    }

    private String normalizeKey(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private record DateRange(LocalDate from, LocalDate to, LocalDateTime fromAt, LocalDateTime toAt) {
    }
}
