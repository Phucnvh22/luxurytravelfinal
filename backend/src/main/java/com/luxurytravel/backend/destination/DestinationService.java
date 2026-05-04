package com.luxurytravel.backend.destination;

import com.luxurytravel.backend.booking.BookingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.CONFLICT;

import java.util.List;

@Service
public class DestinationService {
    private final DestinationRepository destinationRepository;
    private final BookingRepository bookingRepository;

    public DestinationService(DestinationRepository destinationRepository, BookingRepository bookingRepository) {
        this.destinationRepository = destinationRepository;
        this.bookingRepository = bookingRepository;
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
        if (bookingRepository.existsByDestination_Id(id)) {
            throw new ResponseStatusException(CONFLICT, "Cannot delete destination because it has related bookings");
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
