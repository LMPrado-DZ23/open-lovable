# P10/P11 checkpoint - NOT a runnable feature or completed delivery

Base ad758af. The current source checkpoint preserves tests, proposed schema and budget validation only.

Implemented before the tool denial: strict budget parser (two focused tests passed), typed approval data interfaces and additive SQLite migration 8. The approval service, queue integration, client controls and PostgreSQL counterpart were NOT written. Five approval tests intentionally fail because the service is absent. Do not activate this schema or label this branch as verified.

The operation to modify lib/runs/queue.ts, lib/runs/types.ts and pending-state handling in lib/projects/store.ts was refused by OpenAI safety before execution. A read-only check confirmed executionControl is absent and no ApprovalService exists. Do not retry that operation through another tool or encoded command. It needs the authorized tool environment to permit the action; this is not a missing provider credential.

Unrelated fixes were also made in this source branch: project-scoped settings navigation, retaining previously uncertain outcomes on restore/import, and bounded worker startup waiting after a crash. Those changes will be validated separately on a branch based on ad758af without the unfinished P10 migration or tests. This separation preserves every failed test and all prototype source instead of weakening gates.

Next P10 work, only once the operation is permitted: satisfy tests/approved-resume.test.ts against a durable service; bind each decision to actor, resource revision, exact connection, nonce and expiry; append grants instead of mutating admitted authority; integrate real user flow and restore/import invalidation; test budgets at dispatch; run complete gates. No merge, deployment or paid inference was performed.
