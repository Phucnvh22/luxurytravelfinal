package com.luxurytravel.backend.service;

import com.luxurytravel.backend.booking.BookingStatus;
import com.luxurytravel.backend.common.AuthenticationException;
import com.luxurytravel.backend.user.Role;
import com.luxurytravel.backend.user.User;
import com.luxurytravel.backend.user.UserNotFoundException;
import com.luxurytravel.backend.user.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ServiceRequestService {
    private final ServiceRequestRepository serviceRequestRepository;
    private final TravelServiceRepository travelServiceRepository;
    private final UserRepository userRepository;

    public ServiceRequestService(ServiceRequestRepository serviceRequestRepository, TravelServiceRepository travelServiceRepository, UserRepository userRepository) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.travelServiceRepository = travelServiceRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestResponse> list() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal().equals("anonymousUser")) {
            throw new AuthenticationException("Unauthorized");
        }

        String username = auth.getName();
        User user = userRepository.findByUsername(username).orElseThrow(() -> new UserNotFoundException(username));

        if (user.getRole() == Role.ADMIN) {
            return serviceRequestRepository.findAllByOrderByCreatedAtDescIdDesc().stream().map(ServiceRequestResponse::from).collect(Collectors.toList());
        } else if (user.getRole() == Role.SELLER) {
            return serviceRequestRepository.findBySellerIdOrderByCreatedAtDescIdDesc(user.getId()).stream().map(ServiceRequestResponse::from).collect(Collectors.toList());
        } else {
            return serviceRequestRepository.findByUserIdOrderByCreatedAtDescIdDesc(user.getId()).stream().map(ServiceRequestResponse::from).collect(Collectors.toList());
        }
    }

    @Transactional
    public ServiceRequestResponse create(ServiceRequestCreateRequest request) {
        TravelService service = travelServiceRepository.findById(request.getServiceId())
                .orElseThrow(() -> new TravelServiceNotFoundException(request.getServiceId()));

        ServiceRequest r = new ServiceRequest();
        r.setService(service);
        r.setCustomerName(request.getCustomerName());
        r.setEmail(request.getEmail());
        r.setPhone(request.getPhone());
        r.setTravelDate(request.getTravelDate());
        r.setTravelers(request.getTravelers());
        r.setNotes(request.getNotes() == null ? "" : request.getNotes());
        r.setSellerId(request.getSellerId());

        Double priceFrom = service.getPriceFrom() != null ? service.getPriceFrom().doubleValue() : 0.0;
        Double totalPrice = priceFrom * request.getTravelers();
        r.setTotalPrice(totalPrice);

        Double commissionAmount = 0.0;
        if (request.getSellerId() != null) {
            User seller = userRepository.findById(request.getSellerId()).orElse(null);
            if (seller != null) {
                Double rate = seller.getCommissionRate() != null ? seller.getCommissionRate() : 0.0;
                commissionAmount = totalPrice * rate / 100.0;
            }
        }
        r.setCommissionAmount(commissionAmount);
        r.setCommissionCredited(false);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !auth.getPrincipal().equals("anonymousUser")) {
            String username = auth.getName();
            userRepository.findByUsername(username).ifPresent(u -> r.setUserId(u.getId()));
        }

        return ServiceRequestResponse.from(serviceRequestRepository.save(r));
    }

    @Transactional
    public ServiceRequestResponse approve(Long requestId) {
        ServiceRequest r = serviceRequestRepository.findById(requestId).orElseThrow(() -> new ServiceRequestNotFoundException(requestId));

        if (r.getStatus() == BookingStatus.CANCELLED) {
            throw new RuntimeException("Service request is cancelled");
        }

        if (r.getStatus() == BookingStatus.CONFIRMED) {
            return ServiceRequestResponse.from(r);
        }

        r.setStatus(BookingStatus.CONFIRMED);

        if (!r.isCommissionCredited() && r.getSellerId() != null) {
            User seller = userRepository.findById(r.getSellerId()).orElse(null);
            if (seller != null) {
                Double commissionAmount = r.getCommissionAmount() != null ? r.getCommissionAmount() : 0.0;
                Double currentBalance = seller.getCommissionBalance() != null ? seller.getCommissionBalance() : 0.0;
                seller.setCommissionBalance(currentBalance + commissionAmount);
                userRepository.save(seller);
            }
            r.setCommissionCredited(true);
        }

        return ServiceRequestResponse.from(serviceRequestRepository.save(r));
    }
}
