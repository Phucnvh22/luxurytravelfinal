package com.luxurytravel.backend.villasetting;

import com.luxurytravel.backend.room.RoomRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class VillaSettingService {
    private final VillaSettingRepository villaSettingRepository;
    private final RoomRepository roomRepository;

    public VillaSettingService(VillaSettingRepository villaSettingRepository, RoomRepository roomRepository) {
        this.villaSettingRepository = villaSettingRepository;
        this.roomRepository = roomRepository;
    }

    @Transactional(readOnly = true)
    public VillaSettingsResponse findAllGrouped() {
        List<VillaSettingOption> all = villaSettingRepository.findAllByOrderByCategoryAscIdAsc();
        List<VillaSettingOption> roomTypes = all.stream()
                .filter(option -> option.getCategory() == VillaSettingCategory.ROOM_TYPE)
                .toList();
        List<VillaSettingOption> bedroomLayouts = all.stream()
                .filter(option -> option.getCategory() == VillaSettingCategory.BEDROOM_LAYOUT)
                .toList();
        List<VillaSettingOption> hosts = all.stream()
                .filter(option -> option.getCategory() == VillaSettingCategory.HOST)
                .toList();
        List<VillaSettingOption> bookingSources = all.stream()
                .filter(option -> option.getCategory() == VillaSettingCategory.BOOKING_SOURCE)
                .toList();
        List<VillaSettingOption> supportLinks = all.stream()
                .filter(option -> option.getCategory() == VillaSettingCategory.SUPPORT_LINK)
                .toList();
        return new VillaSettingsResponse(roomTypes, bedroomLayouts, hosts, bookingSources, supportLinks);
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
        VillaSettingCategory previousCategory = option.getCategory();
        String previousLabel = option.getLabel() == null ? "" : option.getLabel().trim();
        VillaSettingCategory category = normalizeCategory(request.getCategory());
        String label = normalizeLabel(request.getLabel(), category);
        if (villaSettingRepository.existsByCategoryAndLabelIgnoreCaseAndIdNot(category, label, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, buildDuplicateMessage(category));
        }
        validateCategoryChangeAllowed(previousCategory, previousLabel, category);

        apply(option, category, label, false);
        VillaSettingOption saved = villaSettingRepository.save(option);
        syncRoomsForSettingRename(previousCategory, previousLabel, category, label);
        return saved;
    }

    @Transactional
    public void delete(Long id) {
        VillaSettingOption option = findById(id);
        validateDeleteAllowed(option);
        villaSettingRepository.delete(option);
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
            case BEDROOM_LAYOUT -> "Bedroom layout already exists";
            case HOST -> "Host already exists";
            case BOOKING_SOURCE -> "Booking source already exists";
            case SUPPORT_LINK -> "Support link already exists";
        };
    }

    private String buildRequiredMessage(VillaSettingCategory category) {
        return switch (category) {
            case ROOM_TYPE -> "Room type is required";
            case BEDROOM_LAYOUT -> "Bedroom layout is required";
            case HOST -> "Host is required";
            case BOOKING_SOURCE -> "Booking source is required";
            case SUPPORT_LINK -> "Support link is required";
        };
    }

    private void validateDeleteAllowed(VillaSettingOption option) {
        String label = option.getLabel() == null ? "" : option.getLabel().trim();
        if (label.isBlank()) {
            return;
        }

        boolean inUse = switch (option.getCategory()) {
            case ROOM_TYPE -> roomRepository.existsByTypeIgnoreCase(label);
            case BEDROOM_LAYOUT -> roomRepository.existsByBedroomLayoutIgnoreCase(label);
            case HOST -> roomRepository.existsByHostIgnoreCase(label);
            case BOOKING_SOURCE, SUPPORT_LINK -> false;
        };

        if (!inUse) {
            return;
        }

        throw new ResponseStatusException(HttpStatus.CONFLICT, buildDeleteBlockedMessage(option.getCategory()));
    }

    private void validateCategoryChangeAllowed(
            VillaSettingCategory previousCategory,
            String previousLabel,
            VillaSettingCategory nextCategory
    ) {
        if (previousCategory == nextCategory || previousLabel.isBlank()) {
            return;
        }

        boolean inUse = switch (previousCategory) {
            case ROOM_TYPE -> roomRepository.existsByTypeIgnoreCase(previousLabel);
            case BEDROOM_LAYOUT -> roomRepository.existsByBedroomLayoutIgnoreCase(previousLabel);
            case HOST -> roomRepository.existsByHostIgnoreCase(previousLabel);
            case BOOKING_SOURCE, SUPPORT_LINK -> false;
        };

        if (!inUse) {
            return;
        }

        throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Cannot change this setting category because one or more villas are using it"
        );
    }

    private void syncRoomsForSettingRename(
            VillaSettingCategory previousCategory,
            String previousLabel,
            VillaSettingCategory nextCategory,
            String nextLabel
    ) {
        if (previousCategory != nextCategory || previousLabel.isBlank() || previousLabel.equalsIgnoreCase(nextLabel)) {
            return;
        }

        List<com.luxurytravel.backend.room.Room> roomsToUpdate = switch (nextCategory) {
            case ROOM_TYPE -> roomRepository.findAllByTypeIgnoreCase(previousLabel);
            case BEDROOM_LAYOUT -> roomRepository.findAllByBedroomLayoutIgnoreCase(previousLabel);
            case HOST -> roomRepository.findAllByHostIgnoreCase(previousLabel);
            case BOOKING_SOURCE, SUPPORT_LINK -> List.of();
        };

        if (roomsToUpdate.isEmpty()) {
            return;
        }

        for (com.luxurytravel.backend.room.Room room : roomsToUpdate) {
            if (nextCategory == VillaSettingCategory.ROOM_TYPE) {
                room.setType(nextLabel);
            } else if (nextCategory == VillaSettingCategory.BEDROOM_LAYOUT) {
                room.setBedroomLayout(nextLabel);
            } else if (nextCategory == VillaSettingCategory.HOST) {
                room.setHost(nextLabel);
            }
        }

        roomRepository.saveAll(roomsToUpdate);
    }

    private String buildDeleteBlockedMessage(VillaSettingCategory category) {
        return switch (category) {
            case ROOM_TYPE -> "Cannot delete this villa type because one or more villas are using it";
            case BEDROOM_LAYOUT -> "Cannot delete this bedroom layout because one or more villas are using it";
            case HOST -> "Cannot delete this host because one or more villas are using it";
            case BOOKING_SOURCE -> "Cannot delete this booking source because it is being used";
            case SUPPORT_LINK -> "Cannot delete this support link because it is being used";
        };
    }
}
