package com.luxurytravel.backend.destination;

public class DestinationNotFoundException extends RuntimeException {
    public DestinationNotFoundException(Long id) {
        super("Destination not found: " + id);
    }
}
