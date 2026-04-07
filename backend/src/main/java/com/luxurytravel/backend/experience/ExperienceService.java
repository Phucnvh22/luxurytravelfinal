package com.luxurytravel.backend.experience;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class ExperienceService {
    private final ExperienceRepository experienceRepository;

    public ExperienceService(ExperienceRepository experienceRepository) {
        this.experienceRepository = experienceRepository;
    }

    @Transactional(readOnly = true)
    public List<Experience> list() {
        return experienceRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Experience getById(Long id) {
        return experienceRepository.findById(id).orElseThrow(() -> new ExperienceNotFoundException(id));
    }

    @Transactional
    public Experience create(ExperienceUpsertRequest request) {
        Experience e = new Experience();
        apply(e, request);
        return experienceRepository.save(e);
    }

    @Transactional
    public Experience update(Long id, ExperienceUpsertRequest request) {
        Experience e = getById(id);
        apply(e, request);
        return experienceRepository.save(e);
    }

    @Transactional
    public void delete(Long id) {
        Experience e = getById(id);
        experienceRepository.delete(e);
    }

    private void apply(Experience e, ExperienceUpsertRequest request) {
        e.setName(request.getName().trim());
        e.setDescription(request.getDescription().trim());
        e.setPriceFrom(request.getPriceFrom());
        e.setImageUrl(request.getImageUrl().trim());
        e.setVideoUrls(request.getVideoUrls() != null ? request.getVideoUrls() : new ArrayList<>());
    }
}
