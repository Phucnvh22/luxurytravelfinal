package com.luxurytravel.backend.service;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ServiceRequestController {
    private final ServiceRequestService serviceRequestService;

    public ServiceRequestController(ServiceRequestService serviceRequestService) {
        this.serviceRequestService = serviceRequestService;
    }

    @PostMapping("/service-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceRequestResponse create(@Valid @RequestBody ServiceRequestCreateRequest request) {
        return serviceRequestService.create(request);
    }

    @GetMapping("/service-requests")
    public List<ServiceRequestResponse> list() {
        return serviceRequestService.list();
    }

    @PostMapping("/admin/service-requests/{id}/approve")
    public ServiceRequestResponse approve(@PathVariable Long id) {
        return serviceRequestService.approve(id);
    }
}
