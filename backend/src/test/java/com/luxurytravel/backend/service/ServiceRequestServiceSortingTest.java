package com.luxurytravel.backend.service;

import com.luxurytravel.backend.booking.BookingStatus;
import com.luxurytravel.backend.user.Role;
import com.luxurytravel.backend.user.User;
import com.luxurytravel.backend.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServiceRequestServiceSortingTest {
    @Mock
    private ServiceRequestRepository serviceRequestRepository;
    @Mock
    private TravelServiceRepository travelServiceRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ServiceRequestService serviceRequestService;

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void list_shouldReturnNewestFirst_forAdmin() {
        User admin = new User("admin", "pwd", "Admin", Role.ADMIN);
        admin.setId(1L);

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin", "pwd", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")))
        );
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(admin));

        TravelService travelService = new TravelService();
        travelService.setId(10L);
        travelService.setName("Airport Transfer");

        ServiceRequest newest = new ServiceRequest();
        newest.setId(3L);
        newest.setService(travelService);
        newest.setCustomerName("Newest");
        newest.setEmail("n@test.com");
        newest.setPhone("1");
        newest.setTravelDate(LocalDate.now().plusDays(1));
        newest.setTravelers(2);
        newest.setStatus(BookingStatus.PENDING);
        newest.setCreatedAt(Instant.now());

        ServiceRequest oldest = new ServiceRequest();
        oldest.setId(1L);
        oldest.setService(travelService);
        oldest.setCustomerName("Oldest");
        oldest.setEmail("o@test.com");
        oldest.setPhone("1");
        oldest.setTravelDate(LocalDate.now().plusDays(2));
        oldest.setTravelers(2);
        oldest.setStatus(BookingStatus.PENDING);
        oldest.setCreatedAt(Instant.now().minusSeconds(3600));

        when(serviceRequestRepository.findAllByOrderByCreatedAtDescIdDesc()).thenReturn(List.of(newest, oldest));

        List<ServiceRequestResponse> result = serviceRequestService.list();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getId()).isEqualTo(3L);
        assertThat(result.get(1).getId()).isEqualTo(1L);
    }
}
