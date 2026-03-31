package com.luxurytravel.backend.category;

import jakarta.validation.constraints.NotBlank;

public class CategoryUpsertRequest {

    @NotBlank(message = "Tên danh mục không được để trống")
    private String name;

    private String iconUrl;

    private boolean isNewFeature;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getIconUrl() {
        return iconUrl;
    }

    public void setIconUrl(String iconUrl) {
        this.iconUrl = iconUrl;
    }

    public boolean isNewFeature() {
        return isNewFeature;
    }

    public void setNewFeature(boolean newFeature) {
        isNewFeature = newFeature;
    }
}
