# Durable run control: implementation checkpoint, NOT a completed delivery

Base: 13f89dbefa4b92924aff3669cf337e69fadf9c7a (PR #6, successful CI 35937107948). Working branch: wip/p07-durable-run-control-20260924. V2 and V2.1 remain the scope; this checkpoint does not close P07/P08/P09 or the product.

## Implemented in this checkpoint

- SQLite migration 6 widens the canonical run state with QUEUED and adds immutable-input control records, a per-run ordered journal and a single-node worker lease. Input fingerprints and lease tokens are checked on worker writes. Database constraints do not yet independently prevent every possible direct control-record mutation.
- Versioned enqueue/read/events/cancel/accept APIs. Enqueue returns 202. Observers do not own execution lifetime. The existing request-bound API remains for compatibility; the Studio UI still uses that older API.
- Original source, selected images, references, history, model binding and authorization are captured at admission. Model output is checkpointed before deterministic compilation. An uncertain model outcome after an expired worker lease is interrupted, not automatically reissued.
- Worker uses the existing model resolver and virtual compiler; no arbitrary project shell, package script or generated application code runs on the control host. This is not the isolated full-stack runner from P12/P13 and not the tool/repair loop from P16/P18.
- Current session, membership and model connection are revalidated. Changing provider settings does not silently reuse prior queued consent. Usage unknowns are null rather than fabricated zero.
- A dedicated application worker build and Studio process supervisor were added. Supervisor tests cover startup failure, child ownership, shutdown and environment precedence. The worker is single-node SQLite, not a PostgreSQL/distributed implementation.
- PostgreSQL migration 3 preserves import structure; runtime grants do not expose the new internal control tables. This migration has not yet been tested against the real PostgreSQL CI service in this checkpoint.
- Backup and import preserve the journal but invalidate pending execution in the restored/imported destination, so a recovery cannot trigger inference automatically. Migration tests preserve old relations and restore FK enforcement; corrupted relations refuse the upgrade.

## Verified scope and open failures

Focused queue tests (6), worker HTTP/compilation plus existing workflow tests (14), versioned API plus access contracts (10), migration/recovery contracts (22), and supervisor tests (4) passed in their recorded runs. The HTTP model endpoint used synthetic responses, not a real paid model. Time/lease failure tests are deterministic contracts, not full host-crash chaos tests.

The complete unit/API run currently has 185 tests: 184 passed and one failed. The failure is the older flat route-discovery test trying to import app/api/v1/route.ts instead of descending into nested routes. It remains present and failing. Its discovery should be expanded while preserving authentication assertions for every handler, not bypassed with exclusions or an empty file.

The two newly added browser cases currently fail: one has Portuguese locators damaged by the Windows pipe encoding; the other unintentionally inherits Playwright Basic credentials, so it is not actually anonymous. These failures do not prove the intended close-tab behavior. Fix the test setup, observe the real failure against the legacy UI, then connect the UI to v1 and prove the full behavior. Do not remove the tests or reinterpret their errors as passes.

The tool refused two combined edits before execution: the recursive authentication-discovery correction, and the browser locator/anonymous-client correction. They were not repeated through another tool or path. These are specific tool-operation blocks, not loss of device connection and not missing cloud credentials. Independent lint variable-name fixes were allowed and did not change assertions.

## Exact continuation

1. Resolve the refused test-edit operations through the authorized environment; do not bypass tool controls.
2. Correct the test-discovery and browser setup issues above. Keep the original gates and all new negative tests.
3. Integrate the Studio with v1 enqueue/observe/cancel/accept and add the execution journal UI. Legacy stored runs need an explicit compatibility path; no silent cancellation on tab close.
4. Verify the compiled worker in a distinct process during actual generation, including graceful stop, forced loss, checkpoint resume, session revocation and destination rotation.
5. Validate PostgreSQL migration/import version 3 against the existing disposable CI service. Validate accounts against the real pinned GoTrue service again.
6. Complete adversarial review: malformed stored control data must not poison all work; harden control-field immutability, deadline/fencing on every exit, source/row budgets, observer cleanup and safe error handling. No completion claim based on the current count of tests.
7. Run clean installation, admission, lint, typecheck, unit/API, browser, real-database/auth and build gates. Record the same SHA and independently review before merge or release.

The last published green application revision remains PR #6 / 13f89db. Main and production remain unchanged. No live provider, user credential, production database or paid service was used for these changes. The Next aborted-request diagnostic documented in P05 is still open.

## Final checkpoint verification

Lint and TypeScript passed after the independent variable-name cleanup. Unit/API: 184 passed, 1 failed. Browser: 26 existing scenarios passed, 2 new scenarios failed for the setup reasons above. The 8 baseline-verifier tests were not reached by this failed npm test command; no new pass is claimed for them. Worker and Next builds passed in the recorded pre-UI build. Evidence metadata/hashes are in docs/evidence/p07-p09-checkpoint.json. This is a source preservation checkpoint, not a release candidate.
