package com.luxurytravel.backend.villaservice;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class VillaServicePricingTest {

    @Test
    void calculatesOrderTotalFromLineTotals() {
        double total = VillaServicePricing.calculateOrderTotal(List.of(500_000D, 300_000D, 200_000D));

        assertEquals(1_000_000D, total);
    }

    @Test
    void calculatesBookingTotalsAndRemainingAmount() {
        Double grandTotal = VillaServicePricing.calculateBookingTotal(5_000_000D, 800_000D);
        Double remaining = VillaServicePricing.calculateRemainingAmount(grandTotal, 1_000_000D, null);
        double vendorCostTotal = VillaServicePricing.calculateVendorCostTotal(List.of(300_000D, 200_000D));

        assertEquals(5_800_000D, grandTotal);
        assertEquals(4_800_000D, remaining);
        assertEquals(500_000D, vendorCostTotal);
    }

    @Test
    void returnsFallbackRemainingWhenTotalMissing() {
        assertEquals(250_000D, VillaServicePricing.calculateRemainingAmount(null, 100_000D, 250_000D));
        assertNull(VillaServicePricing.calculateBookingTotal(null, null));
    }
}
