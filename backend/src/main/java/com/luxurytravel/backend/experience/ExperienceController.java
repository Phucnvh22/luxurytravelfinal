package com.luxurytravel.backend.experience;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ExperienceController {
    private final ExperienceService experienceService;

    public ExperienceController(ExperienceService experienceService) {
        this.experienceService = experienceService;
    }

    @GetMapping("/experiences")
    public List<Experience> list() {
        return experienceService.list();
    }

    @GetMapping("/experiences/{id}")
    public Experience get(@PathVariable Long id) {
        return experienceService.getById(id);
    }

    @PostMapping("/admin/experiences")
    @ResponseStatus(HttpStatus.CREATED)
    public Experience create(@Valid @RequestBody ExperienceUpsertRequest request) {
        return experienceService.create(request);
    }

    @PostMapping("/seller/experiences")
    @ResponseStatus(HttpStatus.CREATED)
    public Experience createBySeller(@Valid @RequestBody ExperienceUpsertRequest request) {
        return experienceService.create(request);
    }

    @PutMapping("/admin/experiences/{id}")
    public Experience update(@PathVariable Long id, @Valid @RequestBody ExperienceUpsertRequest request) {
        return experienceService.update(id, request);
    }

    @PutMapping("/seller/experiences/{id}")
    public Experience updateBySeller(@PathVariable Long id, @Valid @RequestBody ExperienceUpsertRequest request) {
        return experienceService.update(id, request);
    }

    @DeleteMapping("/admin/experiences/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        experienceService.delete(id);
    }

    @DeleteMapping("/seller/experiences/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBySeller(@PathVariable Long id) {
        experienceService.delete(id);
    }
}
