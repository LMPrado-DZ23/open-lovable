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
