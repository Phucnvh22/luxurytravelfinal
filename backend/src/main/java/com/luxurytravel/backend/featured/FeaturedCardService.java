package com.luxurytravel.backend.featured;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class FeaturedCardService {
    private final FeaturedCardRepository featuredCardRepository;

    public FeaturedCardService(FeaturedCardRepository featuredCardRepository) {
        this.featuredCardRepository = featuredCardRepository;
    }

    public List<FeaturedCardResponse> findAll() {
        return featuredCardRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    public FeaturedCardResponse add(FeaturedCardUpsertRequest request) {
        FeaturedCardCategory category = FeaturedCardCategory.fromApiValue(request.getCategory());
        Long itemId = request.getId();
        FeaturedCard card = featuredCardRepository.findByCategoryAndItemId(category, itemId)
                .orElseGet(() -> featuredCardRepository.save(new FeaturedCard(category, itemId)));
        return toResponse(card);
    }

    public void delete(String categoryRaw, Long itemId) {
        FeaturedCardCategory category = FeaturedCardCategory.fromApiValue(categoryRaw);
        featuredCardRepository.findByCategoryAndItemId(category, itemId).ifPresent(featuredCardRepository::delete);
    }

    private FeaturedCardResponse toResponse(FeaturedCard card) {
        return new FeaturedCardResponse(card.getItemId(), card.getCategory().toApiValue());
    }
}
