"use client";
import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {appConfig} from '@/config/app.config';
import AIModelSelect from '@/components/AIModelSelect';
import AppShell from '@/components/shell/AppShell';
import {useAccount} from '@/components/account/client';
import {projectRequest, zipAsBase64} from '@/lib/projects/client';
import {saveProjectDraft} from '@/lib/projects/draft';
import {favoriteProjects, toggleFavorite} from '@/lib/projects/preferences';
import VoiceInputButton from '@/components/VoiceInputButton';
import {STARTER_TEMPLATES} from '@/lib/templates/starters';
import type {Project} from '@/lib/projects/store';

type Summary = Omit<Project, 'snapshot'>;
type Attachment = {file: File; preview: string};

const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const TEXT_FILE = /\.(txt|md|json|csv|html?|css|jsx?|tsx?|mjs|svg|xml|ya?ml|sql)$/i;
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
  const [files, setFiles] = useState<File[]>([]);
  const [chatMode, setChatMode] = useState<'build' | 'chat' | 'plan'>('build');
  const [tab, setTab] = useState<'mine' | 'recent' | 'favorites' | 'templates'>('mine');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => { setFavorites(favoriteProjects()); }, []);
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
    const others = [...files];
    for (const file of Array.from(list)) {
      if (/\.zip$/i.test(file.name)) { if (file.size > 16 * 1024 * 1024) { setError('O ZIP deve ter até 16 MB.'); continue; } others.push(file); continue; }
      if (TEXT_FILE.test(file.name)) { if (file.size > 200_000) { setError('Arquivos de texto devem ter até 200 KB.'); continue; } others.push(file); continue; }
      if (next.length >= MAX_ATTACHMENTS) { setError(`Anexe até ${MAX_ATTACHMENTS} imagens por pedido.`); break; }
      if (!IMAGE_TYPES.includes(file.type)) { setError(`Não é possível anexar "${file.name}". Use imagem, ZIP de código ou arquivo de texto/código.`); continue; }
      if (file.size > MAX_IMAGE_BYTES) { setError('Cada imagem deve ter até 5 MB.'); continue; }
      next.push({file, preview: URL.createObjectURL(file)});
    }
    setAttachments(next);
    setFiles(others.slice(0, 10));
  }

  function removeAttachment(index: number) {
    setAttachments(current => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, position) => position !== index);
    });
  }

  async function startFromTemplate(templateId: string) {
    if (busy || !canCreate) return;
    setBusy(true); setError(''); setStatus('Criando a partir do modelo…');
    try {
      const {project} = await projectRequest<{project: Project}>({action: 'template', template: templateId, model});
      router.push('/projects/' + project.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível usar o modelo.'); setBusy(false); setStatus('');
    }
  }

  async function start(event?: React.FormEvent) {
    event?.preventDefault();
    const text = prompt.trim();
    if ((!text && !files.length) || busy || !canCreate) return;
    setBusy(true);
    setError('');
    try {
      setStatus('Criando o projeto…');
      const name = text.split('\n')[0].slice(0, 60).trim() || files[0]?.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Novo projeto';
      const {project} = await projectRequest<{project: Project}>({action: 'create', name, model});
      let version = project.version;
      for (const file of files) {
        if (/\.zip$/i.test(file.name)) {
          setStatus('Importando o código do ZIP…');
          const {project: imported} = await projectRequest<{project: Project}>({action: 'import', id: project.id, version, archive: await zipAsBase64(file)});
          version = imported.version;
        } else {
          setStatus(`Enviando ${file.name}…`);
          await projectRequest({action: 'document', id: project.id, name: file.name.slice(0, 200), content: await file.text()});
        }
      }
      const imageIDs: string[] = [];
      for (const [index, item] of attachments.entries()) {
        setStatus(`Enviando imagem ${index + 1} de ${attachments.length}…`);
        const response = await fetch('/api/project-images', {method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({action: 'upload', projectID: project.id, name: item.file.name.slice(0, 160) || 'referencia.png', role: 'target', data: await readBase64(item.file)})});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Falha ao enviar uma imagem.');
        imageIDs.push(result.image.id);
      }
      // "Conversar" answers without touching files, like Lovable's chat mode; it runs as a read-only plan request.
      const draftPrompt = chatMode === 'chat' && text ? `Responda de forma direta e clara, sem propor nem gerar alterações de código:\n\n${text}` : text;
      saveProjectDraft(project.id, {prompt: draftPrompt, imageIDs, ...(chatMode === 'build' ? {} : {mode: 'plan' as const})});
      router.push('/projects/' + project.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível começar o projeto.');
      setBusy(false);
      setStatus('');
    }
  }

  const firstName = account?.user?.email ? account.user.email.split('@')[0].split(/[._-]/)[0] : '';
  const greeting = firstName ? `Vamos criar algo, ${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}` : 'Vamos criar algo';
  const search = query.trim().toLowerCase();
  const listed = (tab === 'favorites' ? projects.filter(project => favorites.includes(project.id)) : tab === 'recent' ? [...projects].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) : projects)
    .filter(project => !search || project.name.toLowerCase().includes(search)).slice(0, 12);
  const tabs: Array<[typeof tab, string]> = [['mine', 'Meus projetos'], ['recent', 'Visualizados recentemente'], ['favorites', 'Favoritos'], ['templates', 'Modelos']];

  return <AppShell><main className="relative min-h-screen overflow-hidden bg-[#101014] text-white">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0"
      style={{background: 'radial-gradient(60% 45% at 50% 18%, #3b5bdb 0%, transparent 70%), radial-gradient(55% 50% at 30% 60%, #c85fd6 0%, transparent 70%), radial-gradient(60% 55% at 70% 72%, #f0466e 0%, transparent 72%), linear-gradient(180deg, #1b2a55 0%, #7a3fb0 45%, #e4436b 100%)'}}/>

    <section className="relative z-10 mx-auto max-w-[900px] px-[16px] pb-[56px] pt-[72px] text-center md:pt-[120px]">
      <h1 className="text-[36px] font-semibold leading-[1.1] tracking-tight drop-shadow-sm md:text-[52px]">{greeting}</h1>
      <p className="mx-auto mt-[12px] max-w-[560px] text-[16px] text-white/80">Descreva o app ou site. A IA escreve o código, monta a prévia e guarda cada versão.</p>

      <form onSubmit={start} className="mt-[32px] rounded-[26px] border border-white/10 bg-[#1c1c21]/95 p-[14px] text-left shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur"
        onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files); }}>
        <label htmlFor="home-prompt" className="sr-only">Descreva o que você quer construir</label>
        <textarea id="home-prompt" ref={textarea} value={prompt} onChange={event => setPrompt(event.target.value)} rows={2} maxLength={32768}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void start(); } }}
          placeholder={chatMode === 'chat' ? 'Pergunte qualquer coisa ao Open Lovable…' : 'Peça ao Open Lovable para criar um app de agendamento para o meu salão…'} disabled={busy || !canCreate}
          className="block max-h-[320px] min-h-[64px] w-full resize-none bg-transparent p-[8px] text-[16px] leading-relaxed text-white placeholder:text-white/45 focus:outline-none"/>
        {files.length > 0 && <ul aria-label="Arquivos anexados" className="flex flex-wrap gap-[8px] px-[8px] pb-[8px]">{files.map((file, index) => <li key={file.name + index} className="flex items-center gap-[6px] rounded-full bg-white/10 px-[10px] py-[4px] text-[12px]">{/\.zip$/i.test(file.name) ? '🗂' : '📄'} {file.name}<button type="button" aria-label={`Remover ${file.name}`} onClick={() => setFiles(current => current.filter((_, position) => position !== index))} className="text-[14px] leading-none">×</button></li>)}</ul>}
        {attachments.length > 0 && <ul aria-label="Imagens anexadas" className="flex flex-wrap gap-[10px] px-[8px] pb-[8px]">
          {attachments.map((item, index) => <li key={item.preview} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={item.preview} alt={item.file.name} className="h-[64px] w-[64px] rounded-[10px] border border-white/10 object-cover"/>
            <button type="button" onClick={() => removeAttachment(index)} aria-label={`Remover ${item.file.name}`}
              className="absolute -right-[6px] -top-[6px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-[13px] leading-none text-black">×</button>
          </li>)}
        </ul>}
        <div className="flex flex-wrap items-center justify-between gap-[8px] px-[2px] pt-[6px]">
          <div className="flex min-w-0 items-center gap-[6px]">
            <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(',') + ',.zip,.txt,.md,.json,.csv,.html,.htm,.css,.js,.jsx,.ts,.tsx,.mjs,.svg,.xml,.yml,.yaml,.sql'} multiple className="sr-only" aria-label="Anexar imagens"
              onChange={event => { addFiles(event.target.files); event.currentTarget.value = ''; }} disabled={busy || !canCreate}/>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || !canCreate || attachments.length >= MAX_ATTACHMENTS}
              aria-label="Anexar arquivos (imagem, ZIP ou código)" title="Anexar imagem, ZIP ou código"
              className="flex h-[36px] w-[36px] items-center justify-center rounded-full border border-white/15 text-[20px] leading-none hover:bg-white/10 disabled:opacity-30">+</button>
            <div className="w-[190px] max-w-[40vw]">
              <AIModelSelect value={model} onValueChange={setModel} disabled={busy}
                className="w-full min-w-0 rounded-full border border-white/15 bg-transparent px-[10px] py-[7px] text-[13px] text-white [&>option]:text-black"/>
            </div>
          </div>
          <div className="flex items-center gap-[6px]">
            <label htmlFor="home-mode" className="sr-only">Modo</label>
            <select id="home-mode" value={chatMode} onChange={event => setChatMode(event.target.value as typeof chatMode)} disabled={busy}
              className="rounded-full border border-white/15 bg-transparent px-[10px] py-[7px] text-[14px] font-medium text-white [&>option]:text-black">
              <option value="build">Construir</option><option value="chat">Conversar</option><option value="plan">Planejar</option>
            </select>
            <VoiceInputButton disabled={busy || !canCreate} onText={text => setPrompt(current => current ? current.trimEnd() + ' ' + text : text)}/>
            <button type="submit" disabled={busy || (!prompt.trim() && !files.length) || !canCreate} aria-label="Começar a construir"
              className="flex h-[36px] min-w-[36px] items-center justify-center gap-[6px] rounded-full bg-white px-[12px] text-[14px] font-semibold text-black hover:bg-white/90 disabled:opacity-30">
              {busy ? status || 'Começando…' : <span aria-hidden="true">↑</span>}
            </button>
          </div>
        </div>
      </form>
      {!canCreate && <p className="mt-[12px] text-[13px] text-white/80">Seu papel neste workspace permite apenas visualizar projetos.</p>}
      {error && <p role="alert" className="mt-[14px] rounded-md border border-red-200 bg-red-50 p-[12px] text-left text-[14px] text-red-800">{error}</p>}
      <div className="mt-[18px] flex flex-wrap justify-center gap-[8px]">
        {EXAMPLES.map(example => <button key={example} type="button" disabled={busy}
          onClick={() => { setPrompt(example); textarea.current?.focus(); }}
          className="rounded-full border border-white/20 bg-white/10 px-[14px] py-[7px] text-[13px] text-white backdrop-blur hover:bg-white/20 disabled:opacity-40">{example}</button>)}
      </div>
    </section>

    <section aria-label="Seus projetos e modelos" className="relative z-10 mx-auto max-w-[1240px] px-[12px] pb-[40px] md:px-[28px]">
      <div className="rounded-[24px] border border-white/10 bg-[#141418]/95 p-[14px] shadow-[0_-10px_40px_rgba(0,0,0,0.25)] md:p-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-[10px]">
          <div role="tablist" aria-label="Lista de projetos" className="flex flex-wrap items-center gap-[4px] rounded-[14px] border border-white/10 p-[4px]">
            <label className="flex items-center gap-[6px] px-[8px] text-white/60"><span aria-hidden="true">⌕</span><span className="sr-only">Buscar projetos</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar" className="w-[110px] bg-transparent py-[6px] text-[14px] text-white placeholder:text-white/50 focus:outline-none"/></label>
            {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`rounded-[10px] px-[12px] py-[7px] text-[14px] ${tab === id ? 'bg-white/10 font-medium text-white' : 'text-white/65 hover:text-white'}`}>{label}</button>)}
          </div>
          <Link href={tab === 'templates' ? '/templates' : '/projects'} className="text-[14px] text-white/85 hover:text-white">Ver tudo →</Link>
        </div>
        {tab === 'templates'
          ? <ul className="mt-[16px] grid gap-[12px] sm:grid-cols-2 lg:grid-cols-5">{STARTER_TEMPLATES.map(template => <li key={template.id}>
            <button type="button" disabled={busy || !canCreate} onClick={() => void startFromTemplate(template.id)} className="block h-full w-full rounded-[14px] border border-white/10 bg-white/5 p-[14px] text-left text-white hover:bg-white/10 disabled:opacity-50">
              <span className="block text-[15px] font-medium">{template.name}</span>
              <span className="mt-[6px] block text-[12px] leading-relaxed text-white/60">{template.description}</span>
            </button></li>)}</ul>
          : !projectsLoaded ? <p role="status" className="mt-[16px] text-[14px] text-white/60">Carregando…</p>
          : listed.length === 0 ? <p className="mt-[16px] text-[14px] text-white/60">{tab === 'favorites' ? 'Nenhum favorito ainda. Use a estrela nos projetos.' : search ? 'Nenhum projeto com esse nome.' : 'Nenhum projeto ainda. Descreva uma ideia acima para começar.'}</p>
          : <ul className="mt-[16px] grid gap-[12px] sm:grid-cols-2 lg:grid-cols-4">{listed.map(project => <li key={project.id} className="group relative">
            <Link href={'/projects/' + project.id} className="block overflow-hidden rounded-[14px] border border-white/10 bg-white/5 hover:bg-white/10">
              <div aria-hidden="true" className="flex h-[110px] items-center justify-center bg-gradient-to-br from-[#2b2f55] via-[#5b3d8f] to-[#c2456f] text-[28px] font-semibold text-white/85">{project.name.slice(0, 1).toUpperCase()}</div>
              <div className="p-[12px]"><p className="truncate text-[14px] font-medium">{project.name}</p><p className="mt-[4px] text-[12px] text-white/55">Editado {new Date(project.updated_at).toLocaleDateString('pt-BR')} · Revisão {project.version}</p></div>
            </Link>
            <button type="button" onClick={() => setFavorites(toggleFavorite(project.id))} aria-pressed={favorites.includes(project.id)} aria-label={favorites.includes(project.id) ? `Remover ${project.name} dos favoritos` : `Adicionar ${project.name} aos favoritos`}
              className={`absolute right-[8px] top-[8px] flex h-[30px] w-[30px] items-center justify-center rounded-full bg-black/40 text-[16px] ${favorites.includes(project.id) ? 'text-yellow-300' : 'text-white/80 opacity-0 group-hover:opacity-100 focus:opacity-100'}`}>★</button>
          </li>)}</ul>}
      </div>
    </section>
  </main></AppShell>;
}
