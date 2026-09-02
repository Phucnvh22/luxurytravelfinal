package com.luxurytravel.backend.villasetting;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class VillaSettingUpsertRequest {
    @NotNull
    private VillaSettingCategory category;

    @NotBlank
    @Size(max = 255)
    private String label;

    public VillaSettingCategory getCategory() {
        return category;
    }

    public void setCategory(VillaSettingCategory category) {
        this.category = category;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }
}
