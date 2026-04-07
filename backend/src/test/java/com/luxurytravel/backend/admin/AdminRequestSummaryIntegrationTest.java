package com.luxurytravel.backend.admin;

import com.luxurytravel.backend.booking.BookingStatus;
import com.luxurytravel.backend.experience.Experience;
import com.luxurytravel.backend.experience.ExperienceRepository;
import com.luxurytravel.backend.experience.ExperienceRequest;
import com.luxurytravel.backend.experience.ExperienceRequestRepository;
import com.luxurytravel.backend.service.ServiceRequest;
import com.luxurytravel.backend.service.ServiceRequestRepository;
import com.luxurytravel.backend.service.TravelService;
import com.luxurytravel.backend.service.TravelServiceRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AdminRequestSummaryIntegrationTest {
    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private TravelServiceRepository travelServiceRepository;
    @Autowired
    private ServiceRequestRepository serviceRequestRepository;
    @Autowired
    private ExperienceRepository experienceRepository;
    @Autowired
    private ExperienceRequestRepository experienceRequestRepository;

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void summary_shouldReturnPendingCountsAndLatestIds() throws Exception {
        TravelService ts = travelServiceRepository.save(new TravelService(
                "Private Car",
                "Desc",
                new BigDecimal("10.00"),
                "https://img.com/1",
                List.of()
        ));
        Experience ex = experienceRepository.save(new Experience(
                "Sunset Tour",
                "Desc",
                new BigDecimal("20.00"),
                "https://img.com/2",
                List.of()
        ));

        ServiceRequest srOld = new ServiceRequest();
        srOld.setService(ts);
        srOld.setCustomerName("A");
        srOld.setEmail("a@test.com");
        srOld.setPhone("1");
        srOld.setTravelDate(LocalDate.now().plusDays(1));
        srOld.setTravelers(1);
        srOld.setStatus(BookingStatus.PENDING);
        srOld.setCreatedAt(Instant.now().minusSeconds(120));
        serviceRequestRepository.save(srOld);

        ServiceRequest srNew = new ServiceRequest();
        srNew.setService(ts);
        srNew.setCustomerName("B");
        srNew.setEmail("b@test.com");
        srNew.setPhone("2");
        srNew.setTravelDate(LocalDate.now().plusDays(2));
        srNew.setTravelers(2);
        srNew.setStatus(BookingStatus.PENDING);
        srNew.setCreatedAt(Instant.now());
        srNew = serviceRequestRepository.save(srNew);

        ExperienceRequest er = new ExperienceRequest();
        er.setExperience(ex);
        er.setCustomerName("C");
        er.setEmail("c@test.com");
        er.setPhone("3");
        er.setTravelDate(LocalDate.now().plusDays(3));
        er.setTravelers(3);
        er.setStatus(BookingStatus.PENDING);
        er.setCreatedAt(Instant.now());
        er = experienceRequestRepository.save(er);

        mockMvc.perform(get("/api/admin/requests/summary").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pendingServiceRequests").value(2))
                .andExpect(jsonPath("$.pendingExperienceRequests").value(1))
                .andExpect(jsonPath("$.totalPendingRequests").value(3))
                .andExpect(jsonPath("$.latestServiceRequestId").value(srNew.getId()))
                .andExpect(jsonPath("$.latestExperienceRequestId").value(er.getId()));
    }
}

