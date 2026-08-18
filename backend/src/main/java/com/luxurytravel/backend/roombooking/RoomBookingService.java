package com.luxurytravel.backend.roombooking;

import com.luxurytravel.backend.room.Room;
import com.luxurytravel.backend.room.RoomOperationalStatus;
import com.luxurytravel.backend.room.RoomRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class RoomBookingService {
    private final RoomBookingRepository roomBookingRepository;
    private final RoomRepository roomRepository;

    public RoomBookingService(RoomBookingRepository roomBookingRepository, RoomRepository roomRepository) {
        this.roomBookingRepository = roomBookingRepository;
        this.roomRepository = roomRepository;
    }

    @Transactional(readOnly = true)
    public List<RoomBookingResponse> list(LocalDate from, LocalDate to) {
        DateRange range = buildRange(from, to);

        return roomBookingRepository.findInRange(range.fromAt(), range.toAt()).stream()
                .map(RoomBookingResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PublicRoomCalendarResponse listPublic(List<String> roomCodes, LocalDate from, LocalDate to) {
        if (roomCodes == null || roomCodes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please select at least one villa");
        }

        Set<String> normalizedCodes = roomCodes.stream()
                .map(value -> value == null ? "" : value.trim().toUpperCase())
                .filter(value -> !value.isBlank())
                .collect(LinkedHashSet::new, Set::add, Set::addAll);

        if (normalizedCodes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid villa list");
        }

        DateRange range = buildRange(from, to);
        List<PublicRoomCalendarRoomResponse> rooms = roomRepository.findAllByOrderByLocationAscFloorNumberAscCodeAsc().stream()
                .filter(Room::isActive)
                .filter(room -> normalizedCodes.contains(room.getCode().trim().toUpperCase()))
                .map(PublicRoomCalendarRoomResponse::from)
                .toList();

        if (rooms.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No matching villa found");
        }

        Set<String> availableCodes = rooms.stream()
                .map(room -> room.code().trim().toUpperCase())
                .collect(LinkedHashSet::new, Set::add, Set::addAll);

        List<PublicRoomCalendarBookingResponse> bookings = roomBookingRepository.findInRange(range.fromAt(), range.toAt()).stream()
                .filter(booking -> booking.getStatus() != RoomBookingStatus.CANCELLED)
                .filter(booking -> availableCodes.contains(booking.getRoomCode().trim().toUpperCase()))
                .map(PublicRoomCalendarBookingResponse::from)
                .toList();

        return new PublicRoomCalendarResponse(rooms, bookings);
    }

    @Transactional(readOnly = true)
    public RoomBookingResponse get(Long id) {
        return RoomBookingResponse.from(findEntity(id));
    }

    @Transactional
    public RoomBookingResponse create(RoomBookingRequest request) {
        RoomBooking booking = new RoomBooking();
        apply(booking, request, null);
        return RoomBookingResponse.from(roomBookingRepository.save(booking));
    }

    @Transactional
    public RoomBookingResponse update(Long id, RoomBookingRequest request) {
        RoomBooking booking = findEntity(id);
        apply(booking, request, id);
        return RoomBookingResponse.from(roomBookingRepository.save(booking));
    }

    @Transactional
    public void delete(Long id) {
        RoomBooking booking = findEntity(id);
        roomBookingRepository.delete(booking);
    }

    @Transactional
    public RoomBookingResponse markCheckIn(Long id) {
        RoomBooking booking = findEntity(id);
        if (booking.getStatus() == RoomBookingStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Booking has been cancelled");
        }
        if (booking.getStatus() == RoomBookingStatus.AIRBNB_BLOCK) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Airbnb block cannot be checked in");
        }
        if (booking.getStatus() == RoomBookingStatus.CHECKED_OUT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Booking has already been checked out");
        }

        Instant now = Instant.now();
        booking.setStatus(RoomBookingStatus.CHECKED_IN);
        booking.setCheckedInMarkedAt(now);

        Room room = findRoom(booking.getRoomCode());
        room.setOperationalStatus(RoomOperationalStatus.CHECKED_IN);
        room.setStatusUpdatedAt(now);
        room.setLastCheckInMarkedAt(now);
        roomRepository.save(room);

        return RoomBookingResponse.from(roomBookingRepository.save(booking));
    }

    @Transactional
    public RoomBookingResponse markCheckOut(Long id, Double collectedAmount) {
        RoomBooking booking = findEntity(id);
        if (booking.getStatus() == RoomBookingStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Booking has been cancelled");
        }
        if (booking.getStatus() == RoomBookingStatus.AIRBNB_BLOCK) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Airbnb block cannot be checked out");
        }
        if (booking.getStatus() == RoomBookingStatus.CHECKED_OUT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Booking has already been checked out");
        }
        if (booking.getStatus() != RoomBookingStatus.CHECKED_IN) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only checked-in bookings can be checked out");
        }

        Double normalizedCollected = normalizeMoney(collectedAmount);
        double currentRemaining = booking.getRemainingAmount() == null ? 0D : booking.getRemainingAmount();

        if (normalizedCollected != null && normalizedCollected > 0) {
            double newRemaining = Math.max(currentRemaining - normalizedCollected, 0D);
            booking.setRemainingAmount(newRemaining);
            currentRemaining = newRemaining;
        }

        if (currentRemaining > 0.001) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Payment required. Please collect the remaining balance before check-out."
            );
        }

        Instant now = Instant.now();
        booking.setStatus(RoomBookingStatus.CHECKED_OUT);
        booking.setCheckedOutMarkedAt(now);

        Room room = findRoom(booking.getRoomCode());
        room.setOperationalStatus(RoomOperationalStatus.NEEDS_CLEANING);
        room.setStatusUpdatedAt(now);
        room.setLastCheckOutMarkedAt(now);
        room.setCleaningRequestedAt(now);
        roomRepository.save(room);

        return RoomBookingResponse.from(roomBookingRepository.save(booking));
    }

    @Transactional
    public RoomBookingResponse cancel(Long id) {
        RoomBooking booking = findEntity(id);
        RoomBookingStatus oldStatus = booking.getStatus();
        if (oldStatus == RoomBookingStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Booking has been cancelled");
        }
        if (oldStatus == RoomBookingStatus.AIRBNB_BLOCK) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Airbnb block cannot be cancelled");
        }
        if (oldStatus == RoomBookingStatus.CHECKED_OUT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Checked-out booking cannot be cancelled");
        }

        Instant now = Instant.now();
        booking.setStatus(RoomBookingStatus.CANCELLED);

        Room room = findRoom(booking.getRoomCode());
        if (oldStatus == RoomBookingStatus.CHECKED_IN || RoomOperationalStatus.CHECKED_IN.equals(room.getOperationalStatus())) {
            room.setOperationalStatus(RoomOperationalStatus.NEEDS_CLEANING);
            room.setCleaningRequestedAt(now);
        }
        room.setStatusUpdatedAt(now);
        roomRepository.save(room);

        return RoomBookingResponse.from(roomBookingRepository.save(booking));
    }

    private RoomBooking findEntity(Long id) {
        return roomBookingRepository.findById(id)
                .orElseThrow(() -> new RoomBookingNotFoundException(id));
    }

    private void apply(RoomBooking booking, RoomBookingRequest request, Long excludeId) {
        String roomCode = request.getRoomCode() == null ? "" : request.getRoomCode().trim().toUpperCase();
        String guestName = request.getGuestName() == null ? "" : request.getGuestName().trim();
        String source = request.getSource() == null || request.getSource().isBlank() ? "Direct" : request.getSource().trim();
        String phone = request.getPhone() == null ? "" : request.getPhone().trim();
        String notes = request.getNotes() == null ? "" : request.getNotes().trim();
        LocalDateTime checkInAt = request.getCheckInAt();
        LocalDateTime checkOutAt = request.getCheckOutAt();
        Double villaRate = normalizeMoney(request.getVillaRate());
        Double depositAmount = normalizeMoney(request.getDepositAmount());
        Double requestedRemainingAmount = normalizeMoney(request.getRemainingAmount());
        Double remainingAmount = calculateRemainingAmount(villaRate, depositAmount, requestedRemainingAmount);

        Room room = findRoom(roomCode);

        if (!room.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This villa is currently inactive");
        }

        if (!checkOutAt.isAfter(checkInAt)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Check-out time must be after check-in time");
        }

        if (roomBookingRepository.existsOverlap(roomCode, checkInAt, checkOutAt, excludeId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This villa already has a booking in the selected time range");
        }

        booking.setRoomCode(roomCode);
        booking.setGuestName(guestName);
        booking.setSource(source);
        booking.setPhone(phone);
        booking.setAdults(request.getAdults());
        booking.setChildren(request.getChildren());
        booking.setCheckInAt(checkInAt);
        booking.setCheckOutAt(checkOutAt);
        booking.setStatus(request.getStatus());
        booking.setVillaRate(villaRate);
        booking.setDepositAmount(depositAmount);
        booking.setRemainingAmount(remainingAmount);
        booking.setNotes(notes);
    }

    private Room findRoom(String roomCode) {
        Room room = roomRepository.findByCodeIgnoreCase(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Villa does not exist"));
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
        if (changed) {
            roomRepository.save(room);
        }
        return room;
    }

    private Double normalizeMoney(Double value) {
        if (value == null) {
            return null;
        }
        if (value < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount cannot be negative");
        }
        return value;
    }

    private Double calculateRemainingAmount(Double totalAmount, Double depositAmount, Double fallbackAmount) {
        if (totalAmount == null) {
            return fallbackAmount;
        }
        double remaining = totalAmount - (depositAmount == null ? 0D : depositAmount);
        return Math.max(remaining, 0D);
    }

    private DateRange buildRange(LocalDate from, LocalDate to) {
        LocalDate rangeStart = from;
        LocalDate rangeEnd = to;
        if (rangeStart != null && rangeEnd == null) {
            rangeEnd = rangeStart.plusDays(6);
        } else if (rangeStart == null && rangeEnd != null) {
            rangeStart = rangeEnd.minusDays(6);
        }
        if (rangeStart != null && rangeEnd != null && rangeEnd.isBefore(rangeStart)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date must be on or after start date");
        }

        LocalDateTime fromAt = rangeStart == null ? null : rangeStart.atStartOfDay();
        LocalDateTime toAt = rangeEnd == null ? null : rangeEnd.plusDays(1).atStartOfDay();
        return new DateRange(fromAt, toAt);
    }

    private record DateRange(LocalDateTime fromAt, LocalDateTime toAt) {
    }
}
