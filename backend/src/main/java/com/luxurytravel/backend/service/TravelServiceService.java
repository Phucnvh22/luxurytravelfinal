package com.luxurytravel.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TravelServiceService {
    private final TravelServiceRepository travelServiceRepository;

    public TravelServiceService(TravelServiceRepository travelServiceRepository) {
        this.travelServiceRepository = travelServiceRepository;
    }

    @Transactional(readOnly = true)
    public List<TravelService> list() {
        return travelServiceRepository.findAll();
    }

    @Transactional(readOnly = true)
    public TravelService getById(Long id) {
        return travelServiceRepository.findById(id).orElseThrow(() -> new TravelServiceNotFoundException(id));
    }

    @Transactional
    public TravelService create(TravelServiceUpsertRequest request) {
        TravelService s = new TravelService();
        apply(s, request);
        return travelServiceRepository.save(s);
    }

    @Transactional
    public TravelService update(Long id, TravelServiceUpsertRequest request) {
        TravelService s = getById(id);
        apply(s, request);
        return travelServiceRepository.save(s);
    }

    @Transactional
    public void delete(Long id) {
        TravelService s = getById(id);
        travelServiceRepository.delete(s);
    }

    private void apply(TravelService s, TravelServiceUpsertRequest request) {
        s.setName(request.getName());
        s.setDescription(request.getDescription());
        s.setPriceFrom(request.getPriceFrom());
        s.setImageUrl(request.getImageUrl());
        s.setVideoUrls(request.getVideoUrls());
    }
}
