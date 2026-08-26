package com.luxurytravel.backend.integration.sophia;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(SophiaSyncProperties.class)
public class SophiaSyncConfig {
}
