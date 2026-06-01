package com.luxurytravel.backend.featured;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(
        name = "featured_cards",
        uniqueConstraints = @UniqueConstraint(columnNames = {"category", "item_id"})
)
public class FeaturedCard {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FeaturedCardCategory category;

    @Column(name = "item_id", nullable = false)
    private Long itemId;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public FeaturedCard() {
    }

    public FeaturedCard(FeaturedCardCategory category, Long itemId) {
        this.category = category;
        this.itemId = itemId;
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public FeaturedCardCategory getCategory() {
        return category;
    }

    public void setCategory(FeaturedCardCategory category) {
        this.category = category;
    }

    public Long getItemId() {
        return itemId;
    }

    public void setItemId(Long itemId) {
        this.itemId = itemId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
