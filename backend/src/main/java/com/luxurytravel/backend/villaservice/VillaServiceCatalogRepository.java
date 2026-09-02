package com.luxurytravel.backend.villaservice;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VillaServiceCatalogRepository extends JpaRepository<VillaServiceCatalog, Long> {
    List<VillaServiceCatalog> findAllByOrderByNameAscIdAsc();

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
