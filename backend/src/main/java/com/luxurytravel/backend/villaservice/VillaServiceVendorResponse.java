package com.luxurytravel.backend.villaservice;

public record VillaServiceVendorResponse(
        Long id,
        String name
) {
    public static VillaServiceVendorResponse from(VillaServiceVendor vendor) {
        return new VillaServiceVendorResponse(vendor.getId(), vendor.getName());
    }
}
