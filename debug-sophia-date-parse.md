# Debug Session: sophia-date-parse
- **Status**: [OPEN]
- **Issue**: Sophia sync fails while parsing BookingList HTML with `Could not determine Sophia selected date`.
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-sophia-date-parse.ndjson

## Reproduction Steps
1. Open admin room bookings page.
2. Trigger `Sync Sophia`.
3. Backend throws `java.io.IOException: Could not determine Sophia selected date`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Sophia returns a non-BookingList HTML page after postback/login flow. | High | Low | Rejected for initial/login page, confirmed only after failing postback |
| B | BookingList HTML is returned, but selected date is absent from all currently checked selectors. | High | Low | Rejected for initial page, confirmed only on Sophia 500 error page |
| C | Date exists in the HTML but under a different attribute/node due to server-side variation or encoding. | Medium | Low | Rejected |
| D | The `31 days` postback does not apply, so parser sees an intermediate page without scheduler state. | Medium | Medium | Confirmed |

## Log Evidence
- Instrumentation added to `SophiaCalendarSyncService` at hypotheses A, B, and D.
- `A`: Initial response is login page; post-login response is valid `BookingList` with scheduler table and selected date input.
- `B`: Initial `BookingList` contains `[[2026,8,19]]`, `sum-2026-08-19`, and `T4, 19/08`.
- `D`: After forced `31 days` postback for `2026-08-01`, Sophia returns HTTP `500` and page text `Index was out of range...`.

## Verification Conclusion
- Root cause is Sophia server-side failure on forced `31 days` postback for arbitrary historical window start.
- Minimal fix: stop forcing month-start postback, clamp sync to present/future window, and keep instrumentation for post-fix verification.
