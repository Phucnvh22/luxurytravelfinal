package com.luxurytravel.backend.experience;

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
public class ExperienceRequestService {
    private final ExperienceRequestRepository experienceRequestRepository;
    private final ExperienceRepository experienceRepository;
    private final UserRepository userRepository;

    public ExperienceRequestService(
            ExperienceRequestRepository experienceRequestRepository,
            ExperienceRepository experienceRepository,
            UserRepository userRepository
    ) {
        this.experienceRequestRepository = experienceRequestRepository;
        this.experienceRepository = experienceRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<ExperienceRequestResponse> list() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal().equals("anonymousUser")) {
            throw new AuthenticationException("Unauthorized");
        }

        String username = auth.getName();
        User user = userRepository.findByUsername(username).orElseThrow(() -> new UserNotFoundException(username));

        if (user.getRole() == Role.ADMIN) {
            return experienceRequestRepository.findAllByOrderByCreatedAtDescIdDesc().stream().map(ExperienceRequestResponse::from).collect(Collectors.toList());
        } else if (user.getRole() == Role.SELLER) {
            return experienceRequestRepository.findBySellerIdOrderByCreatedAtDescIdDesc(user.getId()).stream().map(ExperienceRequestResponse::from).collect(Collectors.toList());
        } else {
            return experienceRequestRepository.findByUserIdOrderByCreatedAtDescIdDesc(user.getId()).stream().map(ExperienceRequestResponse::from).collect(Collectors.toList());
        }
    }

    @Transactional
    public ExperienceRequestResponse create(ExperienceRequestCreateRequest request) {
        Experience experience = experienceRepository.findById(request.getExperienceId())
                .orElseThrow(() -> new ExperienceNotFoundException(request.getExperienceId()));

        ExperienceRequest r = new ExperienceRequest();
        r.setExperience(experience);
        r.setCustomerName(request.getCustomerName());
        r.setEmail(request.getEmail());
        r.setPhone(request.getPhone());
        r.setTravelDate(request.getTravelDate());
        r.setTravelers(request.getTravelers());
        r.setNotes(request.getNotes() == null ? "" : request.getNotes());
        r.setSellerId(request.getSellerId());

        Double priceFrom = experience.getPriceFrom() != null ? experience.getPriceFrom().doubleValue() : 0.0;
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

        return ExperienceRequestResponse.from(experienceRequestRepository.save(r));
    }

    @Transactional
    public ExperienceRequestResponse approve(Long requestId) {
        ExperienceRequest r = experienceRequestRepository.findById(requestId)
                .orElseThrow(() -> new ExperienceRequestNotFoundException(requestId));

        if (r.getStatus() == BookingStatus.CANCELLED) {
            throw new RuntimeException("Experience request is cancelled");
        }

        if (r.getStatus() == BookingStatus.CONFIRMED) {
            return ExperienceRequestResponse.from(r);
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

        return ExperienceRequestResponse.from(experienceRequestRepository.save(r));
    }
}
