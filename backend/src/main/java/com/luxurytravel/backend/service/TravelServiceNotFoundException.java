package com.luxurytravel.backend.service;

public class TravelServiceNotFoundException extends RuntimeException {
    public TravelServiceNotFoundException(Long id) {
        super("Service not found: " + id);
    }
}
