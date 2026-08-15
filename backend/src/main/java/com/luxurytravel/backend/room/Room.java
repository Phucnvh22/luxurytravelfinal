package com.luxurytravel.backend.room;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "rooms")
public class Room {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String host = "";

    @Column(nullable = false)
    private String type;

    @Column(length = 1000)
    private String airbnbUrl = "";

    @Column(nullable = false)
    private Integer floorNumber;

    @Column(nullable = false)
    private Integer maxAdults = 2;

    @Column(nullable = false)
    private Integer maxChildren = 0;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false, length = 255)
    private String bedroomLayout = "";

    @Column(nullable = false, length = 255)
    private String location = "";

    @Column(nullable = false, length = 255)
    private String wifiName = "";

    @Column(nullable = false, length = 255)
    private String wifiPassword = "";

    @Column(nullable = false, length = 255)
    private String doorPassword = "";

    @Column(nullable = false, length = 1000)
    private String notes = "";

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private RoomOperationalStatus operationalStatus = RoomOperationalStatus.READY;

    @Column
    private Instant statusUpdatedAt;

    @Column
    private Instant lastCheckInMarkedAt;

    @Column
    private Instant lastCheckOutMarkedAt;

    @Column
    private Instant cleaningRequestedAt;

    @Column
    private Instant lastReadyAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (operationalStatus == null) {
            operationalStatus = RoomOperationalStatus.READY;
        }
        if (statusUpdatedAt == null) {
            statusUpdatedAt = now;
        }
        if (operationalStatus == RoomOperationalStatus.READY && lastReadyAt == null) {
            lastReadyAt = now;
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getHost() {
        return host;
    }

    public void setHost(String host) {
        this.host = host;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getAirbnbUrl() {
        return airbnbUrl;
    }

    public void setAirbnbUrl(String airbnbUrl) {
        this.airbnbUrl = airbnbUrl;
    }

    public Integer getFloorNumber() {
        return floorNumber;
    }

    public void setFloorNumber(Integer floorNumber) {
        this.floorNumber = floorNumber;
    }

    public Integer getMaxAdults() {
        return maxAdults;
    }

    public void setMaxAdults(Integer maxAdults) {
        this.maxAdults = maxAdults;
    }

    public Integer getMaxChildren() {
        return maxChildren;
    }

    public void setMaxChildren(Integer maxChildren) {
        this.maxChildren = maxChildren;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public String getBedroomLayout() {
        return bedroomLayout;
    }

    public void setBedroomLayout(String bedroomLayout) {
        this.bedroomLayout = bedroomLayout;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getWifiName() {
        return wifiName;
    }

    public void setWifiName(String wifiName) {
        this.wifiName = wifiName;
    }

    public String getWifiPassword() {
        return wifiPassword;
    }

    public void setWifiPassword(String wifiPassword) {
        this.wifiPassword = wifiPassword;
    }

    public String getDoorPassword() {
        return doorPassword;
    }

    public void setDoorPassword(String doorPassword) {
        this.doorPassword = doorPassword;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public RoomOperationalStatus getOperationalStatus() {
        return operationalStatus;
    }

    public void setOperationalStatus(RoomOperationalStatus operationalStatus) {
        this.operationalStatus = operationalStatus;
    }

    public Instant getStatusUpdatedAt() {
        return statusUpdatedAt;
    }

    public void setStatusUpdatedAt(Instant statusUpdatedAt) {
        this.statusUpdatedAt = statusUpdatedAt;
    }

    public Instant getLastCheckInMarkedAt() {
        return lastCheckInMarkedAt;
    }

    public void setLastCheckInMarkedAt(Instant lastCheckInMarkedAt) {
        this.lastCheckInMarkedAt = lastCheckInMarkedAt;
    }

    public Instant getLastCheckOutMarkedAt() {
        return lastCheckOutMarkedAt;
    }

    public void setLastCheckOutMarkedAt(Instant lastCheckOutMarkedAt) {
        this.lastCheckOutMarkedAt = lastCheckOutMarkedAt;
    }

    public Instant getCleaningRequestedAt() {
        return cleaningRequestedAt;
    }

    public void setCleaningRequestedAt(Instant cleaningRequestedAt) {
        this.cleaningRequestedAt = cleaningRequestedAt;
    }

    public Instant getLastReadyAt() {
        return lastReadyAt;
    }

    public void setLastReadyAt(Instant lastReadyAt) {
        this.lastReadyAt = lastReadyAt;
    }
}
