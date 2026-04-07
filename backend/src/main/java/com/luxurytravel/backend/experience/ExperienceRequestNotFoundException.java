package com.luxurytravel.backend.experience;

public class ExperienceRequestNotFoundException extends RuntimeException {
    public ExperienceRequestNotFoundException(Long id) {
        super("Experience request not found: " + id);
    }
}

