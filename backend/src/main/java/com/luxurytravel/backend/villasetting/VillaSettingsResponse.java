package com.luxurytravel.backend.villasetting;

import java.util.List;

public class VillaSettingsResponse {
    private final List<VillaSettingOption> roomTypes;
    private final List<VillaSettingOption> hosts;
    private final List<VillaSettingOption> bookingSources;

    public VillaSettingsResponse(List<VillaSettingOption> roomTypes, List<VillaSettingOption> hosts, List<VillaSettingOption> bookingSources) {
        this.roomTypes = roomTypes;
        this.hosts = hosts;
        this.bookingSources = bookingSources;
    }

    public List<VillaSettingOption> getRoomTypes() {
        return roomTypes;
    }

    public List<VillaSettingOption> getHosts() {
        return hosts;
    }

    public List<VillaSettingOption> getBookingSources() {
        return bookingSources;
    }
}
