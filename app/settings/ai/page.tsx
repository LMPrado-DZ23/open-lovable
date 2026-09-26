"use client";
import AccountBar from '@/components/account/AccountBar';
import {scopedProjectURL} from '@/lib/projects/scope-url';
import ProviderSettingsForm from '@/components/ProviderSettingsForm';
import IntegrationsForm from '@/components/IntegrationsForm';
import ThemeToggle from '@/components/ThemeToggle';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { appConfig } from '@/config/app.config';
import { useModelCatalog } from '@/hooks/useModelCatalog';

type Limits = {requestsLimit?:number;requestsRemaining?:number;tokensLimit?:number;tokensRemaining?:number;resetRequests?:string;resetTokens?:string};
type Probe = {success:boolean; error?:string; model?:string; checkedAt?:string; durationMs?:number; rateLimits?:Limits};
const providerNames:Record<string,string>={openai:'OpenAI',anthropic:'Anthropic',google:'Google Gemini',groq:'Groq',openrouter:'OpenRouter',deepseek:'DeepSeek',mistral:'Mistral',xai:'xAI (Grok)',cerebras:'Cerebras',together:'Together AI',fireworks:'Fireworks AI',huggingface:'Hugging Face'};
const numberFormat=new Intl.NumberFormat('pt-BR');
function tokens(value?:number){return value===undefined?undefined:value>=1000?`${numberFormat.format(Math.round(value/1000))} mil tokens`:`${value} tokens`;}
function LimitsList({limits}:{limits?:Limits}) {
  if(!limits)return null;
  const rows:[string,string|undefined][]=[
    ['Requisições por minuto',limits.requestsLimit===undefined?undefined:`${numberFormat.format(limits.requestsRemaining??limits.requestsLimit)} de ${numberFormat.format(limits.requestsLimit)} restantes`],
    ['Tokens por minuto',limits.tokensLimit===undefined?undefined:`${numberFormat.format(limits.tokensRemaining??limits.tokensLimit)} de ${numberFormat.format(limits.tokensLimit)} restantes`],
    ['Renovação',limits.resetRequests||limits.resetTokens],
  ];
  return <ul className="mt-[8px] space-y-[2px] text-[12px]">{rows.filter(([,value])=>value).map(([label,value])=><li key={label}>{label}: <strong>{value}</strong></li>)}</ul>;
}
export default function AISettingsPage() {
  const {catalog,models,loading,error,reload}=useModelCatalog();
  const [selected,setSelected]=useState(appConfig.ai.defaultModel);
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [probe,setProbe]=useState<Probe|null>(null);
  const active=useRef<AbortController|null>(null);
  useEffect(()=>()=>active.current?.abort(),[]);
  const gateway=catalog?.gateway;
  // Never keep a retired or undiscovered model selected: fall back to the first usable one.
  useEffect(()=>{
    if(loading||!models.length)return;
    if(!models.some(model=>model.id===selected&&model.configured)){
      const usable=models.find(model=>model.configured);
      if(usable)setSelected(usable.id);
    }
  },[loading,models,selected]);
  const providerStatus=Object.entries(catalog?.providers??{});
  async function testModel() {
    if (!consent || busy) return;
    const controller=new AbortController();active.current=controller;
    setBusy(true);setProbe(null);
    try {
      const response=await fetch(scopedProjectURL('/api/ai-model-test'),{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({model:selected,confirmTokenUse:true})});
      const result=await response.json() as Probe;
      if(!controller.signal.aborted) setProbe(result);
    } catch {
      if(!controller.signal.aborted) setProbe({success:false,error:'Não foi possível concluir o teste. Nenhum outro provedor foi selecionado.'});
    } finally {if(!controller.signal.aborted) setBusy(false);}
  }
  const canTest=consent && !busy && !loading && models.some(model=>model.id===selected && model.configured);
  return <main className="min-h-screen bg-[#f7f7f5] text-[#232323]">
    <AccountBar workspaceId={catalog?.workspaceId}/>
    <div className="mx-auto max-w-[1100px] px-[20px] py-[32px] md:px-[32px]">
      <header className="mb-[32px] flex flex-wrap items-center justify-between gap-[16px] border-b border-[#deded9] pb-[20px]">
        <Link href="/" className="text-[15px] font-semibold">Open Lovable <span className="ml-[12px] font-normal text-[#686862]">Voltar ao construtor</span></Link>
        <div className="flex items-center gap-[8px]"><ThemeToggle/><button type="button" onClick={()=>void reload()} disabled={loading || busy} className="rounded-md border border-[#d2d2cc] bg-white px-[16px] py-[10px] text-[13px] disabled:opacity-50">{loading ? 'Consultando...' : 'Atualizar catálogo'}</button></div>
      </header>
      <div className="mb-[28px] max-w-[740px]">
        <p className="mb-[8px] text-[12px] font-semibold uppercase tracking-[0.12em] text-[#7b4c28]">Configurações / Inteligência artificial</p>
        <h1 className="mb-[12px] text-[32px] font-semibold leading-tight">Conexões de IA</h1>
        <p className="text-[15px] leading-relaxed text-[#65655e]">Escolha o modelo que executa seu trabalho. Credencial configurada e catálogo disponível não significam geração validada: confirme com um teste explícito.</p>
      </div>
      {error && <p role="alert" className="mb-[20px] rounded-md border border-red-200 bg-red-50 p-[16px] text-[14px]">{error}</p>}
      <ProviderSettingsForm onSaved={()=>void reload()}/>
      {catalog?.profile!=='supabase'&&<IntegrationsForm/>}
      <div className="grid items-start gap-[24px] md:grid-cols-2">
        <section className="rounded-lg border border-[#deded9] bg-white p-[24px]" aria-labelledby="gateway-heading">
          <h2 id="gateway-heading" className="mb-[14px] text-[19px] font-semibold">IA local (Ollama / LM Studio)</h2>
          {gateway?.detected&&<p role="status" className="mb-[16px] rounded-md border border-green-200 bg-green-50 p-[12px] text-[13px] text-green-900"><strong>{gateway.detected} detectado neste computador.</strong> Os modelos locais já aparecem na lista, sem custo e sem chave.</p>}
          {!loading&&gateway?.status==='not-configured'&&<p className="mb-[16px] rounded-md bg-[#f5f5f2] p-[12px] text-[13px]">Nenhuma IA local encontrada. Abra o Ollama ou o LM Studio neste computador e clique em "Atualizar catálogo".</p>}
          <p className="mb-[16px] text-[14px] leading-relaxed text-[#65655e]">Conexão opcional pelo protocolo Chat Completions. Os modelos locais e remotos do gateway mantem seus identificadores completos.</p>
          <dl className="space-y-[12px] text-[14px]">
            <div><dt className="text-[#77776e]">Estado da configuração</dt><dd className="font-medium">{loading ? 'Consultando' : gateway?.status==='not-configured' ? 'Não configurada' : gateway?.status==='unavailable' ? 'Indisponível' : gateway?.status==='discovered' ? 'Catálogo consultado' : 'Modelos declarados no servidor'}</dd></div>
            <div><dt className="text-[#77776e]">Endpoint</dt><dd className="break-all font-mono text-[12px]">{gateway?.endpoint ?? 'Nenhum endpoint configurado'}</dd></div>
            <div><dt className="text-[#77776e]">Credencial no servidor</dt><dd>{gateway?.credentialConfigured ? 'Configurada; valor não exibido' : 'Não configurada'}</dd></div>
          </dl>
          {gateway?.error && <p role="alert" className="mt-[16px] break-words text-[13px] text-red-700">{gateway.error}</p>}
          {catalog?.profile==='supabase'?<p className="mt-[24px] border-t border-[#ededE8] pt-[16px] text-[12px] leading-relaxed text-[#686862]">As conexões pertencem ao workspace indicado acima. Credenciais globais do operador não são herdadas. Um endpoint local só pode ser usado quando a instalação permite explicitamente.</p>:
          <div className="mt-[24px] border-t border-[#ededE8] pt-[16px] text-[12px] leading-relaxed text-[#686862]">
            <p className="mb-[8px] font-medium">Configuração no ambiente do servidor</p>
            <code className="block break-all">OPEN_LOVABLE_GATEWAY_URL</code><code className="block break-all">OPEN_LOVABLE_GATEWAY_API_KEY</code><code className="block break-all">OPEN_LOVABLE_GATEWAY_MODELS</code>
            <p className="mt-[12px]">Use o formulario acima para salvar uma conexao cifrada, ou configure as variaveis no servidor. Consulte docs/classe-a-plus-integration.md. Um endpoint local pode encaminhar modelos para a nuvem; a interface não o rotula como inferência privada.</p>
          </div>}
        </section>
        <section className="rounded-lg border border-[#deded9] bg-white p-[24px]" aria-labelledby="test-heading">
          <h2 id="test-heading" className="mb-[14px] text-[19px] font-semibold">Testar o modelo selecionado</h2>
          <p className="mb-[20px] text-[14px] leading-relaxed text-[#65655e]">Envia uma mensagem curta ao modelo exato. Não troca de provedor em caso de falha e não testa ferramentas, imagens ou publicação.</p>
          <label htmlFor="probe-model" className="mb-[8px] block text-[13px] font-medium">Modelo para o teste</label>
          <select id="probe-model" value={selected} onChange={event=>{setSelected(event.target.value);setProbe(null);}} disabled={busy || loading}
            className="mb-[20px] w-full min-w-0 rounded-md border border-[#cfcfc8] bg-white px-[12px] py-[12px] text-[13px]">
            {models.map(model=><option key={model.id} value={model.id}>{model.label}{!model.configured ? ' - configurar' : ''}</option>)}
          </select>
          <label className="mb-[20px] flex items-start gap-[10px] text-[13px] leading-relaxed">
            <input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} disabled={busy} className="mt-[3px] h-[16px] w-[16px] shrink-0" />
            <span>Entendo que este teste pode consumir tokens e gerar cobrança no provedor configurado.</span>
          </label>
          <button type="button" onClick={()=>void testModel()} disabled={!canTest} className="w-full rounded-md bg-[#252520] px-[18px] py-[13px] text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Testando modelo...' : 'Testar texto e streaming'}</button>
          {!loading && !models.some(model=>model.configured) && <p className="mt-[12px] text-[13px] text-[#77776e]">Configure ao menos uma conexão para executar o teste.</p>}
          {probe && <div role={probe.success ? 'status' : 'alert'} className={`mt-[20px] rounded-md border p-[16px] text-[13px] leading-relaxed ${probe.success ? 'border-green-200 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
            {probe.success ? <><strong>Texto e streaming responderam ao teste.</strong><p className="break-all">Modelo: {probe.model}</p><p>Duração: {probe.durationMs} ms</p><p>Verificado em: {probe.checkedAt}</p>{probe.rateLimits?<><p className="mt-[8px] font-medium">Limite de uso informado pelo provedor</p><LimitsList limits={probe.rateLimits}/></>:<p className="mt-[8px]">O provedor não informa o limite de uso restante pela API. Consulte o painel da sua conta no provedor.</p>}</> : probe.error}
          </div>}
        </section>
      </div>
      {providerStatus.length>0&&<section className="mt-[24px] rounded-lg border border-[#deded9] bg-white p-[24px]" aria-labelledby="discovery-heading">
        <h2 id="discovery-heading" className="mb-[6px] text-[19px] font-semibold">Modelos detectados pela sua chave</h2>
        <p className="mb-[16px] text-[14px] leading-relaxed text-[#65655e]">Ao salvar uma chave, o app pergunta ao próprio provedor quais modelos ela pode usar. Modelos desativados somem da lista automaticamente.</p>
        <div className="grid gap-[12px] md:grid-cols-2">{providerStatus.map(([provider,status])=><div key={provider} className={`rounded-md border p-[14px] text-[13px] ${status?.status==='unavailable'?'border-red-200 bg-red-50 text-red-900':'border-[#e4e4de] bg-[#fafaf8]'}`}>
          <p className="font-semibold">{providerNames[provider]??provider}</p>
          {status?.status==='discovered'&&<p>{status.modelCount} modelo(s) de texto disponíveis para a chave.</p>}
          {status?.status==='pinned'&&<p>{status.modelCount} modelo(s) fixados manualmente no campo "IDs dos modelos".</p>}
          {status?.status==='unavailable'&&<p>{status.error??'Não foi possível consultar os modelos.'}</p>}
          <LimitsList limits={status?.rateLimits}/>
          {status?.status==='discovered'&&!status.rateLimits&&<p className="mt-[6px] text-[12px] text-[#686862]">Limite de uso restante: o provedor só informa ao executar um teste abaixo{provider==='google'?'; o Google não informa a cota pela API (veja no Google AI Studio)':''}.</p>}
        </div>)}</div>
      </section>}
      <section className="mt-[24px] overflow-hidden rounded-lg border border-[#deded9] bg-white" aria-labelledby="catalog-heading">
        <h2 id="catalog-heading" className="border-b border-[#ededE8] px-[24px] py-[20px] text-[19px] font-semibold">Catálogo do servidor</h2>
        <div className="divide-y divide-[#ededE8]">{models.map(model=><div key={model.id} className="flex flex-wrap items-center justify-between gap-[12px] px-[24px] py-[16px]"><div className="min-w-0"><p className="text-[14px] font-medium">{model.label}</p><code className="break-all text-[12px] text-[#77776e]">{model.id}</code>{('inputTokenLimit' in model&&model.inputTokenLimit)?<p className="text-[12px] text-[#77776e]">Contexto: {tokens(model.inputTokenLimit as number)}{'outputTokenLimit' in model&&model.outputTokenLimit?` · resposta até ${tokens(model.outputTokenLimit as number)}`:''}</p>:null}</div><span className="text-[12px] text-[#686862]">{loading ? 'Consultando' : model.configured ? 'Configurado; teste necessário' : 'Credencial ausente'}</span></div>)}</div>
      </section>
    </div>
  </main>;
}
