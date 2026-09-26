"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import AccountBar from '@/components/account/AccountBar';
import AIModelSelect from '@/components/AIModelSelect';
import {loadProject,projectRequest,zipAsBase64,type ProjectState} from '@/lib/projects/client';
import ProjectPreview from './ProjectPreview';
import ProjectCode from './ProjectCode';
import ProjectChanges from './ProjectChanges';
import ProjectImages from './ProjectImages';
import RunJournal from './RunJournal';
import PublishMenu from './PublishMenu';
import VoiceInputButton from '@/components/VoiceInputButton';
import ThemeToggle from '@/components/ThemeToggle';
import OpenLovableLogo from '@/components/brand/OpenLovableLogo';
import SecurityScan from './SecurityScan';
import SupabasePanel from './SupabasePanel';
import ConnectorsPanel from './ConnectorsPanel';
import ProjectComments from './ProjectComments';
import {enqueueRun,loadRuns} from '@/lib/runs/client';
import {useProjectImages} from '@/hooks/useProjectImages';
import {takeProjectDraft} from '@/lib/projects/draft';
import {autoApplyEnabled,consentRemembered,rememberConsent,setAutoApply} from '@/lib/projects/preferences';

const tabs=['Prévia','Código','Alterações','Histórico','Referências','Imagens','Plano','Execu\u00e7\u00f5es','Segurança','Supabase','Conectores','Comentários'] as const;
type Tab=typeof tabs[number];
const control='rounded-md border border-[#e3ded8] bg-white px-[10px] py-[7px] text-[12px] font-medium hover:bg-[#f7f4f1] disabled:opacity-40';
const phases:Record<string,string>={queued:'Na fila…',planning:'Lendo o projeto e planejando…',generating:'Escrevendo o código…',compiling:'Compilando e verificando…',repairing:'Corrigindo um problema encontrado…',approval:'Pronto para aplicar'};
const INSTRUCTIONS_NAME='Instruções do projeto.md';
// "Conversar" (Lovable's chat mode) is a read-only plan run that answers instead of proposing changes.
const CHAT_PREFIX='Responda de forma direta e clara, sem propor nem gerar alterações de código:\n\n';
const TEXT_ATTACHMENT=/\.(txt|md|json|csv|html?|css|jsx?|tsx?|mjs|svg|xml|ya?ml|sql)$/i;
const IMAGE_TYPES=['image/png','image/jpeg','image/webp'];
const states:Record<string,string>={QUEUED:'Na fila',RUNNING:'Em execução',AWAITING_APPROVAL:'Aguardando aprovação',SUCCEEDED:'Revisão aceita',FAILED:'Falhou',CANCELLED:'Cancelada',INTERRUPTED:'Interrompida'};
export default function ProjectWorkspace({id}:{id:string}){
 const [data,setData]=useState<ProjectState|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState<Tab>('Prévia');
 const [prompt,setPrompt]=useState(''),[model,setModel]=useState(''),[consent,setConsent]=useState(false),[phase,setPhase]=useState('');
 const {images,loading:imagesLoading,error:imagesError,reload:reloadImages}=useProjectImages(id);
 const [mode,setMode]=useState<'build'|'plan'|'chat'>('build'),[selectedImages,setSelectedImages]=useState<string[]>([]),[visionConfirmed,setVisionConfirmed]=useState(false);
 const selectImages=(ids:string[])=>{setSelectedImages(ids);setVisionConfirmed(false);setConsent(false);};
 const router=useRouter();
 const [autoApply,setAutoApplyState]=useState<boolean|null>(null),[keepConsent,setKeepConsent]=useState(false),[uploading,setUploading]=useState(false),[instructions,setInstructions]=useState<string|null>(null);
 useEffect(()=>{setAutoApplyState(autoApplyEnabled());setKeepConsent(consentRemembered(id));},[id]);
 const applied=useRef(new Set<string>());
 const [livePhase,setLivePhase]=useState('');
 const [usage,setUsage]=useState<{tokens:number;runs:number}|null>(null);
 const [liveText,setLiveText]=useState('');
 const usageKey=data?.runs.map(run=>run.id+':'+run.state).join('|');
 // Provider-reported token usage across this project's runs (Lovable shows credits; here it is real token counts).
 useEffect(()=>{if(!usageKey)return;const controller=new AbortController();void loadRuns(id,controller.signal).then(result=>{if(controller.signal.aborted)return;let tokens=0,runs=0;for(const run of result.runs){const total=Number((run.usage as Record<string,unknown>)?.totalTokens??0)||(Number((run.usage as Record<string,unknown>)?.inputTokens??0)+Number((run.usage as Record<string,unknown>)?.outputTokens??0));if(total>0){tokens+=total;runs++;}}setUsage({tokens,runs});}).catch(()=>{});return()=>controller.abort();},[usageKey,id]);
 // A request typed on the home screen arrives here pre-filled; cost consent is still asked explicitly.
 useEffect(()=>{const draft=takeProjectDraft(id);if(!draft)return;setPrompt(draft.prompt);if(draft.mode==='plan')setMode('plan');if(draft.imageIDs.length)setSelectedImages(draft.imageIDs);},[id]);
 const submitted=useRef<string|null>(null);const active=useRef<AbortController|null>(null);const sequence=useRef(0);
 const reload=useCallback(async(signal?:AbortSignal)=>{const request=++sequence.current;const state=await loadProject(id,signal);if(!signal?.aborted&&request===sequence.current){setData(state);setModel(current=>current||state.project.model);}return state;},[id]);
 useEffect(()=>{const controller=new AbortController();void reload(controller.signal).catch(caught=>{if(!controller.signal.aborted)setError(caught.message);});return()=>{controller.abort();active.current?.abort();};},[reload]);
 const pending=data?.runs.find(run=>run.state==='QUEUED'||run.state==='RUNNING'||run.state==='AWAITING_APPROVAL');
 useEffect(()=>{if(keepConsent&&!consent&&!busy)setConsent(true);},[keepConsent,consent,busy]);
 // The model's answer appears in the chat while it is being written, like Lovable.
 useEffect(()=>{
  if(pending?.state!=='RUNNING'){setLiveText('');return;}
  const controller=new AbortController(),runID=pending.id;
  const tick=()=>void fetch('/api/projects?'+new URLSearchParams({id,action:'live',runID}),{cache:'no-store',signal:controller.signal}).then(response=>response.ok?response.json():null).then(result=>{if(result&&!controller.signal.aborted&&typeof result.text==='string')setLiveText(result.text);}).catch(()=>{});
  tick();const timer=setInterval(tick,1200);return()=>{clearInterval(timer);controller.abort();};
 },[pending?.state,pending?.id,id]);
 useEffect(()=>{if(pending?.state!=='RUNNING'&&pending?.state!=='QUEUED'){setLivePhase('');return;}const controller=new AbortController();const runID=pending.id;
  // The chat shows the worker's current step (planning, writing, compiling) while the run is live.
  const poll=()=>{void reload(controller.signal).catch(caught=>{if(!controller.signal.aborted)setError(caught.message);});void loadRuns(id,controller.signal).then(result=>{if(!controller.signal.aborted)setLivePhase(result.runs.find(run=>run.id===runID)?.phase||'');}).catch(()=>{});};
  poll();const timer=setInterval(poll,2500);return()=>{clearInterval(timer);controller.abort();};},[pending?.state,pending?.id,reload,id]);
 async function mutate(body:unknown,message:string){setBusy(true);setError('');setNotice('');try{const result=await projectRequest<{excluded?:string[]}>(body);await reload();setNotice(message+(result.excluded?.length?` ${result.excluded.length} arquivo(s) sensível(is) ou de build excluído(s) da importação.`:''));}catch(caught){setError(caught instanceof Error?caught.message:'Operação não concluída.');}finally{setBusy(false);}}
 useEffect(()=>{
  const run=data?.runs.find(item=>item.id===submitted.current);if(!run||['QUEUED','RUNNING'].includes(run.state))return;
  submitted.current=null;
  if(run.state==='AWAITING_APPROVAL'){setNotice('Proposta compilada. Revise o resultado antes de aprovar.');setTab('Pr\u00e9via');}
  else if(run.state==='SUCCEEDED'&&run.inputs.mode==='plan'){setNotice('Plano salvo. Nenhum arquivo foi alterado.');setTab('Plano');}
  else if(run.state==='FAILED'||run.state==='INTERRUPTED')setError(run.error||'Execu\u00e7\u00e3o interrompida. A revis\u00e3o salva foi preservada.');
 },[data]);
 async function generate(event?:React.FormEvent,override?:string){
  event?.preventDefault();const text=(override??prompt).trim();if(!data||busy||pending||!consent||!text||(selectedImages.length>0&&!visionConfirmed))return;
  const controller=new AbortController();active.current=controller;setBusy(true);setError('');setNotice('');setPhase('Admitindo pedido\u2026');
  try{
   const {run}=await enqueueRun({projectId:id,baseVersion:data.project.version,requestKey:crypto.randomUUID(),prompt:mode==='chat'?CHAT_PREFIX+text:text,model,mode:mode==='build'?'build':'plan',imageIDs:selectedImages,confirmCost:consent,confirmVision:visionConfirmed},controller.signal);
   submitted.current=run.id;setPrompt('');setNotice('Pedido salvo no servidor. Voc\u00ea pode fechar esta aba e acompanhar depois.');
  }catch(caught){if(!controller.signal.aborted)setError(caught instanceof Error?caught.message:'Admiss\u00e3o n\u00e3o confirmada. Recarregue o projeto antes de tentar novamente.');}
  finally{active.current=null;if(!controller.signal.aborted){setBusy(false);setConsent(false);setPhase('');await reload().catch(caught=>setError(caught.message));}}
 }
 async function cancel(){if(!pending)return;try{await projectRequest({action:'cancel',id,runID:pending.id});active.current?.abort();await reload();setNotice('Proposta descartada; a revisão salva foi preservada.');}catch(caught){setError(caught instanceof Error?caught.message:'Não foi possível cancelar.');}}
 async function importZip(file:File|undefined){if(!file||!data||busy||pending)return;if(Object.keys(data.project.snapshot.files).length&&!window.confirm('Importar como uma nova revisão? A versão atual continuará no histórico.'))return;try{const archive=await zipAsBase64(file);await mutate({action:'import',id,version:data.project.version,archive},'Projeto importado e salvo.');setTab('Prévia');}catch(caught){setError(caught instanceof Error?caught.message:'Não foi possível ler o ZIP.');}}
 async function reference(file:File|undefined){if(!file||!data)return;if(!TEXT_ATTACHMENT.test(file.name)||file.size>200000){setError('Use um arquivo de texto ou código (TXT, MD, JSON, CSV, HTML, CSS, JS, TS) de até 200 KB.');return;}try{await mutate({action:'document',id,name:file.name,content:await file.text()},'Referência salva no projeto.');}catch(caught){setError(caught instanceof Error?caught.message:'Não foi possível ler a referência.');}}
 async function saveVisualPatch(path:string,content:string){if(!data)return;const previous=data.project.snapshot.files[path];if(previous===undefined){await mutate({action:'patch',id,version:data.project.version,baseRevision:String(data.project.version),operations:[{kind:'create',path,content}],expectedHashes:{}},'Edição visual salva como uma nova revisão.');return;}const bytes=new TextEncoder().encode(previous),digestBuffer=await crypto.subtle.digest('SHA-256',bytes),expected=Array.from(new Uint8Array(digestBuffer),value=>value.toString(16).padStart(2,'0')).join('');await mutate({action:'patch',id,version:data.project.version,baseRevision:String(data.project.version),operations:[{kind:'update',path,content}],expectedHashes:{[path]:expected}},'Edição visual salva como uma nova revisão.');}
 function prepareRepair(){const failed=data?.runs.find(run=>run.state==='FAILED'||run.state==='INTERRUPTED');if(!failed)return;setPrompt(`Corrija a falha da execução anterior sem apagar a revisão salva. Pedido original: ${failed.error||'A execução falhou durante a validação.'}`);setConsent(false);setTab('Prévia');setNotice('Reparo preparado como uma nova execução. Revise o pedido e autorize o consumo antes de enviar.');}
 // Lovable applies a compiled change right away; the revision history keeps every earlier version.
 useEffect(()=>{
  const ready=data?.runs.find(run=>run.state==='AWAITING_APPROVAL'&&run.candidate);
  if(autoApply!==true||!ready||!data||busy||data.permissions?.write===false||applied.current.has(ready.id)||ready.base_version!==data.project.version)return;
  applied.current.add(ready.id);
  void mutate({action:'accept',id,version:data.project.version,runID:ready.id},`Alteração aplicada (revisão ${data.project.version+1}). Use "Desfazer" para voltar.`).then(()=>setTab('Prévia'));
 },[autoApply,data,busy]);// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(data&&instructions===null)setInstructions(data.documents.find(document=>document.name===INSTRUCTIONS_NAME)?.content??'');},[data,instructions]);
 async function undo(){
  if(!data)return;const previous=[...data.revisions].filter(revision=>revision.version<data.project.version).sort((a,b)=>b.version-a.version)[0];if(!previous)return;
  await mutate({action:'restore',id,version:data.project.version,revisionID:previous.id},`Desfeito: o projeto voltou ao conteúdo da revisão ${previous.version}. Nada foi apagado do histórico.`);
  setTab('Prévia');
 }
 async function duplicate(){
  if(!data||busy)return;setBusy(true);setError('');
  try{
   const {project:copy}=await projectRequest<{project:{id:string;version:number}}>({action:'create',name:('Cópia de '+data.project.name).slice(0,120),model:model||data.project.model});
   if(Object.keys(data.project.snapshot.files).length){
    const response=await fetch('/api/projects?id='+encodeURIComponent(id)+'&action=export',{cache:'no-store'});
    if(!response.ok)throw new Error('Não foi possível copiar os arquivos do projeto.');
    const archive=await zipAsBase64(new File([await response.blob()],'projeto.zip',{type:'application/zip'}));
    await projectRequest({action:'import',id:copy.id,version:copy.version,archive});
   }
   router.push('/projects/'+copy.id);
  }catch(caught){setError(caught instanceof Error?caught.message:'Não foi possível duplicar o projeto.');setBusy(false);}
 }
 async function saveAsTemplate(){
  if(!data)return;const name=window.prompt('Nome do modelo privado (fica só neste computador):',data.project.name);if(!name?.trim())return;
  try{await projectRequest({action:'templateSave',id,name:name.trim().slice(0,80)});setNotice(`Modelo "${name.trim()}" salvo em Modelos, só neste computador.`);}catch(caught){setError(caught instanceof Error?caught.message:'Não foi possível salvar o modelo.');}
 }
 async function attachImage(file?:File){
  if(!file||!data)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('Anexe uma imagem PNG, JPEG ou WebP de até 5 MB.');return;}
  setUploading(true);setError('');
  try{
   const data64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Falha ao ler a imagem.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file);});
   const response=await fetch('/api/project-images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'upload',projectID:id,name:file.name.slice(0,160)||'imagem.png',role:'target',data:data64})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'Falha ao enviar a imagem.');
   await reloadImages();selectImages([...selectedImages,result.image.id].slice(-4));setNotice('Imagem anexada ao próximo pedido.');
  }catch(caught){setError(caught instanceof Error?caught.message:'Falha ao anexar a imagem.');}
  finally{setUploading(false);}
 }
 /** One attach button, like Lovable: images feed the request, a ZIP imports code, text files become context. */
 async function attachFiles(list:FileList|null){
  for(const file of Array.from(list||[])){
   if(IMAGE_TYPES.includes(file.type))await attachImage(file);
   else if(/\.zip$/i.test(file.name))await importZip(file);
   else if(TEXT_ATTACHMENT.test(file.name))await reference(file);
   else setError(`Não é possível anexar "${file.name}". Use imagem (PNG, JPEG, WebP), ZIP de código ou arquivo de texto/código.`);
  }
 }
 function sendOrPrepare(text:string,prepared:string){
  if(consent&&!pending&&!busy){setMode('build');void generate(undefined,text);return;}
  setPrompt(text);setMode('build');setNotice(prepared);
 }
 function fixError(message:string){sendOrPrepare(`A prévia do app mostra o erro abaixo. Encontre a causa e corrija, sem remover funcionalidades que já existem.\n\nErro: ${message}`,'Pedido de correção preparado no chat. Autorize e envie.');}
 function askElement(selection:{file:string;start:number;tag:string},request:string){sendOrPrepare(`Altere somente o elemento <${selection.tag}> do arquivo ${selection.file} (posição ${selection.start} no código). Pedido: ${request}\nNão altere outras partes da página.`,'Pedido para o elemento preparado no chat. Autorize e envie.');}
 if(!data)return <main className="min-h-screen bg-[#f7f7f5] p-[28px]"><Link href="/projects" className="text-[14px] underline">Voltar aos projetos</Link>{error?<p role="alert" className="mt-[24px] text-red-800">{error}</p>:<p role="status" className="mt-[24px]">Abrindo projeto salvo…</p>}</main>;
 const lastPlan=data.runs.find(run=>run.inputs?.mode==='plan'&&run.state==='SUCCEEDED');
 const referenceImage=images.find(image=>selectedImages.includes(image.id)&&image.role==='target')||images.find(image=>selectedImages.includes(image.id));
 const project=data.project,candidate=pending?.state==='AWAITING_APPROVAL'?pending:null;
 const readOnly=data.permissions?.write===false;
 const locked=busy||Boolean(pending)||readOnly;
 return <main className="flex min-h-screen flex-col bg-[#f5f5f1] text-[#272721] lg:h-screen lg:overflow-hidden">
  <AccountBar workspaceId={project.workspaceId}/>
  <header className="flex min-h-[56px] shrink-0 flex-wrap items-center justify-between gap-[10px] border-b border-[#e6e1dc] bg-[#fdfcfb] px-[12px] py-[8px]">
   <div className="flex min-w-0 items-center gap-[10px]"><Link href="/" aria-label="Open Lovable, início"><OpenLovableLogo size={26} withWordmark={false}/></Link><Link href="/projects" className="hidden text-[13px] text-[#77767f] hover:underline sm:inline">Projetos</Link><span aria-hidden="true" className="text-[#c9c4bf]">/</span><h1 className="truncate text-[15px] font-semibold">{project.name}</h1><span data-testid="project-version" className="shrink-0 rounded-full bg-[#f1ece7] px-[8px] py-[2px] text-[11px] text-[#6f6c75]">Revisão {project.version}</span></div>
   <div className="flex flex-wrap items-center gap-[6px]"><button type="button" onClick={()=>void undo()} disabled={locked||project.version<2} title="Voltar para a versão anterior" className={control}>Desfazer</button><button type="button" onClick={()=>void duplicate()} disabled={busy} className={control}>Duplicar</button>{data.profile!=='supabase'&&<button type="button" onClick={()=>void saveAsTemplate()} disabled={busy||!Object.keys(project.snapshot.files).length} className={control}>Salvar como modelo</button>}<label className={`${control} cursor-pointer ${locked?'opacity-40':''}`}>Importar ZIP<input type="file" aria-label="Importar ZIP" accept=".zip" disabled={locked} className="sr-only" onChange={event=>{void importZip(event.target.files?.[0]);event.currentTarget.value='';}}/></label><a href={'/api/projects?id='+encodeURIComponent(id)+'&action=export'} download className={control}>Baixar ZIP</a><Link href={'/settings/ai?projectId='+encodeURIComponent(id)} className={control}>Conexões de IA</Link><ThemeToggle/><PublishMenu projectId={id} projectName={project.name} disabled={readOnly||!Object.keys(project.snapshot.files).length}/></div>
  </header>
  <div className="flex min-h-0 flex-1 flex-col">
   {error&&<p role="alert" className="mb-[16px] break-words rounded-md border border-red-200 bg-red-50 p-[14px] text-[13px] text-red-800">{error}</p>}
   {readOnly&&<p className="mb-4 border-l-2 border-[#a5a595] pl-3 text-sm text-[#717166]">Acesso de visualização: alterações e gerações estão desabilitadas.</p>}
   {notice&&<p role="status" className="mb-[16px] rounded-md border border-[#cbd6c3] bg-[#f3f7ee] p-[14px] text-[13px] text-[#3c5030]">{notice}</p>}
   <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)]">
    <aside className="flex min-h-0 min-w-0 flex-col border-r border-[#e6e1dc] bg-white lg:overflow-y-auto">
     <div className="border-b border-[#eeeae5] px-[16px] py-[10px]"><h2 className="text-[14px] font-semibold">Conversa do projeto</h2></div>
     <div aria-live="polite" className="min-h-[160px] flex-1 space-y-[16px] overflow-y-auto p-[16px]">{data.messages.length?data.messages.map(message=><div key={message.id} className={message.role==='user'?'ml-[36px] rounded-[16px] rounded-br-[4px] bg-[#f1ece7] px-[14px] py-[10px]':'mr-[12px]'}><p className="mb-[4px] text-[10px] font-semibold uppercase tracking-widest text-[#8a8792]">{message.role==='user'?'Você':'Assistente'}</p><p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#3f3d47]">{message.content}</p></div>):<p className="text-[13px] leading-relaxed text-[#77776b]">Descreva uma ideia para começar ou importe o código existente. A IA escreve o código e a prévia aparece ao lado.</p>}
      {pending&&<div className="mr-[12px]"><p className="mb-[5px] text-[10px] font-semibold uppercase tracking-widest text-[#a6471f]">Assistente</p><p role="status" className="flex items-center gap-[8px] text-[13px] text-[#53534a]"><span aria-hidden="true" className="inline-block h-[8px] w-[8px] animate-pulse rounded-full bg-[#a6471f]"/>{phases[livePhase]||states[pending.state]||'Trabalhando…'}</p>{liveText&&<p data-testid="live-text" className="mt-[8px] max-h-[260px] overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#53534a]">{liveText}</p>}</div>}</div>
     <form onSubmit={generate} className="border-t border-[#e5e5dc] p-[12px]">
      <div className="rounded-[18px] border border-[#e3ded8] bg-[#fbfaf8] p-[8px] focus-within:border-[#f4583a]">
       <label htmlFor="project-prompt" className="sr-only">Descreva a alteração</label>
       <textarea id="project-prompt" value={prompt} onChange={event=>setPrompt(event.target.value)} disabled={locked} maxLength={32768} rows={3}
        onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit();}}}
        placeholder={mode==='chat'?'Pergunte algo sobre o projeto…':mode==='plan'?'Descreva o que quer planejar…':'Peça ao Open Lovable para criar ou mudar algo…'}
        className="block max-h-[240px] w-full resize-none bg-transparent p-[6px] text-[14px] leading-relaxed placeholder:text-[#9a97a3] focus:outline-none"/>
       {selectedImages.length>0&&<p className="px-[6px] pb-[4px] text-[11px] text-[#717166]">{selectedImages.length} imagem(ns) no pedido · <button type="button" onClick={()=>setTab('Imagens')} className="underline">ver</button> · <button type="button" onClick={()=>selectImages([])} className="underline">remover</button></p>}
       <div className="flex items-center gap-[6px] pt-[4px]">
        <label title="Anexar imagem, ZIP de código ou arquivo de texto/código" className={`flex h-[32px] w-[32px] cursor-pointer items-center justify-center rounded-full border border-[#e3ded8] text-[18px] leading-none hover:bg-[#f1ece7] ${locked||uploading?'pointer-events-none opacity-40':''}`}>{uploading?'…':'+'}<input type="file" multiple aria-label="Anexar arquivos ao pedido" accept="image/png,image/jpeg,image/webp,.zip,.txt,.md,.json,.csv,.html,.htm,.css,.js,.jsx,.ts,.tsx,.mjs,.svg,.xml,.yml,.yaml,.sql" disabled={locked||uploading} className="sr-only" onChange={event=>{void attachFiles(event.target.files);event.currentTarget.value='';}}/></label>
        <VoiceInputButton disabled={locked} onText={text=>setPrompt(current=>current?current.trimEnd()+' '+text:text)} className="flex h-[32px] w-[32px] items-center justify-center rounded-full border border-[#e3ded8] hover:bg-[#f1ece7] aria-pressed:bg-red-500 aria-pressed:text-white disabled:opacity-30"/>
        <span className="flex-1"/>
        <label htmlFor="project-mode" className="sr-only">Modo da solicitação</label>
        <select id="project-mode" value={mode} onChange={event=>{setMode(event.target.value as 'build'|'plan'|'chat');setConsent(false);}} disabled={locked} className="rounded-full border border-[#e3ded8] bg-white px-[8px] py-[6px] text-[12px] font-medium"><option value="build">Construir</option><option value="chat">Conversar</option><option value="plan">Planejar</option></select>
        <button type="submit" disabled={locked||!consent||!prompt.trim()||!model||(selectedImages.length>0&&!visionConfirmed)} className="rounded-full bg-[#1c1b22] px-[12px] py-[7px] text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30">{phase||(mode==='plan'?'Gerar plano':mode==='chat'?'Perguntar':'Gerar proposta')}</button>
       </div>
      </div>
      <div className="mt-[10px] flex items-center gap-[8px]"><label htmlFor="project-model" className="shrink-0 text-[11px] font-medium text-[#6c6c62]">Modelo do projeto</label><div id="project-model" className="min-w-0 flex-1"><AIModelSelect projectId={id} label="Modelo do projeto" value={model} onValueChange={value=>{setModel(value);setVisionConfirmed(false);setConsent(false);}} disabled={locked} className="w-full min-w-0 rounded-md border border-[#e3ded8] bg-white px-[8px] py-[6px] text-[12px]"/></div></div>
      <label className="mt-[8px] flex items-start gap-[8px] text-[11px] leading-snug text-[#6c6c62]"><input type="checkbox" aria-label="Autorizar consumo de tokens para esta geração" checked={consent} onChange={event=>setConsent(event.target.checked)} disabled={locked} className="mt-[1px] shrink-0"/><span>Autorizo enviar o contexto ao modelo e consumir tokens neste pedido.</span></label>
      <label className="mt-[6px] flex items-start gap-[8px] text-[11px] leading-snug text-[#6c6c62]"><input type="checkbox" checked={keepConsent} disabled={readOnly} onChange={event=>{setKeepConsent(event.target.checked);rememberConsent(id,event.target.checked);if(!event.target.checked)setConsent(false);}} className="mt-[1px] shrink-0"/><span>Lembrar a autorização neste projeto.</span></label>
      <label className="mt-[6px] flex items-start gap-[8px] text-[11px] leading-snug text-[#6c6c62]"><input type="checkbox" checked={autoApply===true} onChange={event=>{setAutoApplyState(event.target.checked);setAutoApply(event.target.checked);}} className="mt-[1px] shrink-0"/><span>Aplicar alterações automaticamente (dá para desfazer).</span></label>
      {selectedImages.length>0&&<label className="mt-[6px] flex items-start gap-[8px] text-[11px] leading-snug text-[#6c6c62]"><input type="checkbox" aria-label="Confirmo suporte a imagens no modelo escolhido" checked={visionConfirmed} disabled={locked} onChange={event=>setVisionConfirmed(event.target.checked)} className="mt-[1px] shrink-0"/><span>Confirmo que o modelo escolhido aceita imagens.</span></label>}
     </form>
     {!readOnly&&(pending?.state==='RUNNING'||pending?.state==='QUEUED')&&<div className="border-t border-[#e5e5dc] p-[20px]"><p role="status" className="text-[12px]">Geração em execução. Sua revisão salva permanece intacta.</p><button type="button" onClick={()=>void cancel()} className="mt-[12px] text-[12px] underline">Cancelar geração</button></div>}
     {usage&&usage.runs>0&&<p className="border-t border-[#e5e5dc] px-[20px] py-[10px] text-[11px] text-[#77776b]">Uso neste projeto: <strong>{usage.tokens.toLocaleString('pt-BR')}</strong> tokens em {usage.runs} geração(ões), conforme informado pelos provedores.</p>}
     {data.runs[0]&&!pending&&<div className="border-t border-[#e5e5dc] px-[20px] py-[14px] text-[11px] text-[#77776b]"><p>Última execução: {data.runs[0].inputs?.mode==='plan'&&data.runs[0].state==='SUCCEEDED'?'Plano salvo':states[data.runs[0].state]||data.runs[0].state}.</p>{(data.runs[0].state==='FAILED'||data.runs[0].state==='INTERRUPTED')&&!readOnly&&<button type="button" onClick={prepareRepair} className="mt-[8px] text-[12px] font-medium text-[#a6471f] underline">Preparar reparo como nova execução</button>}</div>}
    </aside>
    <section className="flex min-h-0 min-w-0 flex-col bg-white" aria-label="Workspace do projeto">
     {candidate&&<div className="border-b border-[#dfc8a6] bg-[#fff7ea] p-[20px]"><div className="flex flex-wrap items-start justify-between gap-[16px]"><div className="max-w-[620px]"><h2 className="text-[16px] font-semibold">Uma proposta aguarda sua revisão</h2><p className="mt-[7px] text-[12px] leading-relaxed text-[#77684f]">Os arquivos compilaram, mas isso não certifica os fluxos do aplicativo. Teste a prévia e confira as alterações. Nada foi sobrescrito.</p></div><div className="flex flex-wrap gap-[8px]"><button type="button" disabled={busy||readOnly} onClick={()=>void mutate({action:'accept',id,version:project.version,runID:candidate.id},'Nova revisão aprovada e salva.')} className="rounded-md bg-[#272721] px-[16px] py-[11px] text-[12px] font-medium text-white disabled:opacity-40">Aprovar revisão</button><button type="button" disabled={busy||readOnly} onClick={()=>void cancel()} className={control}>Descartar proposta</button></div></div></div>}
     <div role="tablist" aria-label="Visualizações do projeto" className="flex shrink-0 gap-[4px] overflow-x-auto border-b border-[#eeeae5] bg-[#fdfcfb] px-[10px] py-[6px]">{tabs.map((label,index)=><button key={label} id={'project-tab-'+index} type="button" role="tab" aria-selected={tab===label} aria-controls={'project-panel-'+index} tabIndex={tab===label?0:-1} onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const next=(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;setTab(tabs[next]);document.getElementById('project-tab-'+next)?.focus();}}} onClick={()=>setTab(label)} className={`whitespace-nowrap rounded-full px-[12px] py-[6px] text-[12px] font-medium ${tab===label?'bg-[#1c1b22] text-white':'text-[#6f6c75] hover:bg-[#f1ece7]'}`}>{label}</button>)}</div>
     <div role="tabpanel" id={'project-panel-'+tabs.indexOf(tab)} aria-labelledby={'project-tab-'+tabs.indexOf(tab)} className="min-h-0 flex-1 overflow-y-auto">
      {tab==='Prévia'&&<ProjectPreview reference={referenceImage} id={id} version={project.version} runID={candidate?.id} hasFiles={Object.keys(candidate?.candidate?.files||project.snapshot.files).length>0} busy={locked} onFix={readOnly?undefined:fixError} onAskElement={readOnly?undefined:askElement}/>}
      {tab==='Código'&&<ProjectCode snapshot={project.snapshot} busy={locked} onSave={async(path,content)=>{await saveVisualPatch(path,content);}}/>}
      {tab==='Alterações'&&<ProjectChanges saved={project.snapshot} candidate={candidate?.candidate||null}/>}
      {tab==='Histórico'&&<div className="min-h-[430px] p-[22px]"><h2 className="mb-[8px] text-[17px] font-semibold">Histórico de revisões</h2><p className="mb-[24px] text-[13px] text-[#727266]">Restaurar cria uma nova revisão; as versões anteriores não são apagadas.</p><ol className="divide-y divide-[#e3e3d9]">{data.revisions.map(revision=><li key={revision.id} className="flex flex-wrap items-center justify-between gap-[14px] py-[16px]"><div className="min-w-0"><h3 className="text-[13px] font-medium">Revisão {revision.version} · {revision.label}</h3><p className="mt-[6px] text-[11px] text-[#77776b]">{new Date(revision.created_at).toLocaleString('pt-BR')}</p></div>{revision.version!==project.version&&<button type="button" disabled={locked} onClick={()=>{if(window.confirm('Restaurar esta versão como uma nova revisão?'))void mutate({action:'restore',id,version:project.version,revisionID:revision.id},'Versão restaurada sem apagar o histórico.');}} className={control}>Restaurar revisão {revision.version}</button>}</li>)}</ol></div>}
      {tab==='Segurança'&&<SecurityScan projectId={id} version={project.version} onFix={readOnly?undefined:text=>{setTab('Prévia');sendOrPrepare(text,'Pedido de correção de segurança preparado no chat. Autorize e envie.');}}/>}
      {tab==='Supabase'&&<SupabasePanel projectId={id} version={project.version} locked={locked} onSaved={()=>reload()} onAsk={readOnly?undefined:text=>{setTab('Prévia');sendOrPrepare(text,'Pedido preparado no chat. Autorize e envie.');}}/>}
      {tab==='Conectores'&&<ConnectorsPanel projectId={id} version={project.version} locked={locked} onSaved={()=>reload()} onAsk={readOnly?undefined:text=>{setTab('Prévia');sendOrPrepare(text,'Pedido preparado no chat. Autorize e envie.');}}/>}
      {tab==='Comentários'&&<ProjectComments projectId={id} files={Object.keys(project.snapshot.files).sort()} readOnly={readOnly}/>}
      {tab==='Imagens'&&<ProjectImages id={id} images={images} selected={selectedImages} onSelection={selectImages} reload={reloadImages} locked={locked} loading={imagesLoading} loadError={imagesError}/>}
      {tab==='Execu\u00e7\u00f5es'&&<RunJournal projectId={id} refreshKey={data.runs[0]?.id+':'+data.runs[0]?.updated_at}/>}
      {tab==='Plano'&&<div className="min-h-[430px] p-[22px]"><h2 className="text-[17px] font-semibold">Plano antes do código</h2><p className="mb-[20px] mt-[10px] text-[13px] leading-relaxed text-[#727266]">O modo Planejar registra uma proposta de trabalho sem alterar os arquivos. Uma construção posterior exige outra autorização.</p>{lastPlan?<><pre className="max-h-[620px] overflow-auto whitespace-pre-wrap break-words text-[13px] leading-relaxed">{lastPlan.explanation}</pre><button type="button" disabled={locked||lastPlan.base_version!==project.version} onClick={()=>{const text='Implemente o plano abaixo, preservando os arquivos existentes:\n\n'+lastPlan.explanation;if(text.length>32768){setError('O plano excede o limite do pedido. Selecione uma etapa menor.');return;}setPrompt(text);setMode('build');setConsent(false);setNotice('Plano copiado para o pedido. Revise e autorize antes de construir.');}} className={control+' mt-[22px]'}>Usar plano em nova solicitação</button>{lastPlan.base_version!==project.version&&<p className="mt-[12px] text-[12px] text-[#7c5e30]">O projeto mudou desde este plano. Peça um novo planejamento antes de construir.</p>}</>:<p className="text-[13px] text-[#77776b]">Selecione Planejar no formulário para discutir a mudança antes de gerar código.</p>}</div>}
      {tab==='Referências'&&<div className="min-h-[430px] p-[22px]"><section aria-labelledby="instructions-heading" className="mb-[28px] rounded-md border border-[#e3e3d9] bg-[#fbfbf7] p-[16px]"><h2 id="instructions-heading" className="text-[17px] font-semibold">Instruções do projeto</h2><p className="mb-[12px] mt-[6px] max-w-[680px] text-[13px] leading-relaxed text-[#727266]">Regras que a IA segue em todos os pedidos deste projeto: estilo, cores, idioma, tecnologias, o que nunca mudar. Equivale ao "Knowledge" do Lovable.</p><label htmlFor="project-instructions" className="sr-only">Instruções do projeto</label><textarea id="project-instructions" value={instructions??''} onChange={event=>setInstructions(event.target.value)} disabled={locked} rows={6} maxLength={200000} placeholder="Ex.: Use sempre português do Brasil. Cores da marca: #1f6feb e #ffffff. Botões arredondados. Não altere o rodapé." className="w-full resize-y rounded-md border border-[#cecec2] bg-white p-[12px] text-[13px] leading-relaxed"/><button type="button" disabled={locked||instructions===null} onClick={()=>void mutate({action:'instructions',id,content:instructions??''},'Instruções do projeto salvas. Elas valem para os próximos pedidos.')} className={control+' mt-[10px]'}>Salvar instruções</button></section><h2 className="text-[17px] font-semibold">Referências do projeto</h2><p className="mb-[22px] mt-[10px] max-w-[650px] text-[13px] leading-relaxed text-[#727266]">Adicione requisitos e decisões em TXT, MD, JSON ou CSV. Estes documentos são enviados como contexto quando você autoriza uma geração. Não inclua senhas ou dados pessoais desnecessários.</p><label className={`${control} inline-block cursor-pointer`}>Adicionar referência<input type="file" aria-label="Adicionar referência" accept=".txt,.md,.json,.csv,.html,.htm,.css,.js,.jsx,.ts,.tsx,.mjs,.svg,.xml,.yml,.yaml,.sql" disabled={locked} className="sr-only" onChange={event=>{void reference(event.target.files?.[0]);event.currentTarget.value='';}}/></label><div className="mt-[26px] divide-y divide-[#e3e3d9]">{data.documents.filter(document=>document.name!==INSTRUCTIONS_NAME).map(document=><details key={document.id} className="py-[14px]"><summary className="cursor-pointer text-[13px] font-medium">{document.name}</summary><pre className="mt-[12px] max-h-[300px] overflow-auto whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[#727266]">{document.content}</pre></details>)}</div>{!data.documents.some(document=>document.name!==INSTRUCTIONS_NAME)&&<p className="mt-[22px] text-[13px] text-[#77776b]">Nenhuma referência adicionada.</p>}</div>}
     </div>
    </section>
   </div>
  </div>
 </main>;
}
