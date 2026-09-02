package com.luxurytravel.backend.villaservice;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.ArrayList;
import java.util.List;

public class VillaServiceCatalogUpsertRequest {
    @NotBlank
    @Size(max = 255)
    private String name;

    private Double unitPrice;

    private Boolean active;

    private List<@Size(max = 255) String> vendorNames = new ArrayList<>();

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Double getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(Double unitPrice) {
        this.unitPrice = unitPrice;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public List<String> getVendorNames() {
        return vendorNames;
    }

    public void setVendorNames(List<String> vendorNames) {
        this.vendorNames = vendorNames == null ? new ArrayList<>() : vendorNames;
    }
}
