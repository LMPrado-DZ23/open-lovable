"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import {appConfig} from '@/config/app.config';
import {projectRequest} from '@/lib/projects/client';
import {STARTER_TEMPLATES} from '@/lib/templates/starters';
import type {Project} from '@/lib/projects/store';

const covers: Record<string, string> = {
  'landing-saas': 'from-[#6d5dfc] to-[#a78bfa]', loja: 'from-[#fb7185] to-[#fdba74]', dashboard: 'from-[#0f172a] to-[#6366f1]', portfolio: 'from-[#111827] to-[#10b981]', kanban: 'from-[#8b5cf6] to-[#38bdf8]',
};

/** Template gallery: every starter opens as a normal, editable project. */
export default function TemplatesPage() {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function use(template: string) {
    setBusy(template); setError('');
    try { const {project} = await projectRequest<{project: Project}>({action: 'template', template, model: appConfig.ai.defaultModel}); router.push('/projects/' + project.id); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível usar o modelo.'); setBusy(''); }
  }
  return <AppShell>
    <main className="mx-auto max-w-[1100px] px-[16px] py-[28px] md:px-[32px]">
      <h1 className="text-[30px] font-semibold tracking-tight">Modelos</h1>
      <p className="mt-[8px] text-[15px] text-[#5f5c68]">Comece de um projeto pronto e peça as mudanças no chat.</p>
      {error && <p role="alert" className="mt-[16px] rounded-md border border-red-200 bg-red-50 p-[12px] text-[14px] text-red-800">{error}</p>}
      <ul className="mt-[24px] grid gap-[16px] sm:grid-cols-2 lg:grid-cols-3">{STARTER_TEMPLATES.map(template => <li key={template.id} className="overflow-hidden rounded-[16px] border border-[#ece7e2] bg-white">
        <div aria-hidden="true" className={`h-[140px] bg-gradient-to-br ${covers[template.id] ?? 'from-[#ffb23e] to-[#7a3cf0]'}`}/>
        <div className="p-[16px]"><h2 className="text-[16px] font-semibold">{template.name}</h2><p className="mt-[6px] text-[13px] text-[#5f5c68]">{template.description}</p>
          <button type="button" disabled={Boolean(busy)} onClick={() => void use(template.id)} className="mt-[14px] rounded-[10px] bg-[#1c1b22] px-[14px] py-[8px] text-[13px] font-medium text-white disabled:opacity-40">{busy === template.id ? 'Criando…' : 'Usar este modelo'}</button></div>
      </li>)}</ul>
    </main>
  </AppShell>;
}
