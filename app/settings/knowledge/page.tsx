"use client";
import {useEffect, useState} from 'react';
import SettingsLayout, {Card} from '@/components/settings/SettingsLayout';
import {projectRequest} from '@/lib/projects/client';

const example = `Exemplos:
- Escreva todos os textos em português do Brasil.
- Use as cores da marca: laranja #F97316 e roxo #7C3AED.
- Botões arredondados e fonte Inter.
- Não use imagens com pessoas.`;

export default function KnowledgeSettingsPage() {
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [limit, setLimit] = useState(20000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/projects?action=knowledge', {cache: 'no-store', signal: controller.signal}).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Não foi possível carregar.');
      setContent(data.content); setSaved(data.content); setLimit(data.limit);
    }).catch(caught => { if (!controller.signal.aborted) setError(caught.message); });
    return () => controller.abort();
  }, []);
  async function save() {
    setBusy(true); setError(''); setMessage('');
    try { const data = await projectRequest<{content: string}>({action: 'knowledgeSave', content}); setContent(data.content); setSaved(data.content); setMessage('Salvo. A IA vai seguir estas regras em todos os projetos deste workspace.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  return <SettingsLayout title="Conhecimento do workspace" description="Regras que a IA segue em todos os projetos: identidade da marca, tom de voz, cores, idioma, o que evitar. Cada projeto também pode ter as próprias instruções.">
    {error && <p role="alert" className="mb-[12px] rounded-md border border-red-200 bg-red-50 p-[12px] text-[13px] text-red-800">{error}</p>}
    {message && <p role="status" className="mb-[12px] rounded-md border border-green-200 bg-green-50 p-[12px] text-[13px] text-green-900">{message}</p>}
    <Card>
      <label htmlFor="knowledge" className="mb-[6px] block text-[13px] font-medium">Instruções para todos os projetos</label>
      <textarea id="knowledge" value={content} onChange={event => setContent(event.target.value)} rows={16} maxLength={limit} disabled={saved === null} placeholder={example} className="w-full rounded-md border border-[#d9d4ce] bg-white p-[12px] font-mono text-[13px] leading-relaxed"/>
      <div className="mt-[10px] flex items-center justify-between text-[12px] text-[#6a6772]"><span>{content.length} de {limit} caracteres</span>
        <button type="button" onClick={() => void save()} disabled={busy || saved === null || content === saved} className="rounded-[10px] bg-[#1c1b22] px-[16px] py-[9px] text-[13px] font-medium text-white disabled:opacity-40">{busy ? 'Salvando…' : 'Salvar'}</button></div>
    </Card>
  </SettingsLayout>;
}
