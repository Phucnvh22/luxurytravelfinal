package com.luxurytravel.backend.villaservice;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "villa_service_order_items")
public class VillaServiceOrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long orderId;

    @Column(nullable = false)
    private Long catalogServiceId;

    @Column(nullable = false, length = 255)
    private String serviceName;

    @Column
    private Long vendorId;

    @Column(length = 255)
    private String vendorName;

    @Column(nullable = false)
    private Double unitPrice;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private Double lineTotal;

    @Column
    private Double vendorCost;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long orderId) {
        this.orderId = orderId;
    }

    public Long getCatalogServiceId() {
        return catalogServiceId;
    }

    public void setCatalogServiceId(Long catalogServiceId) {
        this.catalogServiceId = catalogServiceId;
    }

    public String getServiceName() {
        return serviceName;
    }

    public void setServiceName(String serviceName) {
        this.serviceName = serviceName;
    }

    public Long getVendorId() {
        return vendorId;
    }

    public void setVendorId(Long vendorId) {
        this.vendorId = vendorId;
    }

    public String getVendorName() {
        return vendorName;
    }

    public void setVendorName(String vendorName) {
        this.vendorName = vendorName;
    }

    public Double getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(Double unitPrice) {
        this.unitPrice = unitPrice;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public Double getLineTotal() {
        return lineTotal;
    }

    public void setLineTotal(Double lineTotal) {
        this.lineTotal = lineTotal;
    }

    public Double getVendorCost() {
        return vendorCost;
    }

    public void setVendorCost(Double vendorCost) {
        this.vendorCost = vendorCost;
    }
}
