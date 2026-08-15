package com.luxurytravel.backend.room;

import com.luxurytravel.backend.roombooking.RoomBookingRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

@Service
public class RoomService {
    private final RoomRepository roomRepository;
    private final RoomBookingRepository roomBookingRepository;

    public RoomService(RoomRepository roomRepository, RoomBookingRepository roomBookingRepository) {
        this.roomRepository = roomRepository;
        this.roomBookingRepository = roomBookingRepository;
    }

    @Transactional
    public List<Room> findAll() {
        List<Room> rooms = roomRepository.findAllByOrderByLocationAscFloorNumberAscCodeAsc();
        boolean changed = rooms.stream().anyMatch(this::ensureOperationalState);
        if (changed) {
            roomRepository.saveAll(rooms);
        }
        return rooms;
    }

    @Transactional
    public Room findById(Long id) {
        Room room = roomRepository.findById(id)
                .orElseThrow(() -> new RoomNotFoundException(id));
        if (ensureOperationalState(room)) {
            return roomRepository.save(room);
        }
        return room;
    }

    @Transactional
    public Room findByCode(String code) {
        Room room = roomRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Villa does not exist"));
        if (ensureOperationalState(room)) {
            return roomRepository.save(room);
        }
        return room;
    }

    @Transactional
    public Room create(RoomUpsertRequest request) {
        String code = normalizeCode(request.getCode());
        if (roomRepository.existsByCodeIgnoreCase(code)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Villa code already exists");
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
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Villa code already exists");
        }

        apply(room, request, code);
        return roomRepository.save(room);
    }

    @Transactional
    public void delete(Long id) {
        Room room = findById(id);
        if (roomBookingRepository.existsByRoomCodeIgnoreCase(room.getCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Villa already has bookings and cannot be deleted");
        }
        roomRepository.delete(room);
    }

    private void apply(Room room, RoomUpsertRequest request, String code) {
        room.setCode(code);
        room.setName(request.getName().trim());
        room.setHost(request.getHost().trim());
        room.setType(request.getType().trim());
        room.setAirbnbUrl(request.getAirbnbUrl() == null ? "" : request.getAirbnbUrl().trim());
        room.setFloorNumber(request.getFloorNumber());
        room.setMaxAdults(request.getMaxAdults());
        room.setMaxChildren(request.getMaxChildren());
        room.setActive(Boolean.TRUE.equals(request.getActive()));
        room.setBedroomLayout(request.getBedroomLayout() == null ? "" : request.getBedroomLayout().trim());
        room.setLocation(request.getLocation() == null ? "" : request.getLocation().trim());
        room.setWifiName(request.getWifiName() == null ? "" : request.getWifiName().trim());
        room.setWifiPassword(request.getWifiPassword() == null ? "" : request.getWifiPassword().trim());
        room.setDoorPassword(request.getDoorPassword() == null ? "" : request.getDoorPassword().trim());
        room.setNotes(request.getNotes() == null ? "" : request.getNotes().trim());
        ensureOperationalState(room);
    }

    @Transactional
    public Room markReady(Long id) {
        Room room = findById(id);
        Instant now = Instant.now();
        room.setOperationalStatus(RoomOperationalStatus.READY);
        room.setStatusUpdatedAt(now);
        room.setLastReadyAt(now);
        return roomRepository.save(room);
    }

    private boolean ensureOperationalState(Room room) {
        boolean changed = false;
        if (room.getOperationalStatus() == null) {
            room.setOperationalStatus(RoomOperationalStatus.READY);
            changed = true;
        }
        if (room.getStatusUpdatedAt() == null) {
            room.setStatusUpdatedAt(Instant.now());
            changed = true;
        }
        if (room.getOperationalStatus() == RoomOperationalStatus.READY && room.getLastReadyAt() == null) {
            room.setLastReadyAt(room.getStatusUpdatedAt());
            changed = true;
        }
        if (room.getAirbnbUrl() == null) {
            room.setAirbnbUrl("");
            changed = true;
        }
        return changed;
    }

    private String normalizeCode(String code) {
        return code == null ? "" : code.trim().toUpperCase();
    }
}
