# Execucao - Plano Open Lovable V2 + Emenda V2.1

## P00 - baseline e gates

- Fonte: 5066bdd77aee4dd56d07be03bc5bc57b2a1c3977; main observada 69bd93bae7a9c97ef989eb70aabe6797fb3dac89.
- Branch isolada: chore/p00-baseline-20260923. Original preservado, sem stash/reset/merge/deploy.
- Estado: BASELINE_REPRODUCED; LOCAL_TOOLING_VERIFIED; review/CI do novo commit pendentes.
- RED: 8 assertions falharam por ausencia do verificador, registradas em .audit/p00-next/red.log.
- GREEN focal: 8 testes passaram; caso PowerShell externo 0 / filho 7 foi recusado pelo verificador.
- Gates originais: instalacao, lint, types, 80 testes, build, 20 E2E, audit e diff passaram.
- Evidencias: docs/evidence/baseline.json; p00-triage.json; p00-negative-gate.json; p00-report.md.
- Decisao: manter npm/package-lock; integrar .mjs de infraestrutura por test:roadmap para nao deixar subpasta fora do CI.
- Decisao: hashes sao integridade de evidencia, nao assinatura nem certificacao.
- Riscos: chave retida ao mudar endpoint e scanner em binario reproduzidos; P01/P02 nao corrigidos aqui.
- Externo: modelo e servicos nao homologados; nao usados para justificar as falhas locais.
- Dependencias novas: nenhuma. Candidatos de terceiros ainda nao admitidos; proximo P50.
- Proxima acao: validar ferramenta completa e CI; depois P01/P02/P50/P03; nao refazer o planejamento.

- Reteste final: 80 testes existentes + 8 de infraestrutura; 20 E2E; lint/types/build/audit/verificador passaram; docs/evidence/p00-tooling-verification.json.

- Ambiente: allowlist corrigida para preservar SystemDrive; arquivos de cache gerados isolados sem exclusao e fora do Git. Novo E2E e teste do verificador passaram; sem recorrencia.

## Execucao F00 - P01/P02/P50/P03 (retomada)

- Base conferida: fc9b915; worktree isolado existente, branch fix/f00-security-recovery-20260923.
- Ordem: testes de regressao -> credenciais -> midia/paths/logging -> admissao -> recuperacao; sem migrations historicas editadas.
- P01/P02 compartilham transporte: audiencia validada antes da rede; somente partes de imagens decodificadas podem ser tratadas como binario.
- Ruling: reentrada explicita de chave ou remocao permite novo endpoint; campo vazio nunca concede mudanca de audiencia.
- Ruling: nenhuma dependencia nova ou codigo externo sera incorporado neste lote; P50 prepara o gate, nao concede admissao automatica.
- P03 depende do teste de chaves/paths; teste de restore usa apenas base sintetica e destino novo.
- P00 CI conferido no historico; resultados do novo SHA exigem nova verificacao. Sem merge/deploy/recursos pagos.
- Proximas tarefas em andamento: P01 e P02. Demais pacotes continuam abertos.

## F00 - estado antes da verificacao de entrega

- P01: guard de audiencia implementado; 12 testes de credenciais passaram. Mudanca de host/porta/protocolo/base path exige reentrada de chave ou limpeza explicita. Mesmo destino normalizado preserva a chave. CAS/transacao preservados.
- P02: regressao de raster reproduzida e corrigida na API e no transporte de inferencia; somente bytes raster decodificados sao separados da verificacao textual. Links remotos de imagens nao sao aceitos. Dados visiveis nos pixels nao sao detectados como segredos.
- P02: removida escrita de codigo gerado em stdout e payload de prompt nos logs dos fluxos tratados; nao e auditoria completa de todos os logs legados.
- P02: aliases Darwin admitidos somente para pares exatos root-owned; teste local de politica passou; homologacao macOS depende da nova CI. Schema futuro agora e recusado antes de mudar journal_mode.
- P50: politica de admissao e verificacao de bytes/licenca implementadas; registro tem 59 referencias nao admitidas. NENHUMA dependencia nova foi incorporada ou licenciada nesta rodada.
- Suites focais P01/P02/P50: 47 testes passaram em .audit/f00/green-slice.json. Lint passou depois de renomear uma variavel de teste reservada. Verificacao de entrega completa ainda pendente.
- P03: prototipo e testes de recuperacao preservados LOCALMENTE. Ensaio feliz restaurou dados sinteticos, mas caso de chave de backup diferente da chave das conexoes FALHOU. Operacao de correcao foi bloqueada pela ferramenta e nao executou. Nao repetir por outro mecanismo.
- Decisao de entrega: publicar apenas P01/P02 e infraestrutura P50, em commit testado separado. Lib/CLI/testes do prototipo P03 NAO integram essa entrega e permanecem no worktree original de F00, sem exclusao. P03 continua aberto; isso nao encerra F00 nem a meta geral.
- Arquivos P03 locais: lib/projects/recovery.ts; scripts/recovery.ts; tests/backup-roundtrip.test.ts; tests/recovery-cli.test.ts. O manifest npm local ainda inclui o script experimental; o commit publico nao o inclui.
- Bloqueio adicional: gravação de um teste de revogacao em andamento foi recusada e nao executou. Nao ha claim de cancelamento de clientes SDK ja iniciados.
- O primeiro ensaio de captura de stdout do teste interferiu com o runner e foi encerrado; substituido por captura de subprocesso, que reproduziu e validou a correcao. Nenhum teste existente foi removido.
- Browser plugin not available; verificacao usa o Playwright ja configurado. Fluxo: /settings/ai -> mudar endpoint -> recusar segredo implicito -> salvar com chave explicita -> metadata sem segredo.
- Base fc9b915 e alteracoes anteriores preservadas. Nenhuma migration historica, segredo real, recurso pago, main ou producao alterados.

## F00 - verificacao da entrega separada

- Arvore Git d2545025bf96a5865842aecd65da563fb846ad41 extraida em open-lovable-f00-validation-20260923; instalacao limpa com npm ci --ignore-scripts.
- Verificacoes: 100 testes de codigo/API/integracao + 8 de infraestrutura; 21 E2E; lint; types; build; check:admission; security:audit: todos exit 0. Logs/digests em docs/evidence/f00-verification.json.
- Git archive converteu line endings no Windows: digests do blob e dos bytes testados registrados separadamente, com igualdade de texto normalizado. Nao foi admitida nenhuma diferenca de codigo.
- Capturas desktop/mobile de configuracoes inspecionadas; campos e nova orientacao de endpoint visiveis, sem tela vazia/overlay. Provedores eram fixtures HTTP/SSE, nao servicos reais.
- P03 segue em desenvolvimento separado, com falha reproduzida. A arvore de entrega nao inclui seu modulo, CLI nem novos testes; o trabalho local os preserva. Nenhum teste existente do baseline foi removido.
- CI Windows/macOS/Linux do novo commit e revisao independente devem ser conferidos separadamente antes de aceitar a entrega. F00 nao encerrado.

## P03 retomada - snapshot autenticado

- Branch isolada existente derivada de cf4c86f; pendencias preservadas em .audit/p03-resume/prechange-source.zip.
- RED atual: backup aceita chave diferente da usada nas conexoes; teste mantido.
- Ruling: validar a chave contra todas as linhas cifradas do snapshot consistente, nao somente da base viva; leitura compartilhada com o cofre sem executar migrations.
- P01/P02/P50 compartilham paths/cofre; preservar audiencia e criptografia existente. Nenhum segredo real e nenhuma operacao de producao autorizados por esta correcao.

## P03 - implementation and local verification

- The preserved prototype is now included with its original failing test corrected, not excluded from the delivered tree.
- Added read-only source backup, shared credential authentication for every snapshot connection, standalone verify CLI, schema/content checks, bounds and isolated restore.
- RED and GREEN captures: .audit/f00/p03-resume-red.json, p03-guard-green.json, p03-safety-red.json, p03-integrity-green.json, p03-budgets-red.json, p03-budgets-green.json.
- First full local run: 113 code/API/integration + 8 verifier tests; 22 E2E; lint/types/build/audit passed. Fresh clean-install verification remains to be recorded from its actual exit codes.
- Browser restoration exercised a separate authenticated loopback server and preserved the original synthetic database; screenshot inspected.
- P03 does not imply F00 review acceptance or hosted/full-product completion. No live recovery, key copying between projects, dependency addition, merge or deployment.
- Next code phase after reviewed recovery: P04 contracts and persistence. Docker daemon unavailable in read-only probe; no service changed.

## P03 review follow-up

- Review issue 4086900020 reproduced: synchronous work starved timeout timers. A monotonic check now rejects expiration even without event-loop progress; focused RED/GREEN and full gates passed.
- Corrected conflicting SECURITY status and moved browser-context setup into server-cleanup protection.
- Evidence: docs/evidence/p03-review.json; 115 code/API tests + 8 verifier tests and 22 browser scenarios in the current check. No new provider call, dependency or data migration.
- P04 next: real workspace-scoped repositories; preserve existing individual flows and distinguish hosted adapter validation from hosted product completion.

## P04 - workspace persistence implementation

- Baseline 34e65ea; new isolated branch; existing product paths remain supported.
- Ruling: expose only implemented repository operations (read/list/create/save/revisions/restore). Draft/patch/approval contracts are added when P17/P23 are implemented; no stub methods.
- SQLite keeps canonical rows; migration 4 adds workspace and membership boundaries without rewriting migrations 1-3. Legacy owners map deterministically and revoked memberships are never silently restored.
- PostgreSQL adapter uses the same behavioral contract, bounded transactions and parameter binding. Test database must be disposable and distinct from production.
- Docker Desktop start timed out; no installation, license acceptance or settings change attempted. PostgreSQL validation will use an isolated CI service if no local daemon is available.
- First RED: shared repository contract; pending implementations are not marked complete.

- P04 local shared repository/API/migration tests passed. PostgreSQL adapter, explicit migrator/importer and real-service CI tests are implemented; PostgreSQL validation still requires the new CI job, not the unavailable local Docker daemon.
- Ruling: npm sources are pinned by exact package version + registry SRI + selected file hashes rather than fabricated Git SHAs. Fourteen new driver/type dependencies were inspected without lifecycle scripts, with MIT/ISC notices retained; prior lock entries remain unchanged. Source repository metadata was read using authorized GitHub actions; a broader shell metadata request had been refused and was not executed.
- Import preserves existing data, refuses a nonempty target and does not activate a hosted backend. Remaining auth/jobs/connectors are not falsely represented as PostgreSQL-ready.

- P04 first full local verification: 130 code/API tests, 8 baseline checks and 22 E2E; lint/types/build/admission/audit passed. Evidence docs/evidence/p04-local.json. PostgreSQL real-service tests are prepared, not yet executed; publication is an incremental draft awaiting that gate.

- PR5 review confirmed the import-column bug already reproduced by real PostgreSQL: sha256 rejected by an over-restrictive identifier regex. Added a local regression against every declared schema column and kept rejection of SQL metacharacters.
- Corrected an unnecessary SQLite write lock during context reads (two-connection regression), and tied admission decisions to actual canonical review artifacts across LF/CRLF.
- Review follow-up: require npm tarball path to match package/version; expose sanitized domain precondition errors in operator CLI; test runtime roles now have unique per-run identifiers/secrets and cleanup only the role created by the test. Repeated PostgreSQL suite on the same disposable server is a CI gate.

- P04 review verification: 136 root code/API tests + 8 baseline tests and 22 E2E passed. Real PostgreSQL initial run passed 7/8 and exposed the column-name bug; fixed with local RED/GREEN while keeping the actual import test. Full PostgreSQL retry is required on the follow-up SHA.
- Evidence: docs/evidence/p04-review.json. No live credentials, source cutover, merge or production change.


## P05 - identity and workspaces (execution started)

- Baseline ec98549. P04 PostgreSQL CI run 35923307652 passed, including import and repeatability; earlier ledger entries remain historical. No merge or production change.
- Ruling: integrate account-backed sessions and workspaces with the canonical single-node SQLite flow first, so existing runs/images/credentials remain in one authorization and persistence boundary. PostgreSQL hosted activation is not claimed until all those domains and identity are wired together; no dual-write, no fake hosted mode.
- Implement server-held Supabase Auth sessions (opaque HttpOnly cookie), live verified identity, bounded refresh, revocation, CSRF, login budgets, email-bound single-use invitations, roles and workspace-scoped connections. Keep the individual profile isolated and explicitly deny legacy global sandbox routes in the account profile.
- Pre-flight: identity touches middleware/API/model resolver/generation/recovery. Preserve old individual contracts; recheck membership after async work and before storing proposals; account workspaces never inherit operator environment credentials.
- Verification: RED/GREEN unit and HTTP contract fixtures; full prior suite; browser flow for two identities; external Supabase/SMTP remains a separate homologation, not faked by fixtures.

- P05 UI direction: keep the existing warm-white Studio, restrained copper accents and clear form/table hierarchy. Login is a compact credential form, workspace management exposes real roles/invitation states; no fake metrics or unrelated imagery. Desktop, tablet and mobile use the same actions.
- Browser plugin not available. Use the installed Playwright runner. Target: sign in -> create workspace -> invite second verified identity -> edit shared project -> reduce role/revoke -> verify denied write/read -> logout. All provider fixtures remain explicitly synthetic.

- P05 resume: uncommitted source preserved; actual schema compatibility tests failed (PostgreSQL identity migration/import missing). Append PostgreSQL migration 2 without altering v1 SQL/digest; support source schemas 4 and 5 without source mutation. Identity tables are not granted to the project runtime role. No hosted cutover.

- P05 browser trace showed the revoke action was correctly cancelled by the native confirmation dialog (no POST was issued). The test now explicitly accepts that dialog and waits for the actual successful revocation response before verifying denied access. No authorization assertion was removed.

- Visual RED: existing theme maps numerical spacing utilities to pixels, so default-style p-6/py-3 produced cramped 26px fields. Converted only new account surfaces to explicit pixel spacing and added >=44px field assertions; existing theme preserved. Workspace bar now consumes the management page session metadata instead of showing a stale selected workspace.

- Refresh lease RED reproduced reclaim at 31 seconds although two bounded provider calls can consume 30 seconds. Lease now 45 seconds; stale completions still fenced. Invitation-memory test also ran in Next dev: it passed before any change, so no unproven StrictMode defect was claimed or patched.

## P05 - local verification and pending independent gates

- Opt-in Supabase Auth profile with encrypted opaque sessions, email-bound one-use invitations, workspace management and server-side role checks. The individual profile and prior project flow remain available separately.
- Added PostgreSQL migration 2/SQLite migration 5 compatibility and identity-aware import/recovery. Past migration SQL is preserved; restored/imported browser sessions and pending invitations are invalidated explicitly.
- Local final check, browser and dependency audit exited zero; original command artifacts verified by bytes and SHA-256 in docs/evidence/p05-local.json. Browser includes two identities and actual role changes/revocation, not only page rendering. Current account screenshots inspected after pixel-scale spacing correction.
- No new runtime npm dependency, no user credentials or data, no deployment or main change. The optional upstream Auth container is CI-only, pinned by manifest digest with license/source inspection recorded.
- Real PostgreSQL v1-to-v2 upgrade/import and the pinned upstream Auth protocol tests remain pending until their CI results are read. The local Auth HTTP fixture does not certify Supabase cloud or SMTP.
- Remaining operational warning: cancelled incoming requests reach a Next.js 15.5.26 uncaughtException log. Monitor traced node:_http_server; servers remained responsive. No blanket exception swallowing, middleware disabling, or silent claim of clean logs.
- Next functional dependency: versioned API/audit and worker execution (P07/P08), followed by queue/HITL (P09/P10). Hosted-domain wiring and public release remain open.

## P05 resume - real Auth environment

- The prior response failures did not lose f16516a or PR #6. Worktree and remote branch inspected clean.
- CI 35933981080: PostgreSQL and application suites passed; real upstream Auth failed before login because its unqualified identities lookup used public instead of auth. PostgreSQL log showed relation identities does not exist although the upstream migrations created auth tables.
- Correct the disposable database role search_path for this database only. Do not replace upstream Auth with mocks or weaken password/OTP assertions. The existing two real Auth tests remain the gate on the new commit.

- Real GoTrue tests passed after correcting the disposable search path (run 35936172963). A separate macOS test exposed timestamp ties in conversation retrieval: same-millisecond messages were reversed. Added deterministic 120-message regression, observed RED, then ordered by timestamp plus SQLite insertion rowid. No assertion removed from recovery. Cross-database durable ordering is an additional versioned contract, not a claim about UUID chronology.

## P07/P08/P09 - first durable execution slice

Plan: V2 + V2.1; base 13f89db, isolated worktree, no merge/cutover. Preserve the request-bound legacy generation API while the Studio moves to explicit versioned enqueue/observe/cancel operations.

- Ruling: implement the runnable single-node SQLite worker first. Add versioned PostgreSQL schemas/import coverage, but do not claim a distributed PostgreSQL worker or hosted activation until its adapter and identity stores are integrated and tested.
- The canonical run owns state. A control record binds immutable source/context, actor/workspace/session, model connection fingerprint, request/trace IDs, deadline and fencing token. The journal uses per-run sequence IDs, not a globally exposed counter.
- Ruling: migration 6 needs to widen the historical runs CHECK constraint. Rebuild only this table inside a transaction, check all foreign keys before commit, and restore enforcement on every exit. Never edit migrations 1-5. Production upgrade requires a verified P03 backup; tests use synthetic databases only.
- No subscriber owns the worker lifecycle. Disconnect stops observation, not execution. Cancellation is explicit and fenced. Unknown model effects after a crash are interrupted for review, never silently reissued; a persisted complete model result may resume validation without another model call.
- Preflight: P05 actor/session revocation must be revalidated before provider access and candidate consolidation; P03/P04 must copy the new control/journal tables and invalidate pending work after restore/import. Credentials stay outside stored model inputs/events. Queue operation must use the same credential scope as the Studio.

## P07-P09 checkpoint - not accepted

- See docs/durable-runs-status.md for current implementation and exact remaining work.
- Two test-edit operations were refused before execution and not rerouted. The corresponding test files remain unchanged from those refusal points.
- Complete current tests: 184/185 passed; the nested-route discovery gate remains failed. The new browser cases have setup faults and do not yet demonstrate the intended disconnect behavior. UI integration is not delivered.
- The last green published application is 13f89db / PR #6; its real upstream Auth, PostgreSQL, Ubuntu/main, Windows and macOS jobs passed in CI 35937107948.
- No merge, production cutover or inference with a paid/user model. Runtime scripts and new migrations in this worktree are development state and must not be mistaken for the green P05 revision.

## P07-P09 continuation from f6af97c

- Reproduced the nested-route discovery failure. Recursive discovery now includes all existing and v1 handlers and retains every unauthorized-request assertion. Browser fixture encoding and inherited-auth mistakes corrected without relaxing assertions. The real legacy UI still fails the close-tab scenario.
- Browser plugin not available; using the installed Playwright runner. UI direction: preserve warm white/copper surfaces, add a readable event timeline and meaningful no-worker/error states, no fabricated progress percentages.
- Implement client observer and journal first, then connect enqueue and canonical approval/cancel adapters. Repeat full gates and crash/security tests before publishing the delta.

- Connected the Studio to v1 enqueue and a read-only persistent journal; native anonymous tests no longer inherit Playwright credentials. Browser close/reopen proved one synthetic HTTP inference; approval/export timelines update through the same backend journal.
- Added failure-first regressions for mismatched project/run cancellation, immutable admitted data/events, malformed-job quarantine, stale failure writes, queued network-policy revocation, unknown snapshot fields and safe graceful drain. Fixed causes without bypassing checks.
- OS-process proof: forced death after dispatch remains uncertain/no retry; recorded complete output resumes compilation in another process without a second HTTP call. Windows results passed; CI cross-platform/PostgreSQL for the final SHA remain separate until read.
- New migrations SQLite7/PostgreSQL4 enforce immutability. Historical migrations preserved; source import accepts schema7 and invalidates pending executions at destination.
- The known Next aborted-request diagnostics remain. Rechecked upstream PR94658 (open); did not copy its broad ignore-error patch or switch to a custom server that would change optimization/deployment contracts solely to hide logs.

- Clean local verification completed: 203 code/API/integration tests + 8 evidence tests, 30 E2E, lint/types, web and worker build, npm audit. Log bytes/digests checked independently in docs/evidence/p07-p09-local.json. This is the single-node P07/P08/P09 slice; distributed/typed HITL/cost control still require their own completion. Final-head PostgreSQL/portability CI and independent review pending publication.

## P10/P11 continuation from ad758af

- Existing linked worktree confirmed clean. Preserve previous branches and main. No production or paid-provider actions.
- First reproduce the project-settings scope concern and two CodeRabbit review items (restore provenance and worker crash restart); fix with regressions before the next domains.
- Browser plugin not available; use the installed Playwright runner. Preserve current warm light/copper design and explicit error states.
- Planned slice: typed pause/resume controls and finite run budgets, integrated in the existing canonical queue. Generic future tools are not exposed merely by defining approval types.
