package com.luxurytravel.backend.commission;

import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;

@Service
public class CommissionService {
    public static final String MODULE_BOOKING = "booking";
    public static final String MODULE_SERVICE_REQUEST = "service-request";
    public static final String MODULE_EXPERIENCE_REQUEST = "experience-request";

    private final CommissionProperties properties;

    public CommissionService(CommissionProperties properties) {
        this.properties = properties;
    }

    public double calculateCommissionAmount(String module, String serviceType, double totalPrice, Double fallbackSellerRate) {
        double rate = resolveRate(module, serviceType, fallbackSellerRate);
        if (rate <= 0 || totalPrice <= 0) {
            return 0.0;
        }
        return totalPrice * rate / 100.0;
    }

    /**
     * Resolve commission rate as a percentage (e.g. 10 means 10%).
     *
     * Precedence:
     * 1) application.commission.modules[<module>].type-rates[<serviceType>]
     * 2) application.commission.modules[<module>].default-rate
     * 3) fallbackSellerRate (legacy behavior)
     */
    public double resolveRate(String module, String serviceType, Double fallbackSellerRate) {
        CommissionProperties.Module m = getModule(module);
        if (m != null) {
            Double byType = getTypeRate(m.getTypeRates(), serviceType);
            if (byType != null) {
                return byType;
            }
            if (m.getDefaultRate() != null) {
                return m.getDefaultRate();
            }
        }
        return fallbackSellerRate != null ? fallbackSellerRate : 0.0;
    }

    private CommissionProperties.Module getModule(String module) {
        if (module == null) return null;
        Map<String, CommissionProperties.Module> modules = properties.getModules();
        if (modules == null || modules.isEmpty()) return null;

        String normalized = normalize(module);
        for (Map.Entry<String, CommissionProperties.Module> e : modules.entrySet()) {
            if (normalize(e.getKey()).equals(normalized)) {
                return e.getValue();
            }
        }
        return null;
    }

    private Double getTypeRate(Map<String, Double> typeRates, String serviceType) {
        if (typeRates == null || typeRates.isEmpty() || serviceType == null) return null;
        String normalizedType = normalize(serviceType);
        for (Map.Entry<String, Double> e : typeRates.entrySet()) {
            if (normalize(e.getKey()).equals(normalizedType)) {
                return e.getValue();
            }
        }
        return null;
    }

    private String normalize(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }
}
