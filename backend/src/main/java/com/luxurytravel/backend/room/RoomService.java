package com.luxurytravel.backend.room;

import com.luxurytravel.backend.roomlog.RoomWorkLogAction;
import com.luxurytravel.backend.roomlog.RoomWorkLogService;
import com.luxurytravel.backend.roombooking.RoomBookingStatus;
import com.luxurytravel.backend.roombooking.RoomBookingRepository;
import com.luxurytravel.backend.user.Role;
import com.luxurytravel.backend.user.UserRepository;
import com.luxurytravel.backend.user.User;
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
    private final RoomWorkLogService roomWorkLogService;
    private final UserRepository userRepository;

    public RoomService(
            RoomRepository roomRepository,
            RoomBookingRepository roomBookingRepository,
            RoomWorkLogService roomWorkLogService,
            UserRepository userRepository
    ) {
        this.roomRepository = roomRepository;
        this.roomBookingRepository = roomBookingRepository;
        this.roomWorkLogService = roomWorkLogService;
        this.userRepository = userRepository;
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
        return markReady(id, null);
    }

    @Transactional
    public Room markReady(Long id, User cleaner) {
        Room room = findById(id);
        if (room.getOperationalStatus() != RoomOperationalStatus.NEEDS_CLEANING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Villa is not waiting for cleaning");
        }
        Instant now = Instant.now();
        room.setOperationalStatus(RoomOperationalStatus.READY);
        room.setStatusUpdatedAt(now);
        room.setLastReadyAt(now);
        room.setCleanedAt(now);
        room.setCleanedByUsername(cleaner == null ? null : cleaner.getUsername());
        room.setCleanedByName(cleaner == null ? null : cleaner.getFullName());
        Room saved = roomRepository.save(room);
        roomWorkLogService.log(saved, RoomWorkLogAction.CLEANING_COMPLETED, cleaner, "");
        return saved;
    }

    @Transactional
    public Room reportRepair(Long id, String details, User reporter) {
        Room room = findById(id);
        String normalizedDetails = details == null ? "" : details.trim();
        if (normalizedDetails.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Repair details are required");
        }

        Instant now = Instant.now();
        room.setRepairNeeded(true);
        room.setRepairDetails(normalizedDetails);
        room.setRepairReportedAt(now);
        room.setRepairReportedByUsername(reporter == null ? null : reporter.getUsername());
        room.setRepairReportedByName(reporter == null ? null : reporter.getFullName());
        room.setRepairResolvedAt(null);
        room.setRepairResolvedByUsername(null);
        room.setRepairResolvedByName(null);
        Room saved = roomRepository.save(room);
        roomWorkLogService.log(saved, RoomWorkLogAction.REPAIR_REPORTED, reporter, normalizedDetails);
        return saved;
    }

    @Transactional
    public Room resolveRepair(Long id, User maintainer) {
        Room room = findById(id);
        if (!room.isRepairNeeded()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Villa does not have an open repair request");
        }

        Instant now = Instant.now();
        room.setRepairNeeded(false);
        room.setRepairResolvedAt(now);
        room.setRepairResolvedByUsername(maintainer == null ? null : maintainer.getUsername());
        room.setRepairResolvedByName(maintainer == null ? null : maintainer.getFullName());
        Room saved = roomRepository.save(room);
        roomWorkLogService.log(saved, RoomWorkLogAction.REPAIR_RESOLVED, maintainer, room.getRepairDetails());
        return saved;
    }

    @Transactional
    public Room markOutOfInventory(Long id, String details, User user) {
        Room room = findById(id);
        if (room.getOperationalStatus() == RoomOperationalStatus.CHECKED_IN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Checked-in villa cannot be marked OOI");
        }
        String normalizedDetails = details == null ? "" : details.trim();
        if (normalizedDetails.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OOI details are required");
        }

        Instant now = Instant.now();
        room.setOperationalStatus(RoomOperationalStatus.OOI);
        room.setStatusUpdatedAt(now);
        room.setOoiDetails(normalizedDetails);
        room.setOoiMarkedAt(now);
        room.setOoiMarkedByUsername(user == null ? null : user.getUsername());
        room.setOoiMarkedByName(user == null ? null : user.getFullName());
        room.setOoiClearedAt(null);
        room.setOoiClearedByUsername(null);
        room.setOoiClearedByName(null);
        return roomRepository.save(room);
    }

    @Transactional
    public Room clearOutOfInventory(Long id, User user) {
        Room room = findById(id);
        if (room.getOperationalStatus() != RoomOperationalStatus.OOI) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Villa is not marked OOI");
        }

        Instant now = Instant.now();
        room.setOperationalStatus(RoomOperationalStatus.READY);
        room.setStatusUpdatedAt(now);
        room.setLastReadyAt(now);
        room.setOoiClearedAt(now);
        room.setOoiClearedByUsername(user == null ? null : user.getUsername());
        room.setOoiClearedByName(user == null ? null : user.getFullName());
        return roomRepository.save(room);
    }

    @Transactional
    public List<Room> findNeedsCleaning() {
        List<Room> rooms = roomRepository.findAllByOrderByLocationAscFloorNumberAscCodeAsc();
        boolean changed = rooms.stream().anyMatch(this::ensureOperationalState);
        if (changed) {
            roomRepository.saveAll(rooms);
        }
        return rooms.stream()
                .filter(Room::isActive)
                .filter(room -> room.getOperationalStatus() == RoomOperationalStatus.NEEDS_CLEANING)
                .toList();
    }

    @Transactional
    public List<Room> findNeedsCleaningForCleaner(User cleaner) {
        if (cleaner == null || cleaner.getId() == null) {
            return List.of();
        }

        List<Room> rooms = roomRepository.findAllByAssignedCleanerIdOrderByLocationAscFloorNumberAscCodeAsc(cleaner.getId());
        boolean changed = rooms.stream().anyMatch(this::ensureOperationalState);
        if (changed) {
            roomRepository.saveAll(rooms);
        }
        return rooms.stream()
                .filter(Room::isActive)
                .filter(room -> room.getOperationalStatus() == RoomOperationalStatus.NEEDS_CLEANING)
                .toList();
    }

    @Transactional
    public List<Room> findNeedsRepair() {
        List<Room> rooms = roomRepository.findAllByOrderByLocationAscFloorNumberAscCodeAsc();
        boolean changed = rooms.stream().anyMatch(this::ensureOperationalState);
        if (changed) {
            roomRepository.saveAll(rooms);
        }
        return rooms.stream()
                .filter(Room::isActive)
                .filter(Room::isRepairNeeded)
                .toList();
    }

    @Transactional
    public Room assignCleaner(Long roomId, Long cleanerId) {
        Room room = findById(roomId);
        if (cleanerId == null) {
            room.setAssignedCleanerId(null);
            return roomRepository.save(room);
        }

        if (!userRepository.existsByIdAndRole(cleanerId, Role.CLEANER)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cleaner does not exist");
        }

        room.setAssignedCleanerId(cleanerId);
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
        if (room.getRepairDetails() == null) {
            room.setRepairDetails("");
            changed = true;
        }
        if (room.getOoiDetails() == null) {
            room.setOoiDetails("");
            changed = true;
        }
        if (room.getOperationalStatus() != RoomOperationalStatus.OOI) {
            RoomOperationalStatus nextStatus = deriveOperationalStatus(room);
            if (nextStatus != room.getOperationalStatus()) {
                room.setOperationalStatus(nextStatus);
                room.setStatusUpdatedAt(Instant.now());
                if (nextStatus == RoomOperationalStatus.READY && room.getLastReadyAt() == null) {
                    room.setLastReadyAt(room.getStatusUpdatedAt());
                }
                changed = true;
            }
        }
        return changed;
    }

    private RoomOperationalStatus deriveOperationalStatus(Room room) {
        if (room.getOperationalStatus() == RoomOperationalStatus.OOI) {
            return RoomOperationalStatus.OOI;
        }
        if (roomBookingRepository.existsByRoomCodeIgnoreCaseAndStatus(room.getCode(), RoomBookingStatus.CHECKED_IN)) {
            return RoomOperationalStatus.CHECKED_IN;
        }

        boolean cleaningPending = room.getCleaningRequestedAt() != null
                && (room.getLastReadyAt() == null || room.getCleaningRequestedAt().isAfter(room.getLastReadyAt()));
        return cleaningPending ? RoomOperationalStatus.NEEDS_CLEANING : RoomOperationalStatus.READY;
    }

    private String normalizeCode(String code) {
        return code == null ? "" : code.trim().toUpperCase();
    }
}
