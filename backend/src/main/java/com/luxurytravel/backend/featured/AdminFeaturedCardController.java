package com.luxurytravel.backend.featured;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/featured-cards")
public class AdminFeaturedCardController {
    private final FeaturedCardService featuredCardService;

    public AdminFeaturedCardController(FeaturedCardService featuredCardService) {
        this.featuredCardService = featuredCardService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FeaturedCardResponse add(@RequestBody @Valid FeaturedCardUpsertRequest request) {
        return featuredCardService.add(request);
    }

    @DeleteMapping("/{category}/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String category, @PathVariable Long id) {
        featuredCardService.delete(category, id);
    }
}
