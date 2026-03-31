package com.luxurytravel.backend.destination;

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
public class DestinationController {
    private final DestinationService destinationService;

    public DestinationController(DestinationService destinationService) {
        this.destinationService = destinationService;
    }

    @GetMapping("/destinations")
    public List<Destination> list() {
        return destinationService.list();
    }

    @GetMapping("/destinations/{id}")
    public Destination get(@PathVariable Long id) {
        return destinationService.getById(id);
    }

    @PostMapping("/admin/destinations")
    @ResponseStatus(HttpStatus.CREATED)
    public Destination create(@Valid @RequestBody DestinationUpsertRequest request) {
        return destinationService.create(request);
    }

    @PutMapping("/admin/destinations/{id}")
    public Destination update(@PathVariable Long id, @Valid @RequestBody DestinationUpsertRequest request) {
        return destinationService.update(id, request);
    }

    @DeleteMapping("/admin/destinations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        destinationService.delete(id);
    }
}
