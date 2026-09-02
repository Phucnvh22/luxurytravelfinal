package com.luxurytravel.backend.roomarea;

import com.luxurytravel.backend.room.RoomRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class RoomAreaService {
    private final RoomAreaRepository roomAreaRepository;
    private final RoomRepository roomRepository;

    public RoomAreaService(RoomAreaRepository roomAreaRepository, RoomRepository roomRepository) {
        this.roomAreaRepository = roomAreaRepository;
        this.roomRepository = roomRepository;
    }

    @Transactional(readOnly = true)
    public List<RoomArea> findAll() {
        return roomAreaRepository.findAllByOrderBySortOrderAscNameAsc();
    }

    @Transactional(readOnly = true)
    public RoomArea findById(Long id) {
        return roomAreaRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Area does not exist"));
    }

    @Transactional
    public RoomArea create(RoomAreaUpsertRequest request) {
        String name = normalizeName(request.getName());
        String code = generateUniqueCode(name, null);
        if (roomAreaRepository.existsByNameIgnoreCase(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Area name already exists");
        }

        RoomArea area = new RoomArea();
        apply(area, request, code, name);
        return roomAreaRepository.save(area);
    }

    @Transactional
    public RoomArea update(Long id, RoomAreaUpsertRequest request) {
        RoomArea area = findById(id);
        String name = normalizeName(request.getName());
        String code = generateUniqueCode(name, id);
        if (roomAreaRepository.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Area name already exists");
        }

        apply(area, request, code, name);
        return roomAreaRepository.save(area);
    }

    @Transactional
    public void delete(Long id) {
        RoomArea area = findById(id);
        if (roomRepository.existsByArea_Id(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Area already has villas and cannot be deleted");
        }
        roomAreaRepository.delete(area);
    }

    private void apply(RoomArea area, RoomAreaUpsertRequest request, String code, String name) {
        area.setCode(code);
        area.setName(name);
        area.setSortOrder(request.getSortOrder());
        area.setActive(Boolean.TRUE.equals(request.getActive()));
    }

    private String generateUniqueCode(String name, Long currentId) {
        String baseCode = name.toUpperCase()
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        if (baseCode.isBlank()) {
            baseCode = "AREA";
        }

        String candidate = baseCode.substring(0, Math.min(baseCode.length(), 50));
        int suffix = 2;
        while (currentId == null
                ? roomAreaRepository.existsByCodeIgnoreCase(candidate)
                : roomAreaRepository.existsByCodeIgnoreCaseAndIdNot(candidate, currentId)) {
            String next = baseCode + "_" + suffix
;
            candidate = next.substring(0, Math.min(next.length(), 50));
            suffix++;
        }
        return candidate;
    }

    private String normalizeName(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Area name is required");
        }
        return normalized;
    }
}
