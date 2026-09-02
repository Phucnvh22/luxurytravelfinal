package com.luxurytravel.backend.villaservice;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class VillaServiceOrderItemRequest {
    @NotNull
    private Long serviceId;

    @NotNull
    @Min(1)
    private Integer quantity;

    @Min(0)
    private Double unitPrice;

    private Long vendorId;

    @Min(0)
    private Double vendorCost;

    public Long getServiceId() {
        return serviceId;
    }

    public void setServiceId(Long serviceId) {
        this.serviceId = serviceId;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public Double getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(Double unitPrice) {
        this.unitPrice = unitPrice;
    }

    public Long getVendorId() {
        return vendorId;
    }

    public void setVendorId(Long vendorId) {
        this.vendorId = vendorId;
    }

    public Double getVendorCost() {
        return vendorCost;
    }

    public void setVendorCost(Double vendorCost) {
        this.vendorCost = vendorCost;
    }
}
