package com.luxurytravel.backend.destination;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class DestinationService {
    private final DestinationRepository destinationRepository;

    public DestinationService(DestinationRepository destinationRepository) {
        this.destinationRepository = destinationRepository;
    }

    public List<Destination> list() {
        return destinationRepository.findAllByOrderByCreatedAtDescIdDesc();
    }

    public Destination getById(Long id) {
        return destinationRepository.findById(id)
                .orElseThrow(() -> new DestinationNotFoundException(id));
    }

    @Transactional
    public Destination create(DestinationUpsertRequest request) {
        Destination destination = new Destination();
        apply(destination, request);
        return destinationRepository.save(destination);
    }

    @Transactional
    public Destination update(Long id, DestinationUpsertRequest request) {
        Destination destination = getById(id);
        apply(destination, request);
        return destinationRepository.save(destination);
    }

    @Transactional
    public void delete(Long id) {
        if (!destinationRepository.existsById(id)) {
            throw new DestinationNotFoundException(id);
        }
        destinationRepository.deleteById(id);
    }

    private void apply(Destination destination, DestinationUpsertRequest request) {
        destination.setName(request.getName());
        destination.setLocation(request.getLocation());
        destination.setDescription(request.getDescription());
        destination.setPriceFrom(request.getPriceFrom());
        destination.setDurationDays(request.getDurationDays());
        destination.setImageUrl(request.getImageUrl());
        destination.setVideoUrls(request.getVideoUrls());
    }
}
