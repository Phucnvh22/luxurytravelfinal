package com.luxurytravel.backend.featured;

public class FeaturedCardResponse {
    private Long id;
    private String category;

    public FeaturedCardResponse() {
    }

    public FeaturedCardResponse(Long id, String category) {
        this.id = id;
        this.category = category;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }
}
