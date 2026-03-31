package com.luxurytravel.backend.category;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "categories")
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String iconUrl;

    private boolean isNewFeature;

    public Category() {
    }

    public Category(String name, String iconUrl, boolean isNewFeature) {
        this.name = name;
        this.iconUrl = iconUrl;
        this.isNewFeature = isNewFeature;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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
