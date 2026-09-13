package com.luxurytravel.backend.integration.kaystay;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class KayStayCalendarSyncServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void isSmartOrderClosedStatus_shouldDetectTopLevelClosedValue() throws Exception {
        var order = objectMapper.readTree("""
                {
                  "status": "closed"
                }
                """);

        assertThat(KayStayCalendarSyncService.isSmartOrderClosedStatus(order)).isTrue();
    }

    @Test
    void isSmartOrderClosedStatus_shouldDetectNestedOutOfOrderSignal() throws Exception {
        var order = objectMapper.readTree("""
                {
                  "roomStatusInfo": {
                    "statusName": "Out of Order"
                  }
                }
                """);

        assertThat(KayStayCalendarSyncService.isSmartOrderClosedStatus(order)).isTrue();
        assertThat(KayStayCalendarSyncService.findSmartOrderClosedSignal(order))
                .contains("roomStatusInfo.statusName=Out of Order");
    }

    @Test
    void isSmartOrderClosedStatus_shouldDetectCloseFlag() throws Exception {
        var order = objectMapper.readTree("""
                {
                  "closeFlag": true
                }
                """);

        assertThat(KayStayCalendarSyncService.isSmartOrderClosedStatus(order)).isTrue();
    }

    @Test
    void isSmartOrderClosedStatus_shouldIgnoreClosedWordInIrrelevantRemark() throws Exception {
        var order = objectMapper.readTree("""
                {
                  "remark": "Guest requested closed curtains"
                }
                """);

        assertThat(KayStayCalendarSyncService.isSmartOrderClosedStatus(order)).isFalse();
    }

    @Test
    void isClosedLikeRoomStatus_shouldMatchKayStayRoomCloseCodes() {
        assertThat(KayStayCalendarSyncService.isClosedLikeRoomStatus(2)).isTrue();
        assertThat(KayStayCalendarSyncService.isClosedLikeRoomStatus(3)).isTrue();
        assertThat(KayStayCalendarSyncService.isClosedLikeRoomStatus(6)).isTrue();
        assertThat(KayStayCalendarSyncService.isClosedLikeRoomStatus(8)).isTrue();
        assertThat(KayStayCalendarSyncService.isClosedLikeRoomStatus(1)).isFalse();
        assertThat(KayStayCalendarSyncService.isClosedLikeRoomStatus(7)).isFalse();
    }

    @Test
    void parseSmartOrderDate_shouldParseIsoDate() {
        assertThat(KayStayCalendarSyncService.parseSmartOrderDate("2026-09-11"))
                .isEqualTo(LocalDate.of(2026, 9, 11));
        assertThat(KayStayCalendarSyncService.parseSmartOrderDate("")).isNull();
    }
}
