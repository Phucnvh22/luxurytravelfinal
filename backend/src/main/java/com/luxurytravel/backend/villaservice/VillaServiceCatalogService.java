package com.luxurytravel.backend.villaservice;

import com.luxurytravel.backend.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class VillaServiceCatalogService {
    static final String TARGET_TYPE_CATALOG = "CATALOG";

    private final VillaServiceCatalogRepository villaServiceCatalogRepository;
    private final VillaServiceVendorRepository villaServiceVendorRepository;
    private final VillaServiceOrderItemRepository villaServiceOrderItemRepository;
    private final VillaServiceLogRepository villaServiceLogRepository;

    public VillaServiceCatalogService(
            VillaServiceCatalogRepository villaServiceCatalogRepository,
            VillaServiceVendorRepository villaServiceVendorRepository,
            VillaServiceOrderItemRepository villaServiceOrderItemRepository,
            VillaServiceLogRepository villaServiceLogRepository
    ) {
        this.villaServiceCatalogRepository = villaServiceCatalogRepository;
        this.villaServiceVendorRepository = villaServiceVendorRepository;
        this.villaServiceOrderItemRepository = villaServiceOrderItemRepository;
        this.villaServiceLogRepository = villaServiceLogRepository;
    }

    @Transactional(readOnly = true)
    public List<VillaServiceCatalogResponse> list() {
        Map<Long, Long> usageCountByServiceId = new LinkedHashMap<>();
        for (Object[] row : villaServiceOrderItemRepository.countUsageByCatalogServiceId()) {
            if (row.length < 2 || !(row[0] instanceof Long serviceId) || !(row[1] instanceof Long usageCount)) {
                continue;
            }
            usageCountByServiceId.put(serviceId, usageCount);
        }

        return villaServiceCatalogRepository.findAllByOrderByNameAscIdAsc().stream()
                .map(service -> toResponse(service, usageCountByServiceId.getOrDefault(service.getId(), 0L)))
                .toList();
    }

    @Transactional
    public VillaServiceCatalogResponse create(VillaServiceCatalogUpsertRequest request, User actor) {
        String normalizedName = normalizeName(request.getName());
        if (villaServiceCatalogRepository.existsByNameIgnoreCase(normalizedName)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Service name already exists");
        }

        VillaServiceCatalog service = new VillaServiceCatalog();
        service.setName(normalizedName);
        service.setUnitPrice(VillaServicePricing.normalizeMoney(request.getUnitPrice()));
        service.setActive(request.getActive() == null || request.getActive());
        service.setVendors(resolveVendors(request.getVendorNames()));
        VillaServiceCatalog saved = villaServiceCatalogRepository.save(service);
        log(TARGET_TYPE_CATALOG, saved.getId(), "CATALOG_CREATED", actor, "Created service " + saved.getName());
        return toResponse(saved, 0L);
    }

    @Transactional
    public VillaServiceCatalogResponse update(Long id, VillaServiceCatalogUpsertRequest request, User actor) {
        VillaServiceCatalog service = findService(id);
        String normalizedName = normalizeName(request.getName());
        if (villaServiceCatalogRepository.existsByNameIgnoreCaseAndIdNot(normalizedName, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Service name already exists");
        }

        service.setName(normalizedName);
        service.setUnitPrice(VillaServicePricing.normalizeMoney(request.getUnitPrice()));
        if (request.getActive() != null) {
            service.setActive(request.getActive());
        }
        service.setVendors(resolveVendors(request.getVendorNames()));
        VillaServiceCatalog saved = villaServiceCatalogRepository.save(service);
        long usageCount = villaServiceOrderItemRepository.countUsageByCatalogServiceId().stream()
                .filter(row -> row.length >= 2 && row[0] instanceof Long serviceId && serviceId.equals(saved.getId()))
                .map(row -> row[1] instanceof Long usage ? usage : 0L)
                .findFirst()
                .orElse(0L);
        log(TARGET_TYPE_CATALOG, saved.getId(), "CATALOG_UPDATED", actor, "Updated service " + saved.getName());
        return toResponse(saved, usageCount);
    }

    @Transactional
    public void delete(Long id, User actor) {
        VillaServiceCatalog service = findService(id);
        villaServiceCatalogRepository.delete(service);
        log(TARGET_TYPE_CATALOG, id, "CATALOG_DELETED", actor, "Deleted service " + service.getName());
    }

    VillaServiceCatalog findService(Long id) {
        return villaServiceCatalogRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));
    }

    private VillaServiceCatalogResponse toResponse(VillaServiceCatalog service, long usageCount) {
        return new VillaServiceCatalogResponse(
                service.getId(),
                service.getName(),
                service.getUnitPrice(),
                service.isActive(),
                usageCount,
                service.getVendors().stream()
                        .sorted((left, right) -> left.getName().compareToIgnoreCase(right.getName()))
                        .map(VillaServiceVendorResponse::from)
                        .toList(),
                service.getCreatedAt(),
                service.getUpdatedAt()
        );
    }

    private String normalizeName(String name) {
        String normalized = name == null ? "" : name.trim();
        if (normalized.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Service name is required");
        }
        return normalized;
    }

    private Set<VillaServiceVendor> resolveVendors(List<String> vendorNames) {
        Set<VillaServiceVendor> vendors = new LinkedHashSet<>();
        if (vendorNames == null) {
            return vendors;
        }
        for (String vendorName : vendorNames) {
            String normalizedName = normalizeVendorName(vendorName);
            if (normalizedName.isBlank()) {
                continue;
            }
            VillaServiceVendor vendor = villaServiceVendorRepository.findByNameIgnoreCase(normalizedName)
                    .orElseGet(() -> {
                        VillaServiceVendor created = new VillaServiceVendor();
                        created.setName(normalizedName);
                        return villaServiceVendorRepository.save(created);
                    });
            vendors.add(vendor);
        }
        return vendors;
    }

    private String normalizeVendorName(String name) {
        return name == null ? "" : name.trim();
    }

    void log(String targetType, Long targetId, String action, User actor, String details) {
        VillaServiceLog log = new VillaServiceLog();
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setAction(action);
        log.setActorUsername(actor == null ? "system" : actor.getUsername());
        log.setActorName(actor == null ? "System" : actor.getFullName());
        log.setDetails(details == null ? "" : details.trim());
        villaServiceLogRepository.save(log);
    }
}
