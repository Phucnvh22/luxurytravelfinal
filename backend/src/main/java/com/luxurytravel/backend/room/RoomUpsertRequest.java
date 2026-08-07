package com.luxurytravel.backend.room;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class RoomUpsertRequest {
    @NotBlank
    @Size(max = 50)
    private String code;

    @NotBlank
    @Size(max = 255)
    private String name;

    @NotBlank
    @Size(max = 100)
    private String type;

    @NotNull
    @Min(1)
    private Integer floorNumber;

    @NotNull
    @Min(1)
    private Integer maxAdults;

    @NotNull
    @Min(0)
    private Integer maxChildren;

    @NotNull
    private Boolean active;

    @Size(max = 1000)
    private String notes;

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

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
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

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
