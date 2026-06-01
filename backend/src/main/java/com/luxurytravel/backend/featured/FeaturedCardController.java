package com.luxurytravel.backend.featured;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/featured-cards")
public class FeaturedCardController {
    private final FeaturedCardService featuredCardService;

    public FeaturedCardController(FeaturedCardService featuredCardService) {
        this.featuredCardService = featuredCardService;
    }

    @GetMapping
    public List<FeaturedCardResponse> getAll() {
        return featuredCardService.findAll();
    }
}
