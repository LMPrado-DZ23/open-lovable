"use client";
import {useEffect, useState} from 'react';
import Link from 'next/link';
import SettingsLayout, {Card} from '@/components/settings/SettingsLayout';

type ProjectItem = {id: string; name: string; version: number; updated_at?: string; updatedAt?: string};

/** Every project can be downloaded as a ZIP with its files and a manifest, for backup or to open elsewhere. */
export default function DataSettingsPage() {
  const [projects, setProjects] = useState<ProjectItem[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/projects', {cache: 'no-store', signal: controller.signal}).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os projetos.'); setProjects(data.projects);
    }).catch(caught => { if (!controller.signal.aborted) setError(caught.message); });
    return () => controller.abort();
  }, []);
  const when = (project: ProjectItem) => { const value = project.updatedAt ?? project.updated_at; return value ? new Date(value).toLocaleString('pt-BR') : ''; };
  return <SettingsLayout title="Dados e backup" description="Baixe seus projetos como ZIP para guardar uma cópia ou abrir em outro editor. Os dados ficam na pasta de dados do Open Lovable neste computador.">
    {error && <p role="alert" className="mb-[12px] rounded-md border border-red-200 bg-red-50 p-[12px] text-[13px] text-red-800">{error}</p>}
    <Card title="Exportar projetos">
      {projects === null ? !error && <p role="status" className="text-[14px] text-[#6a6772]">Carregando…</p>
        : projects.length === 0 ? <p className="text-[14px] text-[#6a6772]">Nenhum projeto ainda. <Link href="/" className="underline">Criar o primeiro</Link>.</p>
        : <ul className="divide-y divide-[#f0ece7]">{projects.map(project => <li key={project.id} className="flex flex-wrap items-center justify-between gap-[10px] py-[10px]">
          <div className="min-w-0"><Link href={`/projects/${project.id}`} className="text-[14px] font-medium hover:underline">{project.name}</Link><p className="text-[12px] text-[#6a6772]">Revisão {project.version}{when(project) ? ` · ${when(project)}` : ''}</p></div>
          <a href={'/api/projects?' + new URLSearchParams({id: project.id, action: 'export'})} className="rounded-[10px] border border-[#e3ded8] px-[12px] py-[7px] text-[13px] hover:bg-[#f7f4f1]">Baixar ZIP</a>
        </li>)}</ul>}
    </Card>
    <Card title="Onde ficam os dados">
      <p className="text-[13px] leading-relaxed text-[#5f5c68]">Projetos, histórico, modelos privados e chaves (criptografadas) ficam na pasta de dados do Open Lovable. Para fazer backup completo, copie essa pasta inteira junto com o arquivo <code>credentials.key</code>: sem ele, as chaves salvas não podem ser lidas.</p>
    </Card>
  </SettingsLayout>;
}
