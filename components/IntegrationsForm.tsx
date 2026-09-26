"use client";
import {useCallback, useEffect, useState} from 'react';

type Row = {integration: 'vercel' | 'github' | 'supabase'; configured: boolean; source: 'environment' | 'saved' | 'unconfigured'; version: number};
const details: Record<Row['integration'], {name: string; help: string; link: string}> = {
  vercel: {name: 'Vercel (publicar na internet)', help: 'Crie um token em Account Settings → Tokens.', link: 'https://vercel.com/account/tokens'},
  github: {name: 'GitHub (enviar o código)', help: 'Crie um token com acesso a repositórios (Contents e Administration).', link: 'https://github.com/settings/tokens'},
  supabase: {name: 'Supabase (criar tabelas do app)', help: 'Token de acesso pessoal, usado só quando você aplica uma migração.', link: 'https://supabase.com/dashboard/account/tokens'},
};

/** Tokens are write-only from the browser: typed once, stored encrypted, never shown again. */
export default function IntegrationsForm() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/integrations', {cache: 'no-store'});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha ao carregar as integrações.');
    setRows(data.integrations);
  }, []);
  useEffect(() => { void load().catch(caught => setError(caught instanceof Error ? caught.message : 'Falha ao carregar.')); }, [load]);

  async function save(row: Row, clear = false) {
    setBusy(row.integration); setError(''); setMessage('');
    try {
      const response = await fetch('/api/integrations', {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({integration: row.integration, version: row.version, ...(clear ? {clear: true} : {token: tokens[row.integration] || ''})})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar.');
      setTokens(current => ({...current, [row.integration]: ''}));
      await load();
      setMessage(clear ? 'Token removido.' : 'Token salvo com criptografia no servidor.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar.'); }
    finally { setBusy(''); }
  }

  return <section id="integracoes" aria-labelledby="integrations-heading" className="mt-[24px] rounded-lg border border-[#deded9] bg-white p-[24px]">
    <h2 id="integrations-heading" className="mb-[6px] text-[19px] font-semibold">Integrações</h2>
    <p className="mb-[18px] max-w-[760px] text-[14px] leading-relaxed text-[#65655e]">Para publicar projetos na internet e enviar o código ao GitHub. Os tokens ficam cifrados no servidor e nunca voltam para o navegador.</p>
    {error && <p role="alert" className="mb-[14px] rounded-md border border-red-200 bg-red-50 p-[12px] text-[13px] text-red-800">{error}</p>}
    {message && <p role="status" className="mb-[14px] rounded-md border border-green-200 bg-green-50 p-[12px] text-[13px] text-green-900">{message}</p>}
    <div className="grid gap-[16px] md:grid-cols-2">{rows.map(row => <div key={row.integration} className="rounded-md border border-[#e4e4de] p-[16px]">
      <p className="text-[14px] font-medium">{details[row.integration].name}</p>
      <p className="mt-[4px] text-[12px] text-[#686862]">{row.configured ? (row.source === 'environment' ? 'Configurado pelo servidor.' : 'Token salvo; o valor não é exibido.') : 'Nenhum token salvo.'} {details[row.integration].help} <a href={details[row.integration].link} target="_blank" rel="noreferrer" className="underline">Criar token</a></p>
      {row.source !== 'environment' && <>
        <label htmlFor={`token-${row.integration}`} className="mb-[4px] mt-[12px] block text-[12px]">Token</label>
        <input id={`token-${row.integration}`} type="password" autoComplete="new-password" spellCheck={false} value={tokens[row.integration] || ''} maxLength={4096}
          onChange={event => setTokens(current => ({...current, [row.integration]: event.target.value}))} className="w-full rounded-md border border-[#cfcfc8] px-[10px] py-[9px] text-[13px]"/>
        <div className="mt-[10px] flex flex-wrap gap-[8px]">
          <button type="button" disabled={Boolean(busy) || !(tokens[row.integration] || '').trim()} onClick={() => void save(row)} className="rounded-md bg-[#252520] px-[14px] py-[9px] text-[12px] font-medium text-white disabled:opacity-40">{busy === row.integration ? 'Salvando…' : 'Salvar token'}</button>
          {row.configured && <button type="button" disabled={Boolean(busy)} onClick={() => void save(row, true)} className="rounded-md border border-[#d2d2cc] px-[14px] py-[9px] text-[12px]">Remover</button>}
        </div>
      </>}
    </div>)}</div>
  </section>;
}
