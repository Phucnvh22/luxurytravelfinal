package com.luxurytravel.backend.roombooking;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class RoomBookingStatusSchemaUpdater implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(RoomBookingStatusSchemaUpdater.class);

    private static final String ROOM_BOOKING_STATUS_ENUM_SQL = """
            ALTER TABLE room_bookings
            MODIFY COLUMN status ENUM(
              'PENDING',
              'CONFIRMED',
              'TEMP_BLOCK',
              'CLOSED',
              'AIRBNB_BLOCK',
              'KAYSTAY_BLOCK',
              'SOPHIA_BLOCK',
              'CHECKED_IN',
              'CHECKED_OUT',
              'CANCELLED'
            ) NOT NULL DEFAULT 'PENDING'
            """;

    private final JdbcTemplate jdbcTemplate;

    public RoomBookingStatusSchemaUpdater(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<Map<String, Object>> columns = jdbcTemplate.queryForList("""
                SELECT data_type, column_type
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'room_bookings'
                  AND column_name = 'status'
                """);

        if (columns.isEmpty()) {
            return;
        }

        Map<String, Object> column = columns.get(0);
        String dataType = String.valueOf(column.getOrDefault("data_type", "")).toLowerCase(Locale.ROOT);
        String columnType = String.valueOf(column.getOrDefault("column_type", "")).toLowerCase(Locale.ROOT);

        if (!dataType.equals("enum")) {
            log.info("Skipping room_bookings.status schema update because data_type={} column_type={}", dataType, columnType);
            return;
        }

        if (columnType.contains("'closed'")) {
            return;
        }

        jdbcTemplate.execute(ROOM_BOOKING_STATUS_ENUM_SQL);
        log.info("Updated room_bookings.status enum to include CLOSED.");
    }
}
