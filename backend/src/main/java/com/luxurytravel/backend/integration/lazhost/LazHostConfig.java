package com.luxurytravel.backend.integration.lazhost;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(LazHostProperties.class)
public class LazHostConfig {
}
