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
