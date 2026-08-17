ALTER TABLE room_bookings
    MODIFY COLUMN status ENUM(
        'PENDING',
        'CONFIRMED',
        'AIRBNB_BLOCK',
        'CHECKED_IN',
        'CHECKED_OUT',
        'CANCELLED'
    ) NOT NULL;
