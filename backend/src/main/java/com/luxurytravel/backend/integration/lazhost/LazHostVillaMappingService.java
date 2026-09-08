package com.luxurytravel.backend.integration.lazhost;

import com.luxurytravel.backend.room.RoomRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class LazHostVillaMappingService {
    private final LazHostVillaMappingRepository mappingRepository;
    private final RoomRepository roomRepository;

    public LazHostVillaMappingService(LazHostVillaMappingRepository mappingRepository, RoomRepository roomRepository) {
        this.mappingRepository = mappingRepository;
        this.roomRepository = roomRepository;
    }

    @Transactional(readOnly = true)
    public List<LazHostVillaMapping> list() {
        return mappingRepository.findAllByOrderByRoomCodeAsc();
    }

    @Transactional(readOnly = true)
    public LazHostVillaMapping getByRoomCode(String roomCode) {
        return mappingRepository.findByRoomCodeIgnoreCase(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chua co mapping villa"));
    }

    @Transactional(readOnly = true)
    public LazHostVillaMapping getActiveByRoomCode(String roomCode) {
        LazHostVillaMapping mapping = getByRoomCode(roomCode);
        if (!mapping.isActive()) {
            throw new ResponseStatusException(HttpStatus.PRECONDITION_FAILED, "Mapping villa dang tam tat");
        }
        return mapping;
    }

    @Transactional
    public LazHostVillaMapping create(LazHostVillaMappingUpsertRequest request) {
        String roomCode = normalizeRoomCode(request.getRoomCode());
        String lazHostRoomCode = normalizeLazHostRoomCode(request.getLazHostRoomCode());

        if (!roomRepository.existsByCodeIgnoreCase(roomCode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Villa noi bo khong ton tai");
        }
        if (mappingRepository.existsByRoomCodeIgnoreCase(roomCode)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Villa nay da co mapping LazHost");
        }
        if (mappingRepository.existsByLazHostRoomCodeIgnoreCase(lazHostRoomCode)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ma roomCode LazHost da duoc su dung");
        }

        LazHostVillaMapping mapping = new LazHostVillaMapping();
        apply(mapping, request, roomCode, lazHostRoomCode);
        return mappingRepository.save(mapping);
    }

    @Transactional
    public LazHostVillaMapping update(Long id, LazHostVillaMappingUpsertRequest request) {
        LazHostVillaMapping mapping = mappingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Khong tim thay mapping LazHost"));
        String roomCode = normalizeRoomCode(request.getRoomCode());
        String lazHostRoomCode = normalizeLazHostRoomCode(request.getLazHostRoomCode());

        if (!roomRepository.existsByCodeIgnoreCase(roomCode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Villa noi bo khong ton tai");
        }
        if (mappingRepository.existsByRoomCodeIgnoreCaseAndIdNot(roomCode, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Villa nay da co mapping LazHost");
        }
        if (mappingRepository.existsByLazHostRoomCodeIgnoreCaseAndIdNot(lazHostRoomCode, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ma roomCode LazHost da duoc su dung");
        }

        apply(mapping, request, roomCode, lazHostRoomCode);
        return mappingRepository.save(mapping);
    }

    @Transactional
    public void delete(Long id) {
        if (!mappingRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Khong tim thay mapping LazHost");
        }
        mappingRepository.deleteById(id);
    }

    private void apply(LazHostVillaMapping mapping, LazHostVillaMappingUpsertRequest request, String roomCode, String lazHostRoomCode) {
        mapping.setRoomCode(roomCode);
        mapping.setLazHostRoomCode(lazHostRoomCode);
        mapping.setLazHostRatePlanCode(trimToNull(request.getLazHostRatePlanCode()));
        mapping.setActive(request.getActive() == null || request.getActive());
        mapping.setNotes(request.getNotes() == null ? "" : request.getNotes().trim());
    }

    private String normalizeRoomCode(String roomCode) {
        return roomCode == null ? "" : roomCode.trim().toUpperCase();
    }

    private String normalizeLazHostRoomCode(String lazHostRoomCode) {
        return lazHostRoomCode == null ? "" : lazHostRoomCode.trim();
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
