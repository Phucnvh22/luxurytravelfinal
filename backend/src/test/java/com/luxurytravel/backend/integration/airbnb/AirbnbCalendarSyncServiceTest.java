package com.luxurytravel.backend.integration.airbnb;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class AirbnbCalendarSyncServiceTest {

    @Test
    void parseAvailabilityResponse_shouldExtractBlockedAndAvailableDays() throws Exception {
        String responseBody = """
                {
                  "data": {
                    "merlin": {
                      "pdpAvailabilityCalendar": {
                        "calendarMonths": [
                          {
                            "month": 9,
                            "year": 2026,
                            "days": [
                              { "calendarDate": "2026-09-04", "available": false, "bookable": false },
                              { "calendarDate": "2026-09-08", "available": true, "bookable": true },
                              { "calendarDate": "2026-09-14", "available": false, "bookable": false },
                              { "calendarDate": "2026-09-17", "available": true, "bookable": true }
                            ]
                          }
                        ]
                      }
                    }
                  }
                }
                """;

        assertThat(AirbnbCalendarSyncService.parseAvailabilityResponse(responseBody))
                .containsEntry(LocalDate.of(2026, 9, 4), AirbnbCalendarSyncService.AvailabilityResult.BLOCKED)
                .containsEntry(LocalDate.of(2026, 9, 8), AirbnbCalendarSyncService.AvailabilityResult.AVAILABLE)
                .containsEntry(LocalDate.of(2026, 9, 14), AirbnbCalendarSyncService.AvailabilityResult.BLOCKED)
                .containsEntry(LocalDate.of(2026, 9, 17), AirbnbCalendarSyncService.AvailabilityResult.AVAILABLE);
    }

    @Test
    void classifyApiDay_shouldReturnUnknownWhenAvailabilityFieldsAreMissing() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();

        assertThat(AirbnbCalendarSyncService.classifyApiDay(objectMapper.readTree("{\"calendarDate\":\"2026-09-04\"}")))
                .isEqualTo(AirbnbCalendarSyncService.AvailabilityResult.UNKNOWN);
    }

    @Test
    void buildAvailabilityApiUrl_shouldIncludePersistedQueryAndListingId() {
        AirbnbSyncProperties properties = new AirbnbSyncProperties();
        properties.setCurrency("VND");
        properties.setBaseUrl("https://www.airbnb.com.vn");

        String apiUrl = AirbnbCalendarSyncService.buildAvailabilityApiUrl(
                "1638256476749924498",
                LocalDate.of(2026, 9, 8),
                2,
                properties
        );

        assertThat(apiUrl)
                .contains("/api/v3/StaysPdpAtomicAvailabilityCalendarQuery/")
                .contains("operationName=StaysPdpAtomicAvailabilityCalendarQuery")
                .contains("listingId")
                .contains("1638256476749924498")
                .contains("count")
                .contains("currency=VND");
    }

    @Test
    void extractProductId_shouldSupportRoomsAndStaysUrls() {
        assertThat(AirbnbCalendarSyncService.extractProductId("https://www.airbnb.com/rooms/1638256476749924498"))
                .contains("1638256476749924498");
        assertThat(AirbnbCalendarSyncService.extractProductId("https://www.airbnb.com.vn/book/stays/1638256476749924498?productId=1638256476749924498"))
                .contains("1638256476749924498");
    }
}
