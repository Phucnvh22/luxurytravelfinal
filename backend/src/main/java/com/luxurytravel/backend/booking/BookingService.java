package com.luxurytravel.backend.booking;

import com.luxurytravel.backend.commission.CommissionService;
import com.luxurytravel.backend.destination.Destination;
import com.luxurytravel.backend.destination.DestinationNotFoundException;
import com.luxurytravel.backend.destination.DestinationRepository;
import com.luxurytravel.backend.common.AuthenticationException;
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
    private final CommissionService commissionService;

    public BookingService(
            BookingRepository bookingRepository,
            DestinationRepository destinationRepository,
            UserRepository userRepository,
            CommissionService commissionService
    ) {
        this.bookingRepository = bookingRepository;
        this.destinationRepository = destinationRepository;
        this.userRepository = userRepository;
        this.commissionService = commissionService;
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
        User currentUser = requireAuthenticatedUser();
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

        Double commissionAmount = 0.0;
        if (request.getSellerId() != null) {
            User seller = userRepository.findById(request.getSellerId()).orElse(null);
            if (seller != null) {
                commissionAmount = commissionService.calculateCommissionAmount(
                        CommissionService.MODULE_BOOKING,
                        destination.getType(),
                        totalPrice,
                        seller.getCommissionRate()
                );
            }
        }
        booking.setCommissionAmount(commissionAmount);
        booking.setCommissionCredited(false);

        booking.setUserId(currentUser.getId());

        return BookingResponse.from(bookingRepository.save(booking));
    }

    private User requireAuthenticatedUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal().equals("anonymousUser")) {
            throw new AuthenticationException("Unauthorized");
        }
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new AuthenticationException("Unauthorized"));
    }

    @Transactional
    public BookingResponse approve(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new RuntimeException("Booking is cancelled");
        }

        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            return BookingResponse.from(booking);
        }

        booking.setStatus(BookingStatus.CONFIRMED);

        if (!booking.isCommissionCredited() && booking.getSellerId() != null) {
            User seller = userRepository.findById(booking.getSellerId()).orElse(null);
            if (seller != null) {
                Double commissionAmount = booking.getCommissionAmount() != null ? booking.getCommissionAmount() : 0.0;
                Double currentBalance = seller.getCommissionBalance() != null ? seller.getCommissionBalance() : 0.0;
                seller.setCommissionBalance(currentBalance + commissionAmount);
                userRepository.save(seller);
            }
            booking.setCommissionCredited(true);
        }

        return BookingResponse.from(bookingRepository.save(booking));
    }
}
