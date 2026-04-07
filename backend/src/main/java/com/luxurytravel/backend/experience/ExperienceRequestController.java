package com.luxurytravel.backend.experience;

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
public class ExperienceRequestController {
    private final ExperienceRequestService experienceRequestService;

    public ExperienceRequestController(ExperienceRequestService experienceRequestService) {
        this.experienceRequestService = experienceRequestService;
    }

    @PostMapping("/experience-requests")
    @ResponseStatus(HttpStatus.CREATED)
    public ExperienceRequestResponse create(@Valid @RequestBody ExperienceRequestCreateRequest request) {
        return experienceRequestService.create(request);
    }

    @GetMapping("/experience-requests")
    public List<ExperienceRequestResponse> list() {
        return experienceRequestService.list();
    }

    @PostMapping("/admin/experience-requests/{id}/approve")
    public ExperienceRequestResponse approve(@PathVariable Long id) {
        return experienceRequestService.approve(id);
    }
}

