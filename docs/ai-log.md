# AI log

Every time you give an AI tool a significant prompt, add an entry. Three lines each.
"Nothing was wrong" is allowed, but it is rarely true. Your instructor will read this.

## Build 2

### Prompt 1: Build 2 prompt (docs/build-2.md)
- **What I asked:**
- **What came back:**
- **What was wrong (or "nothing"):**

### Prompt 2:
- **What I asked:**
- **What came back:**
- **What was wrong (or "nothing"):**

## Build 3

### Prompt 1: Build 3 prompt (docs/build-3.md)
- **What I asked:** Add the architecture diagrams, booking state machine, Node HTTP router/server, configuration, startup script, and tests.
- **What came back:** A layered architecture document, explicit booking transitions, static-file HTTP server, `/health` route, startup configuration, and `node:test` coverage.
- **What was wrong (or "nothing"):** The first server draft relied on an implicit response/request property for HEAD handling and had redundant error-status logic; both were simplified. Added a regression test proving static requests cannot escape `public/`.

## Build 4

### Prompt 1: Build 4 REST API prompt (docs/build-4.md)
- **What I asked:** Implement an in-memory REST API using an async repository and injected services; reuse the existing domain state machine, search and sorting; provide a mock payment gateway that never sees card data; add event, tier, publish, search, booking, payment and unpaid-cancellation routes; document curl examples; and test through the real server.
- **What came back:** Added the memory repository, event and booking services, mock payment gateway, API routes, API examples and real-server `node:test` coverage. The app now uses the API router by default and passes query parameters to route handlers.
- **What was wrong (or "nothing"):** The first API test run exposed that the shared state machine permits cancelling paid bookings, while Build 4 permits only unpaid cancellations. The service now explicitly rejects paid cancellation, and the API tests cover this rule, declined-payment retry, payment ownership, validation, sold-out capacity and seat release. `npm test` passes all 48 tests, and `git diff --check` passes.