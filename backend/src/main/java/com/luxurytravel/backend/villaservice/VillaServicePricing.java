package com.luxurytravel.backend.villaservice;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

public final class VillaServicePricing {
    private VillaServicePricing() {
    }

    public static Double normalizeMoney(Double value) {
        if (value == null) {
            return null;
        }
        if (value < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount cannot be negative");
        }
        return value;
    }

    public static double calculateOrderTotal(List<Double> lineTotals) {
        return lineTotals == null
                ? 0D
                : lineTotals.stream()
                .filter(value -> value != null && !Double.isNaN(value))
                .mapToDouble(Double::doubleValue)
                .sum();
    }

    public static double calculateVendorCostTotal(List<Double> vendorCosts) {
        return vendorCosts == null
                ? 0D
                : vendorCosts.stream()
                .filter(value -> value != null && !Double.isNaN(value))
                .mapToDouble(Double::doubleValue)
                .sum();
    }

    public static Double calculateBookingTotal(Double villaRate, Double serviceTotal) {
        double normalizedVillaRate = villaRate == null ? 0D : villaRate;
        double normalizedServiceTotal = serviceTotal == null ? 0D : serviceTotal;
        double total = normalizedVillaRate + normalizedServiceTotal;
        return total <= 0.000001 ? null : total;
    }

    public static Double calculateRemainingAmount(Double totalAmount, Double depositAmount, Double fallbackAmount) {
        if (totalAmount == null) {
            return fallbackAmount;
        }
        double remaining = totalAmount - (depositAmount == null ? 0D : depositAmount);
        return Math.max(remaining, 0D);
    }
}
