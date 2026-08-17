package com.luxurytravel.backend.integration.airbnb;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(AirbnbSyncProperties.class)
public class AirbnbSyncConfig {
}
