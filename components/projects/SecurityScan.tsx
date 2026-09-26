"use client";
import {useState} from 'react';
import {projectRequest} from '@/lib/projects/client';
import type {ScanFinding, Severity} from '@/lib/security/app-scan';

type Scan = {findings: ScanFinding[]; filesScanned: number; summary: Record<Severity, number>};
const tone: Record<Severity, string> = {alta: 'border-red-200 bg-red-50 text-red-900', 'média': 'border-amber-200 bg-amber-50 text-amber-900', baixa: 'border-[#e3e3d9] bg-[#fafaf6] text-[#4f4f47]'};

/** Lovable-style security review of the saved revision, with a one-click "fix" request per finding. */
export default function SecurityScan({projectId, version, onFix}: {projectId: string; version: number; onFix?: (request: string) => void}) {
  const [scan, setScan] = useState<Scan | null>(null);
  const [scannedVersion, setScannedVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    setBusy(true); setError('');
    try { const result = await projectRequest<{scan: Scan}>({action: 'scan', id: projectId}); setScan(result.scan); setScannedVersion(version); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível verificar o projeto.'); }
    finally { setBusy(false); }
  }
  return <div className="min-h-[430px] p-[22px]">
    <h2 className="text-[17px] font-semibold">Verificação de segurança</h2>
    <p className="mb-[16px] mt-[8px] max-w-[680px] text-[13px] leading-relaxed text-[#727266]">Procura no código da revisão salva por segredos expostos, execução de texto como código, HTML injetado, links inseguros e credenciais no navegador. É uma análise automática: ela aponta o que revisar, não garante que o app é seguro.</p>
    <button type="button" onClick={() => void run()} disabled={busy} className="rounded-md bg-[#272721] px-[16px] py-[10px] text-[12px] font-medium text-white disabled:opacity-40">{busy ? 'Verificando…' : scan ? 'Verificar novamente' : 'Verificar segurança'}</button>
    {error && <p role="alert" className="mt-[14px] rounded-md border border-red-200 bg-red-50 p-[12px] text-[13px] text-red-800">{error}</p>}
    {scan && <div className="mt-[20px]">
      <p role="status" className="text-[13px]">Revisão {scannedVersion}: {scan.filesScanned} arquivo(s) analisado(s) · <strong>{scan.summary.alta}</strong> alta · <strong>{scan.summary['média']}</strong> média · <strong>{scan.summary.baixa}</strong> baixa{scannedVersion !== version ? ' (o projeto mudou desde esta verificação)' : ''}</p>
      {scan.findings.length === 0
        ? <p className="mt-[14px] rounded-md border border-green-200 bg-green-50 p-[12px] text-[13px] text-green-900">Nenhum problema encontrado pelas regras automáticas.</p>
        : <ul className="mt-[14px] space-y-[10px]">{scan.findings.map(finding => <li key={`${finding.rule}:${finding.file}:${finding.line}`} className={`rounded-md border p-[12px] text-[13px] ${tone[finding.severity]}`}>
          <p><strong className="uppercase">{finding.severity}</strong> · <code className="break-all">{finding.file}:{finding.line}</code></p>
          <p className="mt-[4px]">{finding.message}</p>
          <p className="mt-[4px] text-[12px] opacity-80">Como corrigir: {finding.fix}</p>
          {onFix && <button type="button" onClick={() => onFix(`Corrija este problema de segurança sem remover funcionalidades.\nArquivo: ${finding.file} (linha ${finding.line})\nProblema: ${finding.message}\nOrientação: ${finding.fix}`)} className="mt-[8px] text-[12px] font-medium underline">Pedir correção à IA</button>}
        </li>)}</ul>}
    </div>}
  </div>;
}
