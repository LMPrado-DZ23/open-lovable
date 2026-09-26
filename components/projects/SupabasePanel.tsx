"use client";
import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {projectRequest} from '@/lib/projects/client';

type Migration = {path: string; sql: string; applied: boolean};
type BackendState = {backend: {url: string; projectRef: string; updatedAt: string} | null; migrations: Migration[]; tokenConfigured: boolean};

/** Lovable's Supabase integration: connect, let the AI use auth + tables, review and apply SQL migrations. */
export default function SupabasePanel({projectId, version, locked, onSaved, onAsk}: {projectId: string; version: number; locked: boolean; onSaved: () => Promise<unknown>; onAsk?: (request: string) => void}) {
  const [state, setState] = useState<BackendState | null>(null);
  const [url, setURL] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/projects?' + new URLSearchParams({id: projectId, action: 'backend'}), {cache: 'no-store', signal});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível ler o backend.');
    if (!signal?.aborted) setState(data);
  }, [projectId]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal).catch(caught => { if (!controller.signal.aborted) setError(caught.message); }); return () => controller.abort(); }, [load, version]);

  async function connect(event: React.FormEvent) {
    event.preventDefault(); setBusy('connect'); setError(''); setMessage('');
    try {
      await projectRequest({action: 'backend', id: projectId, version, url, anonKey});
      setAnonKey(''); await onSaved(); await load();
      setMessage('Supabase conectado. O cliente foi adicionado ao projeto como uma nova revisão e a IA já sabe usá-lo.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível conectar.'); }
    finally { setBusy(''); }
  }
  async function apply(path: string) {
    if (!window.confirm('Executar esta migração no banco do Supabase? Alterações de banco não são desfeitas pelo histórico do projeto.')) return;
    setBusy(path); setError(''); setMessage('');
    try { await projectRequest({action: 'backendApply', id: projectId, path}); await load(); setMessage('Migração aplicada no Supabase.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível aplicar a migração.'); }
    finally { setBusy(''); }
  }

  const field = 'w-full rounded-md border border-[#cecec2] bg-white px-[10px] py-[9px] text-[13px]';
  return <div className="min-h-[430px] p-[22px]">
    <h2 className="text-[17px] font-semibold">Backend com Supabase</h2>
    <p className="mb-[16px] mt-[8px] max-w-[700px] text-[13px] leading-relaxed text-[#727266]">Conecte um projeto Supabase para o app ter login de usuários e banco de dados. Depois é só pedir no chat, por exemplo: &quot;adicione login com e-mail e salve as tarefas de cada usuário&quot;.</p>
    {error && <p role="alert" className="mb-[12px] rounded-md border border-red-200 bg-red-50 p-[12px] text-[13px] text-red-800">{error}</p>}
    {message && <p role="status" className="mb-[12px] rounded-md border border-green-200 bg-green-50 p-[12px] text-[13px] text-green-900">{message}</p>}
    {state?.backend && <p className="mb-[16px] rounded-md border border-[#e3e3d9] bg-[#fbfbf7] p-[12px] text-[13px]">Conectado a <code className="break-all">{state.backend.url}</code>.</p>}

    <form onSubmit={connect} className="grid max-w-[720px] gap-[10px]">
      <label htmlFor="supabase-url" className="text-[12px] font-medium">Endereço do projeto (Project URL)</label>
      <input id="supabase-url" value={url} onChange={event => setURL(event.target.value)} placeholder="https://abcd1234efgh5678ijkl.supabase.co" disabled={locked || Boolean(busy)} className={field}/>
      <label htmlFor="supabase-anon" className="text-[12px] font-medium">Chave pública (anon ou publishable)</label>
      <input id="supabase-anon" value={anonKey} onChange={event => setAnonKey(event.target.value)} spellCheck={false} autoComplete="off" disabled={locked || Boolean(busy)} className={field}/>
      <p className="text-[11px] text-[#77776b]">Em Supabase → Project Settings → API. Nunca use a chave service_role: ela é recusada.</p>
      <div><button type="submit" disabled={locked || Boolean(busy) || !url.trim() || !anonKey.trim()} className="rounded-md bg-[#272721] px-[16px] py-[10px] text-[12px] font-medium text-white disabled:opacity-40">{busy === 'connect' ? 'Conectando…' : state?.backend ? 'Atualizar conexão' : 'Conectar Supabase'}</button></div>
    </form>

    {state?.backend && <section className="mt-[28px]" aria-labelledby="migrations-heading">
      <h3 id="migrations-heading" className="text-[15px] font-semibold">Migrações do banco</h3>
      <p className="mb-[12px] mt-[6px] text-[12px] text-[#727266]">A IA cria arquivos em <code>supabase/migrations/</code> quando precisa de tabelas. Revise o SQL e aplique.{!state.tokenConfigured && <> Para aplicar, salve o token do Supabase em <Link href="/settings/ai#integracoes" className="underline">Integrações</Link>.</>}</p>
      {state.migrations.length === 0
        ? <p className="text-[13px] text-[#77776b]">Nenhuma migração no projeto ainda.{onAsk && <> <button type="button" onClick={() => onAsk('Crie as tabelas necessárias para este app no Supabase, com RLS para que cada usuário veja apenas os próprios dados, e conecte as telas a elas.')} className="underline">Pedir à IA para criar as tabelas</button></>}</p>
        : <ul className="divide-y divide-[#e3e3d9] border-y border-[#e3e3d9]">{state.migrations.map(migration => <li key={migration.path} className="py-[12px]">
          <div className="flex flex-wrap items-center justify-between gap-[10px]"><code className="break-all text-[12px]">{migration.path}</code>
            {migration.applied ? <span className="text-[12px] font-medium text-green-800">Aplicada</span>
              : <button type="button" disabled={locked || Boolean(busy) || !state.tokenConfigured} onClick={() => void apply(migration.path)} className="rounded-md border border-[#d2d2c8] px-[12px] py-[7px] text-[12px] disabled:opacity-40">{busy === migration.path ? 'Aplicando…' : 'Aplicar no Supabase'}</button>}</div>
          <details className="mt-[8px]"><summary className="cursor-pointer text-[12px]">Ver SQL</summary><pre className="mt-[8px] max-h-[260px] overflow-auto whitespace-pre-wrap break-words rounded bg-[#f6f6f1] p-[10px] text-[12px]">{migration.sql}</pre></details>
        </li>)}</ul>}
    </section>}
  </div>;
}
