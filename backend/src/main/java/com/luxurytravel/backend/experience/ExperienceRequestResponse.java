package com.luxurytravel.backend.experience;

import com.luxurytravel.backend.booking.BookingStatus;

import java.time.Instant;
import java.time.LocalDate;

public class ExperienceRequestResponse {
    private Long id;
    private Long experienceId;
    private String experienceName;
    private String customerName;
    private String email;
    private String phone;
    private LocalDate travelDate;
    private Integer travelers;
    private String notes;
    private BookingStatus status;
    private Instant createdAt;
    private Long sellerId;
    private Long userId;
    private Double totalPrice;
    private Double commissionAmount;

    public static ExperienceRequestResponse from(ExperienceRequest request) {
        ExperienceRequestResponse response = new ExperienceRequestResponse();
        response.setId(request.getId());
        response.setExperienceId(request.getExperience().getId());
        response.setExperienceName(request.getExperience().getName());
        response.setCustomerName(request.getCustomerName());
        response.setEmail(request.getEmail());
        response.setPhone(request.getPhone());
        response.setTravelDate(request.getTravelDate());
        response.setTravelers(request.getTravelers());
        response.setNotes(request.getNotes());
        response.setStatus(request.getStatus());
        response.setCreatedAt(request.getCreatedAt());
        response.setSellerId(request.getSellerId());
        response.setUserId(request.getUserId());
        response.setTotalPrice(request.getTotalPrice());
        response.setCommissionAmount(request.getCommissionAmount());
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getExperienceId() {
        return experienceId;
    }

    public void setExperienceId(Long experienceId) {
        this.experienceId = experienceId;
    }

    public String getExperienceName() {
        return experienceName;
    }

    public void setExperienceName(String experienceName) {
        this.experienceName = experienceName;
    }

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public LocalDate getTravelDate() {
        return travelDate;
    }

    public void setTravelDate(LocalDate travelDate) {
        this.travelDate = travelDate;
    }

    public Integer getTravelers() {
        return travelers;
    }

    public void setTravelers(Integer travelers) {
        this.travelers = travelers;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public BookingStatus getStatus() {
        return status;
    }

    public void setStatus(BookingStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Long getSellerId() {
        return sellerId;
    }

    public void setSellerId(Long sellerId) {
        this.sellerId = sellerId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Double getTotalPrice() {
        return totalPrice;
    }

    public void setTotalPrice(Double totalPrice) {
        this.totalPrice = totalPrice;
    }

    public Double getCommissionAmount() {
        return commissionAmount;
    }

    public void setCommissionAmount(Double commissionAmount) {
        this.commissionAmount = commissionAmount;
    }
}

