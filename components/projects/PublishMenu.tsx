"use client";
import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {projectRequest} from '@/lib/projects/client';

type Integration = {integration: 'vercel' | 'github' | 'supabase'; configured: boolean};
type Publication = {url: string; publicUrl?: string; version: number; publishedAt: string};

/** Lovable-style Publish: a local link, the internet (Vercel) and GitHub, from one menu. */
export default function PublishMenu({projectId, projectName, disabled}: {projectId: string; projectName: string; disabled: boolean}) {
  const [open, setOpen] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [publication, setPublication] = useState<Publication | null>(null);
  const [github, setGithub] = useState<{url: string; created: boolean} | null>(null);
  const [repository, setRepository] = useState(projectName);
  const [privateRepo, setPrivateRepo] = useState(true);
  const [domain, setDomain] = useState('');
  const [domainSetup, setDomainSetup] = useState<{domain: string; verified: boolean; records: Array<{type: string; name: string; value: string}>} | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch('/api/integrations', {cache: 'no-store', signal: controller.signal})
      .then(async response => { const data = await response.json(); if (response.ok && !controller.signal.aborted) setIntegrations(data.integrations); })
      .catch(() => {});
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { controller.abort(); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const configured = (id: Integration['integration']) => integrations.some(item => item.integration === id && item.configured);

  async function publish(target: 'local' | 'vercel') {
    setBusy(target); setError('');
    try {
      const {publication: result} = await projectRequest<{publication: Publication}>({action: 'publish', id: projectId, target});
      setPublication(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível publicar.'); }
    finally { setBusy(''); }
  }

  async function connectDomain() {
    setBusy('domain'); setError('');
    try {
      const {domain: result} = await projectRequest<{domain: NonNullable<typeof domainSetup>}>({action: 'domain', id: projectId, domain});
      setDomainSetup(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível conectar o domínio.'); }
    finally { setBusy(''); }
  }

  async function sendToGitHub() {
    setBusy('github'); setError('');
    try {
      const {github: result} = await projectRequest<{github: {url: string; created: boolean}}>({action: 'github', id: projectId, repository, private: privateRepo});
      setGithub(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível enviar ao GitHub.'); }
    finally { setBusy(''); }
  }

  const button = 'w-full rounded-md bg-[#272721] px-[14px] py-[10px] text-[13px] font-medium text-white disabled:opacity-40';
  return <div className="relative">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-haspopup="dialog" disabled={disabled}
      className="rounded-md bg-[#a6471f] px-[16px] py-[10px] text-[12px] font-semibold text-white disabled:opacity-40">Publicar</button>
    {open && <div ref={panel} role="dialog" aria-label="Publicar projeto" className="absolute right-0 z-30 mt-[8px] w-[min(92vw,380px)] rounded-lg border border-[#dcdcd2] bg-white p-[18px] text-left shadow-[0_16px_40px_rgba(0,0,0,0.14)]">
      <div className="mb-[12px] flex items-center justify-between"><h2 className="text-[15px] font-semibold">Publicar</h2><button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-[18px] leading-none">×</button></div>
      {error && <p role="alert" className="mb-[12px] rounded-md border border-red-200 bg-red-50 p-[10px] text-[12px] text-red-800">{error}</p>}

      <section className="border-b border-[#ecece4] pb-[14px]">
        <h3 className="text-[13px] font-medium">Site no seu computador</h3>
        <p className="mb-[10px] mt-[4px] text-[12px] text-[#6f6f66]">Gera a versão final da revisão salva e abre em uma página própria.</p>
        <button type="button" disabled={Boolean(busy)} onClick={() => void publish('local')} className={button}>{busy === 'local' ? 'Publicando…' : 'Gerar site'}</button>
      </section>

      <section className="border-b border-[#ecece4] py-[14px]">
        <h3 className="text-[13px] font-medium">Na internet (Vercel)</h3>
        {configured('vercel')
          ? <><p className="mb-[10px] mt-[4px] text-[12px] text-[#6f6f66]">Publica um endereço público https://… na sua conta da Vercel.</p><button type="button" disabled={Boolean(busy)} onClick={() => void publish('vercel')} className={button}>{busy === 'vercel' ? 'Publicando na Vercel…' : 'Publicar na internet'}</button>
            <label htmlFor="custom-domain" className="mb-[4px] mt-[12px] block text-[12px]">Domínio próprio (opcional)</label>
            <div className="flex gap-[6px]"><input id="custom-domain" value={domain} onChange={event => setDomain(event.target.value)} placeholder="meusite.com.br" maxLength={253} className="min-w-0 flex-1 rounded-md border border-[#d2d2c8] px-[10px] py-[8px] text-[13px]"/><button type="button" disabled={Boolean(busy) || !domain.trim()} onClick={() => void connectDomain()} className="rounded-md border border-[#d2d2c8] px-[10px] text-[12px] disabled:opacity-40">{busy === 'domain' ? '…' : 'Conectar'}</button></div>
            {domainSetup && <div role="status" className="mt-[10px] rounded-md border border-[#e3e3d9] bg-[#fafaf6] p-[10px] text-[12px]">
              <p className="font-medium">{domainSetup.verified ? `${domainSetup.domain} já está verificado.` : `Crie no seu provedor de domínio (Registro.br, GoDaddy…):`}</p>
              {!domainSetup.verified && <table className="mt-[6px] w-full text-left"><thead><tr><th>Tipo</th><th>Nome</th><th>Valor</th></tr></thead><tbody>{domainSetup.records.map(record => <tr key={record.type + record.name}><td className="pr-[6px]">{record.type}</td><td className="break-all pr-[6px]"><code>{record.name}</code></td><td className="break-all"><code>{record.value}</code></td></tr>)}</tbody></table>}
              <p className="mt-[6px] text-[#6f6f66]">A propagação do DNS pode levar de minutos a algumas horas.</p>
            </div>}</>
          : <p className="mt-[4px] text-[12px] text-[#6f6f66]">Salve um token da Vercel em <Link href="/settings/ai#integracoes" className="underline">Integrações</Link> para publicar com um endereço público.</p>}
      </section>

      {publication && <div role="status" className="mt-[14px] rounded-md border border-green-200 bg-green-50 p-[12px] text-[12px] text-green-900">
        <p className="font-medium">Revisão {publication.version} publicada.</p>
        <p className="mt-[6px]"><a href={publication.url} target="_blank" rel="noreferrer" className="underline">Abrir site no computador</a></p>
        {publication.publicUrl && <p className="mt-[4px] break-all"><a href={publication.publicUrl} target="_blank" rel="noreferrer" className="underline">{publication.publicUrl}</a></p>}
      </div>}

      <section className="pt-[14px]">
        <h3 className="text-[13px] font-medium">GitHub</h3>
        {configured('github') ? <>
          <label htmlFor="github-repository" className="mb-[4px] mt-[8px] block text-[12px]">Nome do repositório</label>
          <input id="github-repository" value={repository} onChange={event => setRepository(event.target.value)} maxLength={100} className="mb-[8px] w-full rounded-md border border-[#d2d2c8] px-[10px] py-[8px] text-[13px]"/>
          <label className="mb-[10px] flex items-center gap-[8px] text-[12px]"><input type="checkbox" checked={privateRepo} onChange={event => setPrivateRepo(event.target.checked)}/>Repositório privado</label>
          <button type="button" disabled={Boolean(busy) || !repository.trim()} onClick={() => void sendToGitHub()} className={button}>{busy === 'github' ? 'Enviando…' : 'Enviar para o GitHub'}</button>
          {github && <p role="status" className="mt-[10px] break-all text-[12px] text-green-900">{github.created ? 'Repositório criado' : 'Repositório atualizado'}: <a href={github.url} target="_blank" rel="noreferrer" className="underline">{github.url}</a></p>}
        </> : <p className="mt-[4px] text-[12px] text-[#6f6f66]">Salve um token do GitHub em <Link href="/settings/ai#integracoes" className="underline">Integrações</Link> para enviar o código a um repositório.</p>}
      </section>
    </div>}
  </div>;
}
