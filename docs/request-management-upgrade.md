# Request Management Upgrade

## Scope implemented
- Backend request list sorting by newest first (`createdAt desc, id desc`) for:
  - service requests
  - experience requests
- Admin real-time notification (polling) for pending requests:
  - service requests
  - experience requests
- Redesigned guest quantity input:
  - no default `2`
  - placeholder-based entry
  - positive integer validation
  - increment/decrement controls
  - clear & retype support
  - paste sanitization and keyboard arrow handling

## Backend design
- Sorting moved to repository methods:
  - `findAllByOrderByCreatedAtDescIdDesc`
  - seller/user scoped variants
- Added optimized summary endpoint:
  - `GET /api/admin/requests/summary`
  - Returns pending counts and latest request ids
  - Uses `countByStatus(PENDING)` for performance on large datasets

## Frontend design
- Global admin notification in `Layout`:
  - polls `/api/admin/requests/summary` every 5s
  - burger badge displays total pending
  - menu-level badges show pending service/experience counts
  - flash banner appears when new request fingerprint changes
- Guest input extracted to reusable component:
  - `GuestQuantityInput`
  - used in Service and Experience detail request forms

## Testing
- Backend unit test:
  - `ServiceRequestServiceSortingTest` (sorting order preserved)
- Backend integration test:
  - `AdminRequestSummaryIntegrationTest` (summary endpoint counts/latest ids)
- Frontend UI test:
  - `GuestQuantityInput.test.tsx` (typing, +/- controls, keyboard handling)

## Commands
- Backend tests: `./mvnw test`
- Backend build: `./mvnw -DskipTests package`
- Frontend tests: `npm run test`
- Frontend lint/build: `npm run lint && npm run build`

## Deployment guide
1. Build backend artifact: `./mvnw -DskipTests package`
2. Build frontend static bundle: `npm run build`
3. Deploy backend first, then frontend
4. Smoke test:
   - `/api/service-requests` sorted newest first
   - `/api/experience-requests` sorted newest first
   - `/api/admin/requests/summary` returns counts
   - admin badge updates after creating new requests

## Rollback plan
1. Keep previous backend jar/image tag.
2. Keep previous frontend static bundle tag.
3. Rollback order:
   - frontend to previous tag
   - backend to previous tag
4. Validate core routes and request creation after rollback.

