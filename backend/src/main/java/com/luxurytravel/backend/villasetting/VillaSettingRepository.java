package com.luxurytravel.backend.villasetting;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VillaSettingRepository extends JpaRepository<VillaSettingOption, Long> {
    List<VillaSettingOption> findAllByOrderByCategoryAscIdAsc();

    boolean existsByCategoryAndLabelIgnoreCase(VillaSettingCategory category, String label);

    boolean existsByCategoryAndLabelIgnoreCaseAndIdNot(VillaSettingCategory category, String label, Long id);
}
