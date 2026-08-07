package com.luxurytravel.backend.room;

import com.luxurytravel.backend.roombooking.RoomBookingRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class RoomService {
    private final RoomRepository roomRepository;
    private final RoomBookingRepository roomBookingRepository;

    public RoomService(RoomRepository roomRepository, RoomBookingRepository roomBookingRepository) {
        this.roomRepository = roomRepository;
        this.roomBookingRepository = roomBookingRepository;
    }

    @Transactional(readOnly = true)
    public List<Room> findAll() {
        return roomRepository.findAllByOrderByFloorNumberAscCodeAsc();
    }

    @Transactional(readOnly = true)
    public Room findById(Long id) {
        return roomRepository.findById(id)
                .orElseThrow(() -> new RoomNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public Room findByCode(String code) {
        return roomRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phong khong ton tai"));
    }

    @Transactional
    public Room create(RoomUpsertRequest request) {
        String code = normalizeCode(request.getCode());
        if (roomRepository.existsByCodeIgnoreCase(code)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ma phong da ton tai");
        }

        Room room = new Room();
        apply(room, request, code);
        return roomRepository.save(room);
    }

    @Transactional
    public Room update(Long id, RoomUpsertRequest request) {
        Room room = findById(id);
        String code = normalizeCode(request.getCode());
        if (roomRepository.existsByCodeIgnoreCaseAndIdNot(code, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ma phong da ton tai");
        }

        apply(room, request, code);
        return roomRepository.save(room);
    }

    @Transactional
    public void delete(Long id) {
        Room room = findById(id);
        if (roomBookingRepository.existsByRoomCodeIgnoreCase(room.getCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Phong da co lich dat, khong the xoa");
        }
        roomRepository.delete(room);
    }

    private void apply(Room room, RoomUpsertRequest request, String code) {
        room.setCode(code);
        room.setName(request.getName().trim());
        room.setType(request.getType().trim());
        room.setFloorNumber(request.getFloorNumber());
        room.setMaxAdults(request.getMaxAdults());
        room.setMaxChildren(request.getMaxChildren());
        room.setActive(Boolean.TRUE.equals(request.getActive()));
        room.setNotes(request.getNotes() == null ? "" : request.getNotes().trim());
    }

    private String normalizeCode(String code) {
        return code == null ? "" : code.trim().toUpperCase();
    }
}
