package com.luxurytravel.backend.villaservice;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "villa_service_orders")
public class VillaServiceOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String orderType;

    @Column(nullable = false, length = 30)
    private String status;

    @Column
    private Long bookingId;

    @Column(length = 50)
    private String bookingRoomCode;

    @Column(length = 255)
    private String bookingGuestName;

    @Column(nullable = false, length = 255)
    private String customerName = "";

    @Column(nullable = false, length = 50)
    private String customerPhone = "";

    @Column
    private LocalDate serviceDate;

    @Column(nullable = false, length = 2000)
    private String notes = "";

    @Column
    private Double serviceTotal;

    @Column
    private Double vendorCostTotal;

    @Column
    private Double depositAmount;

    @Column
    private Double remainingAmount;

    @Column
    private Double bookingBaseAmount;

    @Column
    private Double finalTotal;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getOrderType() {
        return orderType;
    }

    public void setOrderType(String orderType) {
        this.orderType = orderType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Long getBookingId() {
        return bookingId;
    }

    public void setBookingId(Long bookingId) {
        this.bookingId = bookingId;
    }

    public String getBookingRoomCode() {
        return bookingRoomCode;
    }

    public void setBookingRoomCode(String bookingRoomCode) {
        this.bookingRoomCode = bookingRoomCode;
    }

    public String getBookingGuestName() {
        return bookingGuestName;
    }

    public void setBookingGuestName(String bookingGuestName) {
        this.bookingGuestName = bookingGuestName;
    }

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

    public Double getServiceTotal() {
        return serviceTotal;
    }

    public void setServiceTotal(Double serviceTotal) {
        this.serviceTotal = serviceTotal;
    }

    public Double getVendorCostTotal() {
        return vendorCostTotal;
    }

    public void setVendorCostTotal(Double vendorCostTotal) {
        this.vendorCostTotal = vendorCostTotal;
    }

    public Double getDepositAmount() {
        return depositAmount;
    }

    public void setDepositAmount(Double depositAmount) {
        this.depositAmount = depositAmount;
    }

    public Double getRemainingAmount() {
        return remainingAmount;
    }

    public void setRemainingAmount(Double remainingAmount) {
        this.remainingAmount = remainingAmount;
    }

    public Double getBookingBaseAmount() {
        return bookingBaseAmount;
    }

    public void setBookingBaseAmount(Double bookingBaseAmount) {
        this.bookingBaseAmount = bookingBaseAmount;
    }

    public Double getFinalTotal() {
        return finalTotal;
    }

    public void setFinalTotal(Double finalTotal) {
        this.finalTotal = finalTotal;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
