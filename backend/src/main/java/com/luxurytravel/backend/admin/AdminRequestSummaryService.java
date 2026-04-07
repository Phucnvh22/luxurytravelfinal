package com.luxurytravel.backend.admin;

import com.luxurytravel.backend.booking.BookingStatus;
import com.luxurytravel.backend.experience.ExperienceRequest;
import com.luxurytravel.backend.experience.ExperienceRequestRepository;
import com.luxurytravel.backend.service.ServiceRequest;
import com.luxurytravel.backend.service.ServiceRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminRequestSummaryService {
    private final ServiceRequestRepository serviceRequestRepository;
    private final ExperienceRequestRepository experienceRequestRepository;

    public AdminRequestSummaryService(
            ServiceRequestRepository serviceRequestRepository,
            ExperienceRequestRepository experienceRequestRepository
    ) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.experienceRequestRepository = experienceRequestRepository;
    }

    @Transactional(readOnly = true)
    public AdminRequestSummaryResponse summary() {
        long pendingServices = serviceRequestRepository.countByStatus(BookingStatus.PENDING);
        long pendingExperiences = experienceRequestRepository.countByStatus(BookingStatus.PENDING);

        ServiceRequest latestService = serviceRequestRepository.findTopByOrderByCreatedAtDescIdDesc();
        ExperienceRequest latestExperience = experienceRequestRepository.findTopByOrderByCreatedAtDescIdDesc();

        AdminRequestSummaryResponse response = new AdminRequestSummaryResponse();
        response.setPendingServiceRequests(pendingServices);
        response.setPendingExperienceRequests(pendingExperiences);
        response.setLatestServiceRequestId(latestService != null ? latestService.getId() : null);
        response.setLatestExperienceRequestId(latestExperience != null ? latestExperience.getId() : null);
        return response;
    }
}

