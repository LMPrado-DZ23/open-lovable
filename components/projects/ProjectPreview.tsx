"use client";
import {useEffect,useRef,useState} from 'react';

export default function ProjectPreview({id,version,runID,hasFiles}:{id:string;version:number;runID?:string;hasFiles:boolean}){
 const [html,setHTML]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[status,setStatus]=useState(''),[attempt,setAttempt]=useState(0);
 const frame=useRef<HTMLIFrameElement>(null);
 useEffect(()=>{
  if(!hasFiles){setHTML('');setError('');return;}
  const abort=new AbortController(),channel=crypto.randomUUID();setLoading(true);setHTML('');setError('');setStatus('');
  // Messages only inform the operator; they are not a security or functional test certificate.
  const onMessage=(event:MessageEvent)=>{if(event.source!==frame.current?.contentWindow||event.data?.channel!==channel||event.data?.source!=='open-lovable-preview')return;
   if(event.data.type==='error')setError(String(event.data.detail).slice(0,500));
   else if(event.data.type==='rendered')setStatus('Conteúdo renderizado. Verifique os fluxos antes de aprovar.');
   else if(event.data.type==='empty')setStatus('A aplicação não apresentou conteúdo visível.');
  };
  window.addEventListener('message',onMessage);
  void fetch('/api/projects?'+new URLSearchParams({id,action:'preview',channel,...(runID?{runID}:{})}),{cache:'no-store',signal:abort.signal}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível compilar a prévia.');return result as {html:string};}).then(result=>{if(!abort.signal.aborted)setHTML(result.html);}).catch(caught=>{if(!abort.signal.aborted)setError(caught instanceof Error?caught.message:'Não foi possível compilar a prévia.');}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
  return()=>{abort.abort();window.removeEventListener('message',onMessage);};
 },[id,version,runID,hasFiles,attempt]);
 if(!hasFiles)return <div className="flex min-h-[400px] flex-col items-center justify-center px-[24px] text-center"><p className="text-[20px] font-semibold">Seu projeto começa aqui</p><p className="mt-[12px] max-w-[390px] text-[14px] leading-relaxed text-[#6a6a63]">Descreva o que deseja construir ou importe um ZIP. Os arquivos e cada revisão ficam salvos no servidor.</p></div>;
 return <div className="min-w-0">
  <div className="flex flex-wrap items-center justify-between gap-[8px] border-b border-[#e3e3dd] bg-[#fafaf8] px-[18px] py-[12px] text-[12px] text-[#63635b]"><span>{runID?'Prévia da proposta — ainda não salva':'Prévia da revisão salva'} · JavaScript isolado; recursos externos restritos por CSP.</span><button type="button" disabled={loading} onClick={()=>setAttempt(value=>value+1)} className="underline underline-offset-4">Recarregar prévia</button></div>
  {loading&&<p role="status" className="p-[24px] text-[14px]">Compilando os arquivos do projeto…</p>}
  {error&&<p role="alert" className="m-[16px] break-words rounded-md border border-red-200 bg-red-50 p-[14px] text-[13px] text-red-800">{error}</p>}
  {html&&<iframe ref={frame} title="Prévia isolada" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={html} className="block min-h-[550px] w-full border-0 bg-white"/>}
  {status&&<p role="status" className="border-t border-[#e3e3dd] px-[18px] py-[12px] text-[12px] text-[#63635b]">{status}</p>}
 </div>;
}
