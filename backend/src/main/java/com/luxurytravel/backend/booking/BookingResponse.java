package com.luxurytravel.backend.booking;

import java.time.Instant;
import java.time.LocalDate;

public class BookingResponse {
    private Long id;
    private Long destinationId;
    private String destinationName;
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

    public static BookingResponse from(Booking booking) {
        BookingResponse response = new BookingResponse();
        response.setId(booking.getId());
        response.setDestinationId(booking.getDestination().getId());
        response.setDestinationName(booking.getDestination().getName());
        response.setCustomerName(booking.getCustomerName());
        response.setEmail(booking.getEmail());
        response.setPhone(booking.getPhone());
        response.setTravelDate(booking.getTravelDate());
        response.setTravelers(booking.getTravelers());
        response.setNotes(booking.getNotes());
        response.setStatus(booking.getStatus());
        response.setCreatedAt(booking.getCreatedAt());
        response.setSellerId(booking.getSellerId());
        response.setUserId(booking.getUserId());
        response.setTotalPrice(booking.getTotalPrice());
        response.setCommissionAmount(booking.getCommissionAmount());
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getDestinationId() {
        return destinationId;
    }

    public void setDestinationId(Long destinationId) {
        this.destinationId = destinationId;
    }

    public String getDestinationName() {
        return destinationName;
    }

    public void setDestinationName(String destinationName) {
        this.destinationName = destinationName;
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
