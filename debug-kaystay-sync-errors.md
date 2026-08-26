# Debug Session: kaystay-sync-errors
- **Status**: [OPEN]
- **Issue**: KayStay sync reports `7 villa(s), 0 blocked days, 0 released days, 28 reservation(s) processed, 7 error(s)` instead of creating calendar blocks for matched villas.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: `.dbg/trae-debug-log-kaystay-sync-errors.ndjson`

## Reproduction Steps
1. Open Admin Room Bookings calendar.
2. Click `Sync KayStay`.
3. Observe popup reporting processed reservations but non-zero errors and zero blocked days.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | KayStay room IDs are matched, but booking day expansion throws at runtime inside `applyRoomBookings`. | High | Low | Rejected |
| B | `SmartOrderBooking` data is parsed, but service accesses record fields incorrectly or null-sensitive note building crashes. | High | Low | Rejected |
| C | Existing external booking lookup/upsert path fails for `KAYSTAY_BLOCK` reservations. | Medium | Medium | Confirmed |
| D | Room-code extraction/matching is incomplete, causing a partial match set and downstream null room handling. | Medium | Low | Rejected |

## Log Evidence
- Runtime exception from production: `Data truncated for column 'status' at row 1` while executing insert into `room_bookings`.
- Stack points to [KayStayCalendarSyncService.upsertBlockedDate](file:///Users/nguyenviethoangphuc/workSpace/luxury-travel/backend/src/main/java/com/luxurytravel/backend/integration/kaystay/KayStayCalendarSyncService.java) save path.
- Existing schema script [20260817_add_airbnb_block_status.sql](file:///Users/nguyenviethoangphuc/workSpace/luxury-travel/backend/sql/20260817_add_airbnb_block_status.sql#L1-L9) only allows enum values through `AIRBNB_BLOCK`, not `KAYSTAY_BLOCK`.

## Verification Conclusion
- Root cause confirmed: application code writes `RoomBookingStatus.KAYSTAY_BLOCK`, but MySQL column `room_bookings.status` still uses an ENUM definition that does not include that value.
- Minimal fix: add SQL migration to extend the ENUM with `KAYSTAY_BLOCK`, then apply it on the production database before rerunning KayStay sync.
