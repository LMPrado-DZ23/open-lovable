"use client";
import {useEffect, useState} from 'react';
import Link from 'next/link';
import AppShell from '@/components/shell/AppShell';
import IntegrationsForm from '@/components/IntegrationsForm';
import {useModelCatalog} from '@/hooks/useModelCatalog';

type Status = {integrations: Array<{integration: string; configured: boolean}>; services: {firecrawl: boolean; sandbox: boolean; sandboxProvider: string} | null};
type Card = {name: string; initials: string; color: string; description: string; connected: boolean | null; action: {label: string; href: string}};

/** Lovable-style integrations hub: every connection the builder uses, with its state and where to set it up. */
export default function IntegrationsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const {catalog, loading} = useModelCatalog();
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/integrations', {cache: 'no-store', signal: controller.signal}).then(async response => { const data = await response.json(); if (response.ok && !controller.signal.aborted) setStatus(data); }).catch(() => {});
    return () => controller.abort();
  }, []);
  const token = (id: string) => status ? status.integrations.some(item => item.integration === id && item.configured) : null;
  const aiProviders = Object.values(catalog?.providers ?? {}).filter(provider => provider?.status === 'discovered' || provider?.status === 'pinned').length + (catalog?.gateway?.configured ? 1 : 0);

  const cards: Card[] = [
    {name: 'Modelos de IA', initials: 'IA', color: 'from-[#ff9a3c] to-[#e2456f]', description: catalog?.gateway?.detected ? `${aiProviders} conexão(ões) ativa(s), incluindo ${catalog.gateway.detected} neste computador.` : `${aiProviders} conexão(ões) ativa(s): OpenAI, Anthropic, Gemini, Groq, OpenRouter, DeepSeek e outros.`, connected: loading ? null : aiProviders > 0, action: {label: 'Gerenciar', href: '/settings/ai'}},
    {name: 'Supabase', initials: 'SB', color: 'from-[#3ecf8e] to-[#1f9d63]', description: 'Login de usuários e banco de dados para os apps. Conecte em cada projeto, na aba Supabase.', connected: token('supabase'), action: {label: 'Configurar token', href: '#integracoes'}},
    {name: 'GitHub', initials: 'GH', color: 'from-[#3b3b45] to-[#111116]', description: 'Envie o código de um projeto para um repositório seu.', connected: token('github'), action: {label: 'Configurar token', href: '#integracoes'}},
    {name: 'Vercel', initials: 'V', color: 'from-[#2b2b2b] to-[#000]', description: 'Publique na internet com endereço público e domínio próprio.', connected: token('vercel'), action: {label: 'Configurar token', href: '#integracoes'}},
    {name: 'Firecrawl', initials: 'FC', color: 'from-[#ff7a1a] to-[#f24e1e]', description: 'Lê sites para clonar ou usar como referência ("Importar um site").', connected: status?.services ? status.services.firecrawl : null, action: {label: 'Como configurar', href: '#servidor'}},
    {name: status?.services?.sandboxProvider ?? 'Sandbox', initials: 'SX', color: 'from-[#6d5dfc] to-[#3a2fd6]', description: 'Ambiente onde os sites importados rodam ao vivo.', connected: status?.services ? status.services.sandbox : null, action: {label: 'Como configurar', href: '#servidor'}},
  ];

  return <AppShell>
    <main className="mx-auto max-w-[1100px] px-[16px] py-[28px] md:px-[32px]">
      <h1 className="text-[30px] font-semibold tracking-tight">Integrações</h1>
      <p className="mt-[8px] max-w-[680px] text-[15px] leading-relaxed text-[#5f5c68]">Conecte os serviços que o Open Lovable usa para gerar, publicar e dar backend aos seus apps.</p>
      <ul className="mt-[24px] grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3">{cards.map(card => <li key={card.name} className="flex flex-col rounded-[16px] border border-[#ece7e2] bg-white p-[18px]">
        <div className="flex items-center gap-[12px]"><span aria-hidden="true" className={`flex h-[40px] w-[40px] items-center justify-center rounded-[10px] bg-gradient-to-br text-[13px] font-bold text-white ${card.color}`}>{card.initials}</span>
          <div className="min-w-0"><h2 className="text-[16px] font-semibold">{card.name}</h2><p className={`text-[12px] font-medium ${card.connected ? 'text-green-700' : card.connected === false ? 'text-[#a15c14]' : 'text-[#8a8792]'}`}>{card.connected === null ? 'Verificando…' : card.connected ? 'Conectado' : 'Não conectado'}</p></div></div>
        <p className="mt-[12px] flex-1 text-[13px] leading-relaxed text-[#5f5c68]">{card.description}</p>
        <Link href={card.action.href} className="mt-[14px] self-start rounded-[10px] border border-[#e3ded8] px-[12px] py-[7px] text-[13px] hover:bg-[#f7f4f1]">{card.action.label}</Link>
      </li>)}</ul>
      <IntegrationsForm/>
      <section id="servidor" className="mt-[24px] rounded-lg border border-[#deded9] bg-white p-[24px]">
        <h2 className="text-[19px] font-semibold">Serviços do servidor</h2>
        <p className="mt-[6px] text-[14px] leading-relaxed text-[#65655e]">Firecrawl e o sandbox são configurados no arquivo <code>.env.local</code> da instalação (<code>FIRECRAWL_API_KEY</code>, <code>SANDBOX_PROVIDER</code> e <code>E2B_API_KEY</code>). Depois de editar, reinicie o app.</p>
      </section>
    </main>
  </AppShell>;
}
