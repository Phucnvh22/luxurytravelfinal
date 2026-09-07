package com.luxurytravel.backend.villasetting;

import java.util.List;

public class VillaSettingsResponse {
    private final List<VillaSettingOption> roomTypes;
    private final List<VillaSettingOption> bedroomLayouts;
    private final List<VillaSettingOption> hosts;
    private final List<VillaSettingOption> bookingSources;
    private final List<VillaSettingOption> supportLinks;

    public VillaSettingsResponse(
            List<VillaSettingOption> roomTypes,
            List<VillaSettingOption> bedroomLayouts,
            List<VillaSettingOption> hosts,
            List<VillaSettingOption> bookingSources,
            List<VillaSettingOption> supportLinks
    ) {
        this.roomTypes = roomTypes;
        this.bedroomLayouts = bedroomLayouts;
        this.hosts = hosts;
        this.bookingSources = bookingSources;
        this.supportLinks = supportLinks;
    }

    public List<VillaSettingOption> getRoomTypes() {
        return roomTypes;
    }

    public List<VillaSettingOption> getBedroomLayouts() {
        return bedroomLayouts;
    }

    public List<VillaSettingOption> getHosts() {
        return hosts;
    }

    public List<VillaSettingOption> getBookingSources() {
        return bookingSources;
    }

    public List<VillaSettingOption> getSupportLinks() {
        return supportLinks;
    }
}
