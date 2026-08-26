package com.luxurytravel.backend.integration.kaystay;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(KayStaySyncProperties.class)
public class KayStaySyncConfig {
}
