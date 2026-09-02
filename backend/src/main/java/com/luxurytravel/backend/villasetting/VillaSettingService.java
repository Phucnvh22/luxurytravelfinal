package com.luxurytravel.backend.villasetting;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class VillaSettingService {
    private final VillaSettingRepository villaSettingRepository;

    public VillaSettingService(VillaSettingRepository villaSettingRepository) {
        this.villaSettingRepository = villaSettingRepository;
    }

    @Transactional(readOnly = true)
    public VillaSettingsResponse findAllGrouped() {
        List<VillaSettingOption> all = villaSettingRepository.findAllByOrderByCategoryAscIdAsc();
        List<VillaSettingOption> roomTypes = all.stream()
                .filter(option -> option.getCategory() == VillaSettingCategory.ROOM_TYPE)
                .toList();
        List<VillaSettingOption> hosts = all.stream()
                .filter(option -> option.getCategory() == VillaSettingCategory.HOST)
                .toList();
        List<VillaSettingOption> bookingSources = all.stream()
                .filter(option -> option.getCategory() == VillaSettingCategory.BOOKING_SOURCE)
                .toList();
        return new VillaSettingsResponse(roomTypes, hosts, bookingSources);
    }

    @Transactional(readOnly = true)
    public VillaSettingOption findById(Long id) {
        return villaSettingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Villa setting does not exist"));
    }

    @Transactional
    public VillaSettingOption create(VillaSettingUpsertRequest request) {
        VillaSettingCategory category = normalizeCategory(request.getCategory());
        String label = normalizeLabel(request.getLabel(), category);
        if (villaSettingRepository.existsByCategoryAndLabelIgnoreCase(category, label)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, buildDuplicateMessage(category));
        }

        VillaSettingOption option = new VillaSettingOption();
        apply(option, category, label, true);
        return villaSettingRepository.save(option);
    }

    @Transactional
    public VillaSettingOption update(Long id, VillaSettingUpsertRequest request) {
        VillaSettingOption option = findById(id);
        VillaSettingCategory category = normalizeCategory(request.getCategory());
        String label = normalizeLabel(request.getLabel(), category);
        if (villaSettingRepository.existsByCategoryAndLabelIgnoreCaseAndIdNot(category, label, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, buildDuplicateMessage(category));
        }

        apply(option, category, label, false);
        return villaSettingRepository.save(option);
    }

    @Transactional
    public void delete(Long id) {
        villaSettingRepository.delete(findById(id));
    }

    private void apply(VillaSettingOption option, VillaSettingCategory category, String label, boolean creating) {
        option.setCategory(category);
        option.setLabel(label);
        if (creating) {
            option.setSortOrder(0);
        }
        option.setActive(true);
    }

    private VillaSettingCategory normalizeCategory(VillaSettingCategory category) {
        if (category == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Villa setting category is required");
        }
        return category;
    }

    private String normalizeLabel(String value, VillaSettingCategory category) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, buildRequiredMessage(category));
        }
        return normalized;
    }

    private String buildDuplicateMessage(VillaSettingCategory category) {
        return switch (category) {
            case ROOM_TYPE -> "Room type already exists";
            case HOST -> "Host already exists";
            case BOOKING_SOURCE -> "Booking source already exists";
        };
    }

    private String buildRequiredMessage(VillaSettingCategory category) {
        return switch (category) {
            case ROOM_TYPE -> "Room type is required";
            case HOST -> "Host is required";
            case BOOKING_SOURCE -> "Booking source is required";
        };
    }
}
