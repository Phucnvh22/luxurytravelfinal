package com.luxurytravel.backend.villaservice;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VillaServiceVendorRepository extends JpaRepository<VillaServiceVendor, Long> {
    Optional<VillaServiceVendor> findByNameIgnoreCase(String name);

    List<VillaServiceVendor> findAllByOrderByNameAscIdAsc();
}
