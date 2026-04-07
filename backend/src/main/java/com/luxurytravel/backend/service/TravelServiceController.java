package com.luxurytravel.backend.service;

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
public class TravelServiceController {
    private final TravelServiceService travelServiceService;

    public TravelServiceController(TravelServiceService travelServiceService) {
        this.travelServiceService = travelServiceService;
    }

    @GetMapping("/services")
    public List<TravelService> list() {
        return travelServiceService.list();
    }

    @GetMapping("/services/{id}")
    public TravelService get(@PathVariable Long id) {
        return travelServiceService.getById(id);
    }

    @PostMapping("/admin/services")
    @ResponseStatus(HttpStatus.CREATED)
    public TravelService create(@Valid @RequestBody TravelServiceUpsertRequest request) {
        return travelServiceService.create(request);
    }

    @PutMapping("/admin/services/{id}")
    public TravelService update(@PathVariable Long id, @Valid @RequestBody TravelServiceUpsertRequest request) {
        return travelServiceService.update(id, request);
    }

    @DeleteMapping("/admin/services/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        travelServiceService.delete(id);
    }
}
