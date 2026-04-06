package com.luxurytravel.backend.booking;

import com.luxurytravel.backend.destination.Destination;
import com.luxurytravel.backend.destination.DestinationNotFoundException;
import com.luxurytravel.backend.destination.DestinationRepository;
import com.luxurytravel.backend.user.User;
import com.luxurytravel.backend.user.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class BookingService {
    private final BookingRepository bookingRepository;
    private final DestinationRepository destinationRepository;
    private final UserRepository userRepository;

    public BookingService(BookingRepository bookingRepository, DestinationRepository destinationRepository, UserRepository userRepository) {
        this.bookingRepository = bookingRepository;
        this.destinationRepository = destinationRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> list() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal().equals("anonymousUser")) {
            throw new RuntimeException("Unauthorized");
        }
        
        String username = auth.getName();
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getRole() == com.luxurytravel.backend.user.Role.ADMIN) {
            return bookingRepository.findAll().stream()
                    .map(BookingResponse::from)
                    .collect(Collectors.toList());
        } else if (user.getRole() == com.luxurytravel.backend.user.Role.SELLER) {
            return bookingRepository.findBySellerId(user.getId()).stream()
                    .map(BookingResponse::from)
                    .collect(Collectors.toList());
        } else {
            return bookingRepository.findByUserId(user.getId()).stream()
                    .map(BookingResponse::from)
                    .collect(Collectors.toList());
        }
    }

    @Transactional
    public BookingResponse create(BookingCreateRequest request) {
        Destination destination = destinationRepository.findById(request.getDestinationId())
                .orElseThrow(() -> new DestinationNotFoundException(request.getDestinationId()));

        Booking booking = new Booking();
        booking.setDestination(destination);
        booking.setCustomerName(request.getCustomerName());
        booking.setEmail(request.getEmail());
        booking.setPhone(request.getPhone());
        booking.setTravelDate(request.getTravelDate());
        booking.setTravelers(request.getTravelers());
        booking.setNotes(request.getNotes() == null ? "" : request.getNotes());
        booking.setSellerId(request.getSellerId());

        // Calculate total price
        Double priceFrom = destination.getPriceFrom() != null ? destination.getPriceFrom().doubleValue() : 0.0;
        Double totalPrice = priceFrom * request.getTravelers();
        booking.setTotalPrice(totalPrice);

        // Calculate commission if seller exists
        Double commissionAmount = 0.0;
        if (request.getSellerId() != null) {
            User seller = userRepository.findById(request.getSellerId()).orElse(null);
            if (seller != null) {
                Double rate = seller.getCommissionRate() != null ? seller.getCommissionRate() : 0.0;
                commissionAmount = totalPrice * rate / 100.0;
                Double currentBalance = seller.getCommissionBalance() != null ? seller.getCommissionBalance() : 0.0;
                seller.setCommissionBalance(currentBalance + commissionAmount);
                userRepository.save(seller);
            }
        }
        booking.setCommissionAmount(commissionAmount);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !auth.getPrincipal().equals("anonymousUser")) {
            String username = auth.getName();
            userRepository.findByUsername(username).ifPresent(user -> booking.setUserId(user.getId()));
        }

        return BookingResponse.from(bookingRepository.save(booking));
    }
}
