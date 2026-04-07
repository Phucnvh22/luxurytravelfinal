package com.luxurytravel.backend.service;

public class ServiceRequestNotFoundException extends RuntimeException {
    public ServiceRequestNotFoundException(Long id) {
        super("Service request not found: " + id);
    }
}

