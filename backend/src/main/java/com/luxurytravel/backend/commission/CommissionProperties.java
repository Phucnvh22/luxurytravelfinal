package com.luxurytravel.backend.commission;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Commission configuration loaded from application.yml.
 *
 * Example:
 * application:
 *   commission:
 *     modules:
 *       booking:
 *         default-rate: 5
 *         type-rates:
 *           "dài hạng": 8
 */
@Component
@ConfigurationProperties(prefix = "application.commission")
public class CommissionProperties {
    /**
     * Keyed by module name (e.g. booking, service-request, experience-request).
     */
    private Map<String, Module> modules = new HashMap<>();

    public Map<String, Module> getModules() {
        return modules;
    }

    public void setModules(Map<String, Module> modules) {
        this.modules = modules != null ? modules : new HashMap<>();
    }

    public static class Module {
        /**
         * Percentage rate (e.g. 10 means 10%).
         */
        private Double defaultRate;

        /**
         * Percentage rate (e.g. 10 means 10%), keyed by service "type".
         */
        private Map<String, Double> typeRates = new HashMap<>();

        public Double getDefaultRate() {
            return defaultRate;
        }

        public void setDefaultRate(Double defaultRate) {
            this.defaultRate = defaultRate;
        }

        public Map<String, Double> getTypeRates() {
            return typeRates;
        }

        public void setTypeRates(Map<String, Double> typeRates) {
            this.typeRates = typeRates != null ? typeRates : new HashMap<>();
        }
    }
}
