"use client";
import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import SettingsLayout, {Card} from '@/components/settings/SettingsLayout';
import {projectRequest} from '@/lib/projects/client';

type Template = {id: string; name: string; description: string; category: string; private: boolean; files?: number};

export default function TemplatesSettingsPage() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/projects?action=templates', {cache: 'no-store'});
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os modelos.');
    setTemplates((data.templates as Template[]).filter(template => template.private));
  }, []);
  useEffect(() => { void load().catch(caught => setError(caught instanceof Error ? caught.message : 'Falha ao carregar.')); }, [load]);
  async function remove(template: Template) {
    if (!window.confirm(`Excluir o modelo privado "${template.name}" deste computador?`)) return;
    setBusy(template.id); setError('');
    try { await projectRequest({action: 'templateDelete', template: template.id.replace(/^private:/, '')}); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível excluir.'); }
    finally { setBusy(''); }
  }
  return <SettingsLayout title="Modelos privados" description="Sistemas que você comprou ou criou e salvou como modelo. Ficam só neste computador e nunca vão para o GitHub.">
    {error && <p role="alert" className="mb-[12px] rounded-md border border-red-200 bg-red-50 p-[12px] text-[13px] text-red-800">{error}</p>}
    <Card>
      {templates === null ? !error && <p role="status" className="text-[14px] text-[#6a6772]">Carregando…</p>
        : templates.length === 0 ? <p className="text-[14px] text-[#6a6772]">Nenhum modelo privado ainda.</p>
        : <ul className="divide-y divide-[#f0ece7]">{templates.map(template => <li key={template.id} className="flex flex-wrap items-center justify-between gap-[10px] py-[10px]">
          <div><p className="text-[14px] font-medium">{template.name}</p><p className="text-[12px] text-[#6a6772]">{template.category}{template.files ? ` · ${template.files} arquivos` : ''}</p></div>
          <button type="button" disabled={Boolean(busy)} onClick={() => void remove(template)} className="text-[12px] text-[#8a3a2a] underline disabled:opacity-40">{busy === template.id ? 'Excluindo…' : 'Excluir'}</button>
        </li>)}</ul>}
      <Link href="/templates" className="mt-[14px] inline-block rounded-[10px] border border-[#e3ded8] px-[12px] py-[7px] text-[13px] hover:bg-[#f7f4f1]">Adicionar modelo (ZIP) ou usar um modelo</Link>
    </Card>
  </SettingsLayout>;
}
