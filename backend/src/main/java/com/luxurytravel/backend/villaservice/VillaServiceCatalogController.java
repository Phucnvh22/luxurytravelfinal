package com.luxurytravel.backend.villaservice;

import com.luxurytravel.backend.user.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
@RequestMapping("/api/admin/villa-services")
public class VillaServiceCatalogController {
    private final VillaServiceCatalogService villaServiceCatalogService;

    public VillaServiceCatalogController(VillaServiceCatalogService villaServiceCatalogService) {
        this.villaServiceCatalogService = villaServiceCatalogService;
    }

    @GetMapping
    public List<VillaServiceCatalogResponse> list() {
        return villaServiceCatalogService.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public VillaServiceCatalogResponse create(
            @Valid @RequestBody VillaServiceCatalogUpsertRequest request,
            @AuthenticationPrincipal User user
    ) {
        return villaServiceCatalogService.create(request, user);
    }

    @PutMapping("/{id}")
    public VillaServiceCatalogResponse update(
            @PathVariable Long id,
            @Valid @RequestBody VillaServiceCatalogUpsertRequest request,
            @AuthenticationPrincipal User user
    ) {
        return villaServiceCatalogService.update(id, request, user);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal User user) {
        villaServiceCatalogService.delete(id, user);
    }
}
