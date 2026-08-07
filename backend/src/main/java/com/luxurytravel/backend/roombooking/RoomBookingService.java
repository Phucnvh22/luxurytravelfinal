package com.luxurytravel.backend.roombooking;

import com.luxurytravel.backend.room.Room;
import com.luxurytravel.backend.room.RoomRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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

        Room room = roomRepository.findByCodeIgnoreCase(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phong khong ton tai"));

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
        booking.setNotes(notes);
    }
}
