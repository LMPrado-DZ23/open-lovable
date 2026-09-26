"use client";
import {useEffect, useMemo, useState} from 'react';
import SettingsLayout, {Card} from '@/components/settings/SettingsLayout';
import type {Connector} from '@/lib/connectors/catalog';

type Data = {catalog: Connector[]; secrets: Record<string, boolean>; manage: boolean};

/** Workspace-wide secret keys for connectors. Values are sent once, stored encrypted and never shown again. */
export default function ConnectorsSettingsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/projects?action=connectors', {cache: 'no-store', signal: controller.signal}).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Não foi possível carregar os conectores.'); setData(body);
    }).catch(caught => { if (!controller.signal.aborted) setError(caught.message); });
    return () => controller.abort();
  }, []);
  const categories = useMemo(() => ['Todos', 'Com chave salva', ...new Set((data?.catalog ?? []).map(item => item.category))], [data]);
  const shown = (data?.catalog ?? []).filter(item => (category === 'Todos' || (category === 'Com chave salva' ? data?.secrets[item.id] : item.category === category))
    && (!query.trim() || `${item.name} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())));

  async function save(item: Connector, remove = false) {
    if (remove && !window.confirm(`Apagar a chave de ${item.name}? Os apps que usam este conector deixam de funcionar até salvar outra.`)) return;
    setBusy(item.id); setError(''); setMessage('');
    try {
      const response = await fetch('/api/connectors', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({connector: item.id, values: remove ? null : form})});
      const result = await response.json() as {secrets: Record<string, boolean>; error?: string};
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.');
      setData(current => current && {...current, secrets: result.secrets}); setForm({}); setOpen('');
      setMessage(remove ? `Chave de ${item.name} apagada.` : `Chave de ${item.name} salva com criptografia. Ela não aparece de novo por segurança.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar.'); }
    finally { setBusy(''); }
  }

  const field = 'w-full rounded-md border border-[#d9d4ce] bg-white px-[10px] py-[8px] text-[13px]';
  return <SettingsLayout title="Conectores" description="Serviços que seus apps podem usar: pagamentos, e-mail, WhatsApp, mapas, IA e mais. Chaves secretas ficam guardadas aqui, criptografadas, e vão para o Supabase de cada app só quando você mandar. Chaves públicas são preenchidas em cada projeto, na aba Conectores.">
    {error && <p role="alert" className="mb-[12px] rounded-md border border-red-200 bg-red-50 p-[12px] text-[13px] text-red-800">{error}</p>}
    {message && <p role="status" className="mb-[12px] rounded-md border border-green-200 bg-green-50 p-[12px] text-[13px] text-green-900">{message}</p>}
    {data && !data.manage && <p className="mb-[12px] rounded-md border border-amber-200 bg-amber-50 p-[12px] text-[13px] text-amber-900">Só administradores do workspace podem salvar chaves.</p>}
    <div className="mb-[14px] flex flex-wrap items-center gap-[8px]">
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar conector" aria-label="Buscar conector" className="w-[220px] rounded-md border border-[#d9d4ce] bg-white px-[10px] py-[7px] text-[13px]"/>
      <div role="tablist" aria-label="Categorias" className="flex flex-wrap gap-[6px]">{categories.map(name => <button key={name} type="button" role="tab" aria-selected={category === name} onClick={() => setCategory(name)} className={`rounded-full px-[12px] py-[6px] text-[12px] ${category === name ? 'bg-[#1c1b22] text-white' : 'border border-[#e3ded8] bg-white'}`}>{name}</button>)}</div>
    </div>
    {!data ? !error && <p role="status" className="text-[14px] text-[#6a6772]">Carregando…</p>
      : <ul className="grid gap-[12px] lg:grid-cols-2">{shown.map(item => <li key={item.id}><Card>
        <div className="flex items-start justify-between gap-[10px]">
          <div className="min-w-0"><p className="text-[15px] font-semibold">{item.name}</p><p className="mt-[2px] text-[13px] text-[#5f5c68]">{item.description}</p><p className="mt-[4px] text-[11px] text-[#8a8792]">{item.category}</p></div>
          {item.kind === 'secret'
            ? <span className={`shrink-0 rounded-full px-[10px] py-[3px] text-[11px] font-medium ${data.secrets[item.id] ? 'bg-green-100 text-green-800' : 'bg-[#f2eeea] text-[#6a6772]'}`}>{data.secrets[item.id] ? 'Chave salva' : 'Sem chave'}</span>
            : <span className="shrink-0 rounded-full bg-[#eef2ff] px-[10px] py-[3px] text-[11px] font-medium text-[#3a3f9e]">Chave pública</span>}
        </div>
        {item.kind === 'public' ? <p className="mt-[10px] text-[12px] text-[#6a6772]">Preencha em cada projeto, na aba Conectores. Esses valores são feitos para ficar no site.</p>
          : open === item.id ? <form onSubmit={event => { event.preventDefault(); void save(item); }} className="mt-[12px] grid gap-[8px]">
            {item.fields.map(entry => <div key={entry.key}><label htmlFor={`secret-${item.id}-${entry.key}`} className="mb-[3px] block text-[12px] font-medium">{entry.label}</label>
              <input id={`secret-${item.id}-${entry.key}`} type="password" value={form[entry.key] ?? ''} onChange={event => setForm(current => ({...current, [entry.key]: event.target.value}))} placeholder={entry.placeholder} autoComplete="off" spellCheck={false} className={field}/></div>)}
            <div className="flex gap-[8px]"><button type="submit" disabled={Boolean(busy) || item.fields.some(entry => !form[entry.key]?.trim())} className="rounded-[10px] bg-[#1c1b22] px-[14px] py-[8px] text-[13px] font-medium text-white disabled:opacity-40">{busy === item.id ? 'Salvando…' : 'Salvar chave'}</button>
              <button type="button" onClick={() => { setOpen(''); setForm({}); }} className="rounded-[10px] border border-[#e3ded8] px-[12px] py-[8px] text-[13px]">Cancelar</button></div>
          </form>
          : <div className="mt-[12px] flex flex-wrap items-center gap-[12px] text-[13px]">
            <button type="button" disabled={!data.manage || Boolean(busy)} onClick={() => { setOpen(item.id); setForm({}); }} className="rounded-[10px] border border-[#e3ded8] px-[12px] py-[7px] disabled:opacity-40">{data.secrets[item.id] ? 'Trocar chave' : 'Adicionar chave'}</button>
            {data.secrets[item.id] && <button type="button" disabled={!data.manage || Boolean(busy)} onClick={() => void save(item, true)} className="text-[12px] text-[#8a3a2a] underline disabled:opacity-40">Apagar</button>}
          </div>}
        <a href={item.keysUrl} target="_blank" rel="noreferrer" className="mt-[10px] inline-block text-[12px] underline">Onde pegar a chave</a>
      </Card></li>)}</ul>}
  </SettingsLayout>;
}
