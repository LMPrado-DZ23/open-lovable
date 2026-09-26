"use client";
import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {appConfig} from '@/config/app.config';
import AIModelSelect from '@/components/AIModelSelect';
import OpenLovableLogo from '@/components/brand/OpenLovableLogo';
import {useAccount} from '@/components/account/client';
import {projectRequest} from '@/lib/projects/client';
import {saveProjectDraft} from '@/lib/projects/draft';
import type {Project} from '@/lib/projects/store';

type Summary = Omit<Project, 'snapshot'>;
type Attachment = {file: File; preview: string};

const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const EXAMPLES = [
  'Uma loja virtual de roupas com carrinho e checkout',
  'Um painel financeiro com gráficos de receitas e despesas',
  'Uma landing page para a minha clínica com agendamento',
  'Um app de tarefas em equipe com quadro kanban',
];

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
}

/** Chat-first start: describe the product, optionally attach screenshots, and land in the project. */
export default function Home() {
  const router = useRouter();
  const {account} = useAccount();
  const selectedRole = account?.workspaces?.find(workspace => workspace.id === account.selectedWorkspaceId)?.role;
  const canCreate = account?.mode !== 'supabase' || ['owner', 'admin', 'editor'].includes(selectedRole || '');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<string>(appConfig.ai.defaultModel);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Summary[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/projects', {cache: 'no-store', signal: controller.signal})
      .then(async response => {
        const data = await response.json();
        if (response.ok && Array.isArray(data.projects) && !controller.signal.aborted) setProjects(data.projects);
      })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setProjectsLoaded(true); });
    return () => controller.abort();
  }, []);

  useEffect(() => () => attachments.forEach(item => URL.revokeObjectURL(item.preview)), [attachments]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError('');
    const next = [...attachments];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_ATTACHMENTS) { setError(`Anexe até ${MAX_ATTACHMENTS} imagens por pedido.`); break; }
      if (!IMAGE_TYPES.includes(file.type)) { setError('Use imagens PNG, JPEG ou WebP.'); continue; }
      if (file.size > MAX_IMAGE_BYTES) { setError('Cada imagem deve ter até 5 MB.'); continue; }
      next.push({file, preview: URL.createObjectURL(file)});
    }
    setAttachments(next);
  }

  function removeAttachment(index: number) {
    setAttachments(current => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, position) => position !== index);
    });
  }

  async function start(event?: React.FormEvent) {
    event?.preventDefault();
    const text = prompt.trim();
    if (!text || busy || !canCreate) return;
    setBusy(true);
    setError('');
    try {
      setStatus('Criando o projeto…');
      const name = text.split('\n')[0].slice(0, 60).trim() || 'Novo projeto';
      const {project} = await projectRequest<{project: Project}>({action: 'create', name, model});
      const imageIDs: string[] = [];
      for (const [index, item] of attachments.entries()) {
        setStatus(`Enviando imagem ${index + 1} de ${attachments.length}…`);
        const response = await fetch('/api/project-images', {method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({action: 'upload', projectID: project.id, name: item.file.name.slice(0, 160) || 'referencia.png', role: 'target', data: await readBase64(item.file)})});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Falha ao enviar uma imagem.');
        imageIDs.push(result.image.id);
      }
      saveProjectDraft(project.id, {prompt: text, imageIDs});
      router.push('/projects/' + project.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível começar o projeto.');
      setBusy(false);
      setStatus('');
    }
  }

  return <main className="relative min-h-screen overflow-hidden bg-[#fbf9f7] text-[#1c1b22]">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[-240px] mx-auto h-[720px] max-w-[1200px] opacity-80 blur-[90px]"
      style={{background: 'radial-gradient(40% 45% at 30% 45%, #ffb38a 0%, transparent 70%), radial-gradient(38% 45% at 55% 55%, #ff7aa8 0%, transparent 70%), radial-gradient(40% 45% at 75% 40%, #9c8cff 0%, transparent 70%)'}}/>
    <header className="relative z-10 mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-[16px] px-[16px] py-[18px] md:px-[32px]">
      <Link href="/" aria-label="Open Lovable, início"><OpenLovableLogo/></Link>
      <nav aria-label="Principal" className="flex flex-wrap items-center gap-[6px] text-[14px]">
        <Link href="/projects" className="rounded-md px-[12px] py-[8px] hover:bg-white/70">Projetos</Link>
        <Link href="/settings/ai" className="rounded-md px-[12px] py-[8px] hover:bg-white/70">Conexões de IA</Link>
        <Link href="/clone" className="rounded-md px-[12px] py-[8px] hover:bg-white/70">Importar um site</Link>
      </nav>
    </header>

    <section className="relative z-10 mx-auto max-w-[820px] px-[16px] pb-[48px] pt-[56px] text-center md:pt-[96px]">
      <h1 className="text-[34px] font-semibold leading-[1.1] tracking-tight md:text-[56px]">O que vamos construir hoje?</h1>
      <p className="mx-auto mt-[16px] max-w-[560px] text-[16px] leading-relaxed text-[#56545f] md:text-[18px]">Descreva o app ou site que você quer. A IA escreve o código e monta a prévia, e cada alteração fica guardada no histórico.</p>

      <form onSubmit={start} className="mt-[36px] rounded-[20px] border border-[#e6e1dc] bg-white p-[14px] text-left shadow-[0_12px_40px_rgba(60,40,80,0.12)]"
        onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files); }}>
        <label htmlFor="home-prompt" className="sr-only">Descreva o que você quer construir</label>
        <textarea id="home-prompt" ref={textarea} value={prompt} onChange={event => setPrompt(event.target.value)} rows={3} maxLength={32768}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void start(); } }}
          placeholder="Peça ao Open Lovable para criar um sistema de agendamento para o meu salão…" disabled={busy || !canCreate}
          className="block max-h-[320px] min-h-[88px] w-full resize-y rounded-[12px] border-0 bg-transparent p-[8px] text-[16px] leading-relaxed placeholder:text-[#9a97a3] focus:outline-none"/>
        {attachments.length > 0 && <ul aria-label="Imagens anexadas" className="flex flex-wrap gap-[10px] px-[8px] pb-[8px]">
          {attachments.map((item, index) => <li key={item.preview} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={item.preview} alt={item.file.name} className="h-[64px] w-[64px] rounded-[10px] border border-[#e6e1dc] object-cover"/>
            <button type="button" onClick={() => removeAttachment(index)} aria-label={`Remover ${item.file.name}`}
              className="absolute -right-[6px] -top-[6px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#1c1b22] text-[13px] leading-none text-white">×</button>
          </li>)}
        </ul>}
        <div className="flex flex-wrap items-center justify-between gap-[10px] border-t border-[#f0ece8] px-[4px] pt-[10px]">
          <div className="flex min-w-0 flex-wrap items-center gap-[8px]">
            <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(',')} multiple className="sr-only" aria-label="Anexar imagens"
              onChange={event => { addFiles(event.target.files); event.currentTarget.value = ''; }} disabled={busy || !canCreate}/>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || !canCreate || attachments.length >= MAX_ATTACHMENTS}
              className="inline-flex items-center gap-[6px] rounded-full border border-[#e3ded8] px-[12px] py-[7px] text-[13px] hover:bg-[#f7f4f1] disabled:opacity-40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m21.4 11.1-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8"/></svg>
              Anexar
            </button>
            <div className="w-[230px] max-w-full">
              <AIModelSelect value={model} onValueChange={setModel} disabled={busy}
                className="w-full min-w-0 rounded-full border border-[#e3ded8] bg-white px-[12px] py-[7px] text-[13px]"/>
            </div>
          </div>
          <button type="submit" disabled={busy || !prompt.trim() || !canCreate} aria-label="Começar a construir"
            className="flex h-[40px] min-w-[40px] items-center justify-center gap-[8px] rounded-full bg-[#1c1b22] px-[16px] text-[14px] font-medium text-white hover:bg-black disabled:opacity-30">
            {busy ? status || 'Começando…' : <>Construir <span aria-hidden="true">↑</span></>}
          </button>
        </div>
      </form>
      {!canCreate && <p className="mt-[12px] text-[13px] text-[#56545f]">Seu papel neste workspace permite apenas visualizar projetos.</p>}
      {error && <p role="alert" className="mt-[14px] rounded-md border border-red-200 bg-red-50 p-[12px] text-left text-[14px] text-red-800">{error}</p>}

      <div className="mt-[20px] flex flex-wrap justify-center gap-[8px]">
        {EXAMPLES.map(example => <button key={example} type="button" disabled={busy}
          onClick={() => { setPrompt(example); textarea.current?.focus(); }}
          className="rounded-full border border-[#e6e1dc] bg-white/80 px-[14px] py-[8px] text-[13px] text-[#3e3c46] hover:bg-white disabled:opacity-40">{example}</button>)}
      </div>
    </section>

    <section aria-labelledby="recent-heading" className="relative z-10 mx-auto max-w-[1200px] px-[16px] pb-[64px] md:px-[32px]">
      <div className="rounded-[20px] border border-[#ebe6e1] bg-white/90 p-[20px] md:p-[28px]">
        <div className="mb-[16px] flex flex-wrap items-baseline justify-between gap-[8px]">
          <h2 id="recent-heading" className="text-[18px] font-semibold">Seus projetos</h2>
          <Link href="/projects" className="text-[14px] underline underline-offset-4">Ver todos</Link>
        </div>
        {!projectsLoaded ? <p role="status" className="text-[14px] text-[#6a6772]">Carregando…</p>
          : projects.length === 0 ? <p className="text-[14px] text-[#6a6772]">Nenhum projeto ainda. Descreva uma ideia acima para começar.</p>
          : <ul className="grid gap-[12px] sm:grid-cols-2 lg:grid-cols-3">{projects.slice(0, 6).map(project => <li key={project.id}>
            <Link href={'/projects/' + project.id} className="block rounded-[14px] border border-[#ece7e2] p-[16px] hover:border-[#d9cfc7] hover:bg-[#fdfbf9]">
              <p className="truncate text-[15px] font-medium">{project.name}</p>
              <p className="mt-[6px] text-[12px] text-[#7a7782]">Revisão {project.version} · {new Date(project.updated_at).toLocaleDateString('pt-BR')}</p>
            </Link>
          </li>)}</ul>}
      </div>
    </section>
  </main>;
}
