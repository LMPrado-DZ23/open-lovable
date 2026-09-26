"use client";
import {useCallback, useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {projectRequest} from '@/lib/projects/client';
import type {Connector} from '@/lib/connectors/catalog';

type State = {catalog: Connector[]; state: {enabled: string[]; publicValues: Record<string, Record<string, string>>}; secrets: Record<string, boolean>; backend: boolean; tokenConfigured: boolean};

/** Lovable's per-project connectors: pick services, fill public values, and use workspace secrets through Supabase. */
export default function ConnectorsPanel({projectId, version, locked, onSaved, onAsk}: {projectId: string; version: number; locked: boolean; onSaved: () => Promise<unknown>; onAsk?: (request: string) => void}) {
  const [data, setData] = useState<State | null>(null);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/projects?' + new URLSearchParams({id: projectId, action: 'connectors'}), {cache: 'no-store', signal});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Não foi possível ler os conectores.');
    if (signal?.aborted) return;
    setData(body); setEnabled(body.state.enabled); setValues(body.state.publicValues);
  }, [projectId]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal).catch(caught => { if (!controller.signal.aborted) setError(caught.message); }); return () => controller.abort(); }, [load, version]);

  const categories = useMemo(() => ['Todos', 'Ativos', ...new Set((data?.catalog ?? []).map(item => item.category))], [data]);
  const shown = (data?.catalog ?? []).filter(item => (category === 'Todos' || (category === 'Ativos' ? enabled.includes(item.id) : item.category === category))
    && (!query.trim() || `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase())));
  const dirty = data ? JSON.stringify([enabled.slice().sort(), values]) !== JSON.stringify([data.state.enabled.slice().sort(), data.state.publicValues]) : false;
  const secretEnabled = enabled.filter(id => data?.catalog.find(item => item.id === id)?.kind === 'secret');

  function toggle(id: string) { setEnabled(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }
  async function save() {
    setBusy('save'); setError(''); setMessage('');
    try {
      await projectRequest({action: 'connectorsSave', id: projectId, version, enabled, publicValues: values});
      await onSaved(); await load();
      setMessage('Conectores salvos. O arquivo src/lib/connectors.js foi atualizado como nova revisão e a IA já sabe usá-los.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar.'); }
    finally { setBusy(''); }
  }
  async function push() {
    setBusy('push'); setError(''); setMessage('');
    try {
      const result = await projectRequest<{pushed: string[]}>({action: 'connectorSecretsPush', id: projectId});
      setMessage(result.pushed.length ? `Chaves enviadas ao Supabase: ${result.pushed.join(', ')}.` : 'Nenhum conector secreto ativo para enviar.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível enviar as chaves.'); }
    finally { setBusy(''); }
  }

  const field = 'w-full rounded-md border border-[#cecec2] bg-white px-[10px] py-[8px] text-[13px]';
  return <div className="min-h-[430px] p-[22px]">
    <div className="flex flex-wrap items-start justify-between gap-[12px]">
      <div><h2 className="text-[17px] font-semibold">Conectores</h2>
        <p className="mt-[6px] max-w-[720px] text-[13px] leading-relaxed text-[#727266]">Ative os serviços que este app vai usar (pagamentos, e-mail, WhatsApp, mapas, IA…). Depois peça no chat, por exemplo: &quot;adicione um botão de pagamento com Mercado Pago&quot;.</p></div>
      <div className="flex gap-[8px]">
        {secretEnabled.length > 0 && <button type="button" onClick={() => void push()} disabled={locked || Boolean(busy) || !data?.backend || !data?.tokenConfigured} title={!data?.backend ? 'Conecte o Supabase primeiro' : !data?.tokenConfigured ? 'Salve o token do Supabase em Integrações' : undefined} className="rounded-md border border-[#d2d2c8] px-[12px] py-[9px] text-[12px] disabled:opacity-40">{busy === 'push' ? 'Enviando…' : 'Enviar chaves ao Supabase'}</button>}
        <button type="button" onClick={() => void save()} disabled={locked || Boolean(busy) || !dirty} className="rounded-md bg-[#272721] px-[16px] py-[9px] text-[12px] font-medium text-white disabled:opacity-40">{busy === 'save' ? 'Salvando…' : 'Salvar conectores'}</button>
      </div>
    </div>
    {error && <p role="alert" className="mt-[12px] rounded-md border border-red-200 bg-red-50 p-[12px] text-[13px] text-red-800">{error}</p>}
    {message && <p role="status" className="mt-[12px] rounded-md border border-green-200 bg-green-50 p-[12px] text-[13px] text-green-900">{message}</p>}
    {secretEnabled.length > 0 && !data?.backend && <p className="mt-[12px] rounded-md border border-amber-200 bg-amber-50 p-[12px] text-[13px] text-amber-900">Conectores com chave secreta funcionam por uma função do Supabase. Conecte o Supabase na aba Supabase deste projeto.</p>}

    <div className="mt-[16px] flex flex-wrap items-center gap-[8px]">
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar conector" aria-label="Buscar conector" className="w-[220px] rounded-md border border-[#cecec2] bg-white px-[10px] py-[7px] text-[13px]"/>
      <div role="tablist" aria-label="Categorias de conectores" className="flex flex-wrap gap-[6px]">{categories.map(name => <button key={name} type="button" role="tab" aria-selected={category === name} onClick={() => setCategory(name)} className={`rounded-full px-[12px] py-[6px] text-[12px] ${category === name ? 'bg-[#272721] text-white' : 'border border-[#e0e0d6] bg-white'}`}>{name}{name === 'Ativos' ? ` (${enabled.length})` : ''}</button>)}</div>
    </div>

    {!data ? <p role="status" className="mt-[20px] text-[13px] text-[#727266]">Carregando…</p>
      : <ul className="mt-[16px] grid gap-[12px] lg:grid-cols-2">{shown.map(item => {
        const on = enabled.includes(item.id);
        return <li key={item.id} className={`rounded-[12px] border p-[14px] ${on ? 'border-[#272721] bg-white' : 'border-[#e3e3d9] bg-[#fdfdfa]'}`}>
          <div className="flex items-start justify-between gap-[10px]">
            <div className="min-w-0"><p className="text-[14px] font-semibold">{item.name}</p><p className="mt-[2px] text-[12px] text-[#727266]">{item.description}</p>
              <p className="mt-[4px] text-[11px] text-[#8a8a7e]">{item.category} · {item.kind === 'public' ? 'Chave pública (vai no site)' : 'Chave secreta (fica no servidor)'}</p></div>
            <label className="flex shrink-0 items-center gap-[6px] text-[12px]"><input type="checkbox" checked={on} disabled={locked} onChange={() => toggle(item.id)}/>{on ? 'Ativo' : 'Ativar'}</label>
          </div>
          {on && item.kind === 'public' && item.fields.length > 0 && <div className="mt-[10px] grid gap-[8px]">{item.fields.map(entry => <div key={entry.key}>
            <label htmlFor={`${item.id}-${entry.key}`} className="mb-[3px] block text-[11px] font-medium">{entry.label}</label>
            <input id={`${item.id}-${entry.key}`} value={values[item.id]?.[entry.key] ?? ''} placeholder={entry.placeholder} spellCheck={false} autoComplete="off" disabled={locked} onChange={event => setValues(current => ({...current, [item.id]: {...current[item.id], [entry.key]: event.target.value}}))} className={field}/>
          </div>)}</div>}
          {on && item.kind === 'secret' && <p className={`mt-[10px] text-[12px] ${data.secrets[item.id] ? 'text-green-800' : 'text-amber-800'}`}>{data.secrets[item.id] ? 'Chave salva nas Configurações do workspace.' : <>Chave ainda não salva. <Link href="/settings/connectors" className="underline">Salvar em Configurações → Conectores</Link>.</>}</p>}
          <div className="mt-[10px] flex flex-wrap gap-[12px] text-[12px]">
            <a href={item.keysUrl} target="_blank" rel="noreferrer" className="underline">Onde pegar a chave</a>
            {on && onAsk && <button type="button" onClick={() => onAsk(`Use o conector ${item.name} neste app: ${item.description.toLowerCase()} Crie a interface e a integração completa.`)} className="underline">Pedir à IA para usar</button>}
          </div>
        </li>;
      })}</ul>}
  </div>;
}
