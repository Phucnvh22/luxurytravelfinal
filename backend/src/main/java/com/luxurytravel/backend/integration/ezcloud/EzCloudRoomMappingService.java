package com.luxurytravel.backend.integration.ezcloud;

import com.luxurytravel.backend.room.RoomRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class EzCloudRoomMappingService {
    private final EzCloudRoomMappingRepository mappingRepository;
    private final RoomRepository roomRepository;

    public EzCloudRoomMappingService(EzCloudRoomMappingRepository mappingRepository, RoomRepository roomRepository) {
        this.mappingRepository = mappingRepository;
        this.roomRepository = roomRepository;
    }

    @Transactional(readOnly = true)
    public List<EzCloudRoomMapping> list() {
        return mappingRepository.findAllByOrderByRoomCodeAsc();
    }

    @Transactional(readOnly = true)
    public EzCloudRoomMapping getByRoomCode(String roomCode) {
        return mappingRepository.findByRoomCodeIgnoreCase(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chua co mapping phong"));
    }

    @Transactional(readOnly = true)
    public EzCloudRoomMapping getActiveByRoomCode(String roomCode) {
        EzCloudRoomMapping mapping = getByRoomCode(roomCode);
        if (!mapping.isActive()) {
            throw new ResponseStatusException(HttpStatus.PRECONDITION_FAILED, "Mapping phong dang tam tat");
        }
        return mapping;
    }

    @Transactional
    public EzCloudRoomMapping create(EzCloudRoomMappingUpsertRequest request) {
        String roomCode = normalizeRoomCode(request.getRoomCode());
        String ezCloudRoomCode = normalizeEzCloudRoomCode(request.getEzCloudRoomCode());

        if (!roomRepository.existsByCodeIgnoreCase(roomCode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phong noi bo khong ton tai");
        }
        if (mappingRepository.existsByRoomCodeIgnoreCase(roomCode)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Phong nay da co mapping ezCloud");
        }
        if (mappingRepository.existsByEzCloudRoomCodeIgnoreCase(ezCloudRoomCode)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ma phong ezCloud da duoc su dung");
        }

        EzCloudRoomMapping mapping = new EzCloudRoomMapping();
        apply(mapping, request, roomCode, ezCloudRoomCode);
        return mappingRepository.save(mapping);
    }

    @Transactional
    public EzCloudRoomMapping update(Long id, EzCloudRoomMappingUpsertRequest request) {
        EzCloudRoomMapping mapping = mappingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Khong tim thay mapping ezCloud"));
        String roomCode = normalizeRoomCode(request.getRoomCode());
        String ezCloudRoomCode = normalizeEzCloudRoomCode(request.getEzCloudRoomCode());

        if (!roomRepository.existsByCodeIgnoreCase(roomCode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phong noi bo khong ton tai");
        }
        if (mappingRepository.existsByRoomCodeIgnoreCaseAndIdNot(roomCode, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Phong nay da co mapping ezCloud");
        }
        if (mappingRepository.existsByEzCloudRoomCodeIgnoreCaseAndIdNot(ezCloudRoomCode, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ma phong ezCloud da duoc su dung");
        }

        apply(mapping, request, roomCode, ezCloudRoomCode);
        return mappingRepository.save(mapping);
    }

    @Transactional
    public void delete(Long id) {
        if (!mappingRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Khong tim thay mapping ezCloud");
        }
        mappingRepository.deleteById(id);
    }

    private void apply(EzCloudRoomMapping mapping, EzCloudRoomMappingUpsertRequest request, String roomCode, String ezCloudRoomCode) {
        mapping.setRoomCode(roomCode);
        mapping.setEzCloudRoomCode(ezCloudRoomCode);
        mapping.setEzCloudRatePlanCode(trimToNull(request.getEzCloudRatePlanCode()));
        mapping.setActive(request.getActive() == null || request.getActive());
        mapping.setNotes(request.getNotes() == null ? "" : request.getNotes().trim());
    }

    private String normalizeRoomCode(String roomCode) {
        return roomCode == null ? "" : roomCode.trim().toUpperCase();
    }

    private String normalizeEzCloudRoomCode(String ezCloudRoomCode) {
        return ezCloudRoomCode == null ? "" : ezCloudRoomCode.trim();
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
