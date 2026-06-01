package com.luxurytravel.backend.featured;

import java.util.Locale;

public enum FeaturedCardCategory {
    DESTINATION,
    EXPERIENCE,
    SERVICE;

    public static FeaturedCardCategory fromApiValue(String value) {
        if (value == null) {
            throw new IllegalArgumentException("category is required");
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return FeaturedCardCategory.valueOf(normalized);
    }

    public String toApiValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
