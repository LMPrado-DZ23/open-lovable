"use client";
import {useCallback, useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import {appConfig} from '@/config/app.config';
import {projectRequest, zipAsBase64} from '@/lib/projects/client';
import type {Project} from '@/lib/projects/store';

type Template = {id: string; name: string; description: string; category: string; private: boolean; files?: number};
const covers = ['from-[#6d5dfc] to-[#a78bfa]', 'from-[#fb7185] to-[#fdba74]', 'from-[#0f172a] to-[#6366f1]', 'from-[#111827] to-[#10b981]', 'from-[#8b5cf6] to-[#38bdf8]', 'from-[#f59e0b] to-[#ef4444]'];
const cover = (id: string) => covers[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % covers.length];

/** Template gallery: public starters plus private templates kept only on this computer. */
export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [category, setCategory] = useState('Todos');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({name: '', category: '', description: ''});
  const [file, setFile] = useState<File | null>(null);
  const load = useCallback(async () => {
    const response = await fetch('/api/projects?action=templates', {cache: 'no-store'});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os modelos.');
    setTemplates(data.templates);
  }, []);
  useEffect(() => { void load().catch(caught => setError(caught instanceof Error ? caught.message : 'Falha ao carregar.')); }, [load]);

  async function use(template: string) {
    setBusy(template); setError('');
    try { const {project} = await projectRequest<{project: Project}>({action: 'template', template, model: appConfig.ai.defaultModel}); router.push('/projects/' + project.id); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível usar o modelo.'); setBusy(''); }
  }
  async function addPrivate(event: React.FormEvent) {
    event.preventDefault(); if (!file) return;
    setBusy('import'); setError(''); setNotice('');
    try {
      const result = await projectRequest<{template: {name: string}; excluded: string[]}>({action: 'templateImport', name: form.name || file.name.replace(/\.zip$/i, ''), category: form.category || undefined, description: form.description || undefined, archive: await zipAsBase64(file)});
      setNotice(`Modelo "${result.template.name}" salvo só neste computador.${result.excluded.length ? ` ${result.excluded.length} arquivo(s) de build ou sensíveis foram ignorados.` : ''}`);
      setForm({name: '', category: '', description: ''}); setFile(null); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível adicionar o modelo.'); }
    finally { setBusy(''); }
  }
  async function remove(template: Template) {
    if (!window.confirm(`Excluir o modelo privado "${template.name}" deste computador?`)) return;
    setBusy(template.id); setError('');
    try { await projectRequest({action: 'templateDelete', template: template.id.replace(/^private:/, '')}); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível excluir.'); }
    finally { setBusy(''); }
  }

  const categories = ['Todos', ...new Set((templates ?? []).map(template => template.private ? 'Meus modelos privados' : template.category))];
  const shown = (templates ?? []).filter(template => category === 'Todos' || (template.private ? category === 'Meus modelos privados' : template.category === category));
  const field = 'w-full rounded-md border border-[#d9d4ce] bg-white px-[10px] py-[8px] text-[13px]';
  return <AppShell>
    <main className="mx-auto max-w-[1180px] px-[16px] py-[28px] md:px-[32px]">
      <h1 className="text-[30px] font-semibold tracking-tight">Modelos</h1>
      <p className="mt-[8px] text-[15px] text-[#5f5c68]">Comece de um projeto pronto e peça as mudanças no chat.</p>
      {error && <p role="alert" className="mt-[16px] rounded-md border border-red-200 bg-red-50 p-[12px] text-[14px] text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-[16px] rounded-md border border-green-200 bg-green-50 p-[12px] text-[14px] text-green-900">{notice}</p>}
      <div role="tablist" aria-label="Categorias" className="mt-[20px] flex flex-wrap gap-[6px]">{categories.map(name => <button key={name} type="button" role="tab" aria-selected={category === name} onClick={() => setCategory(name)} className={`rounded-full px-[14px] py-[7px] text-[13px] ${category === name ? 'bg-[#1c1b22] text-white' : 'border border-[#e3ded8] bg-white text-[#4a4852] hover:bg-[#f7f4f1]'}`}>{name}</button>)}</div>
      {templates === null ? <p role="status" className="mt-[24px] text-[14px] text-[#6a6772]">Carregando…</p>
        : <ul className="mt-[20px] grid gap-[16px] sm:grid-cols-2 lg:grid-cols-3">{shown.map(template => <li key={template.id} className="overflow-hidden rounded-[16px] border border-[#ece7e2] bg-white">
          <div aria-hidden="true" className={`flex h-[140px] items-end bg-gradient-to-br p-[14px] ${cover(template.id)}`}><span className="rounded-full bg-black/35 px-[10px] py-[3px] text-[11px] font-medium text-white">{template.private ? 'Privado · só neste computador' : template.category}</span></div>
          <div className="p-[16px]"><h2 className="text-[16px] font-semibold">{template.name}</h2><p className="mt-[6px] min-h-[36px] text-[13px] text-[#5f5c68]">{template.description || (template.files ? `${template.files} arquivos` : '')}</p>
            <div className="mt-[14px] flex items-center gap-[10px]"><button type="button" disabled={Boolean(busy)} onClick={() => void use(template.id)} className="rounded-[10px] bg-[#1c1b22] px-[14px] py-[8px] text-[13px] font-medium text-white disabled:opacity-40">{busy === template.id ? 'Criando…' : 'Usar este modelo'}</button>
              {template.private && <button type="button" disabled={Boolean(busy)} onClick={() => void remove(template)} className="text-[12px] text-[#8a3a2a] underline disabled:opacity-40">Excluir</button>}</div></div>
        </li>)}</ul>}

      <section aria-labelledby="private-heading" className="mt-[32px] rounded-[16px] border border-[#ece7e2] bg-white p-[20px]">
        <h2 id="private-heading" className="text-[18px] font-semibold">Adicionar um modelo privado</h2>
        <p className="mt-[6px] max-w-[760px] text-[13px] leading-relaxed text-[#5f5c68]">Envie o ZIP de um sistema que você comprou ou criou (por exemplo, os sistemas do TurboSaaS). Ele fica guardado só neste computador, na pasta de dados do Open Lovable, e nunca é enviado ao GitHub. Arquivos de build e com segredos (como .env) são ignorados.</p>
        <form onSubmit={addPrivate} className="mt-[14px] grid gap-[10px] md:grid-cols-2">
          <div><label htmlFor="private-name" className="mb-[4px] block text-[12px] font-medium">Nome do modelo</label><input id="private-name" value={form.name} onChange={event => setForm({...form, name: event.target.value})} maxLength={80} placeholder="Ex.: BarbeiroPro AI" className={field}/></div>
          <div><label htmlFor="private-category" className="mb-[4px] block text-[12px] font-medium">Categoria</label><input id="private-category" value={form.category} onChange={event => setForm({...form, category: event.target.value})} maxLength={40} placeholder="Ex.: Barbearias" className={field}/></div>
          <div className="md:col-span-2"><label htmlFor="private-description" className="mb-[4px] block text-[12px] font-medium">Descrição (opcional)</label><input id="private-description" value={form.description} onChange={event => setForm({...form, description: event.target.value})} maxLength={240} className={field}/></div>
          <div><label htmlFor="private-zip" className="mb-[4px] block text-[12px] font-medium">Arquivo ZIP do sistema</label><input id="private-zip" type="file" accept=".zip" onChange={event => setFile(event.target.files?.[0] ?? null)} className="text-[13px]"/></div>
          <div className="flex items-end"><button type="submit" disabled={Boolean(busy) || !file} className="rounded-[10px] bg-[#a6471f] px-[16px] py-[9px] text-[13px] font-medium text-white disabled:opacity-40">{busy === 'import' ? 'Salvando…' : 'Adicionar modelo privado'}</button></div>
        </form>
      </section>
    </main>
  </AppShell>;
}
