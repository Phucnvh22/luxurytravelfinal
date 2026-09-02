package com.luxurytravel.backend.villasetting;

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

@RestController
@RequestMapping("/api/admin/villa-settings")
public class VillaSettingController {
    private final VillaSettingService villaSettingService;

    public VillaSettingController(VillaSettingService villaSettingService) {
        this.villaSettingService = villaSettingService;
    }

    @GetMapping
    public VillaSettingsResponse list() {
        return villaSettingService.findAllGrouped();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public VillaSettingOption create(@Valid @RequestBody VillaSettingUpsertRequest request) {
        return villaSettingService.create(request);
    }

    @PutMapping("/{id}")
    public VillaSettingOption update(@PathVariable Long id, @Valid @RequestBody VillaSettingUpsertRequest request) {
        return villaSettingService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        villaSettingService.delete(id);
    }
}
