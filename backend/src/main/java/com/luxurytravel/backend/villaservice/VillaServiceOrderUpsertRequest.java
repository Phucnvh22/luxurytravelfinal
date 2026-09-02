package com.luxurytravel.backend.villaservice;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class VillaServiceOrderUpsertRequest {
    @Size(max = 255)
    private String customerName;

    @Size(max = 50)
    private String customerPhone;

    @NotNull
    private LocalDate serviceDate;

    @Size(max = 2000)
    private String notes;

    @Size(max = 30)
    private String status;

    private Double depositAmount;

    @Valid
    private List<VillaServiceOrderItemRequest> items = new ArrayList<>();

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getCustomerPhone() {
        return customerPhone;
    }

    public void setCustomerPhone(String customerPhone) {
        this.customerPhone = customerPhone;
    }

    public LocalDate getServiceDate() {
        return serviceDate;
    }

    public void setServiceDate(LocalDate serviceDate) {
        this.serviceDate = serviceDate;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Double getDepositAmount() {
        return depositAmount;
    }

    public void setDepositAmount(Double depositAmount) {
        this.depositAmount = depositAmount;
    }

    public List<VillaServiceOrderItemRequest> getItems() {
        return items;
    }

    public void setItems(List<VillaServiceOrderItemRequest> items) {
        this.items = items;
    }
}
