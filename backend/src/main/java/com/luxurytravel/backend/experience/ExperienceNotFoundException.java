package com.luxurytravel.backend.experience;

public class ExperienceNotFoundException extends RuntimeException {
    public ExperienceNotFoundException(Long id) {
        super("Experience not found: " + id);
    }
}

