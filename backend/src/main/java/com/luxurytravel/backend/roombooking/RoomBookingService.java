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
import java.util.List;

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
        LocalDate rangeStart = from;
        LocalDate rangeEnd = to;
        if (rangeStart != null && rangeEnd == null) {
            rangeEnd = rangeStart.plusDays(6);
        } else if (rangeStart == null && rangeEnd != null) {
            rangeStart = rangeEnd.minusDays(6);
        }
        if (rangeStart != null && rangeEnd != null && rangeEnd.isBefore(rangeStart)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
        }

        LocalDateTime fromAt = rangeStart == null ? null : rangeStart.atStartOfDay();
        LocalDateTime toAt = rangeEnd == null ? null : rangeEnd.plusDays(1).atStartOfDay();

        return roomBookingRepository.findInRange(fromAt, toAt).stream()
                .map(RoomBookingResponse::from)
                .toList();
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
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Booking da bi huy");
        }
        if (booking.getStatus() == RoomBookingStatus.CHECKED_OUT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Booking da check-out");
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
    public RoomBookingResponse markCheckOut(Long id) {
        RoomBooking booking = findEntity(id);
        if (booking.getStatus() == RoomBookingStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Booking da bi huy");
        }
        if (booking.getStatus() == RoomBookingStatus.CHECKED_OUT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Booking da check-out");
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phong dang tam ngung khai thac");
        }

        if (!checkOutAt.isAfter(checkInAt)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Giờ check-out phải sau giờ check-in");
        }

        if (roomBookingRepository.existsOverlap(roomCode, checkInAt, checkOutAt, excludeId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Phòng này đã có lịch đặt trong khoảng thời gian đã chọn");
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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phong khong ton tai"));
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Gia tri tien khong duoc am");
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
}
