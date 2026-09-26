"use client";
import {useCallback, useEffect, useState} from 'react';
import {projectRequest} from '@/lib/projects/client';
import type {ProjectComment} from '@/lib/collaboration/project-comments';

/** Team notes on the project, optionally tied to a file, with resolve/reopen. */
export default function ProjectComments({projectId, files, readOnly}: {projectId: string; files: string[]; readOnly: boolean}) {
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [me, setMe] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/projects?' + new URLSearchParams({id: projectId, action: 'comments'}), {cache: 'no-store', signal});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os comentários.');
    if (!signal?.aborted) { setComments(data.comments); setMe(data.actorId); }
  }, [projectId]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal).catch(caught => { if (!controller.signal.aborted) setError(caught.message); }); return () => controller.abort(); }, [load]);

  async function send(event: React.FormEvent) {
    event.preventDefault(); if (!body.trim()) return;
    setBusy(true); setError('');
    try { const result = await projectRequest<{comments: ProjectComment[]}>({action: 'comment', id: projectId, body, ...(file ? {file} : {})}); setComments(result.comments); setBody(''); setFile(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível comentar.'); }
    finally { setBusy(false); }
  }
  async function toggle(comment: ProjectComment) {
    setBusy(true); setError('');
    try { const result = await projectRequest<{comments: ProjectComment[]}>({action: 'commentResolve', id: projectId, commentId: comment.id, resolved: !comment.resolved}); setComments(result.comments); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar.'); }
    finally { setBusy(false); }
  }

  const visible = comments.filter(comment => showResolved || !comment.resolved).slice().reverse();
  return <div className="min-h-[430px] p-[22px]">
    <h2 className="text-[17px] font-semibold">Comentários</h2>
    <p className="mb-[16px] mt-[8px] max-w-[680px] text-[13px] leading-relaxed text-[#727266]">Anotações da equipe sobre o projeto: ideias, pendências e revisões. Não são enviadas à IA.</p>
    {error && <p role="alert" className="mb-[12px] rounded-md border border-red-200 bg-red-50 p-[12px] text-[13px] text-red-800">{error}</p>}
    {!readOnly && <form onSubmit={send} className="mb-[20px] max-w-[720px]">
      <label htmlFor="comment-body" className="sr-only">Novo comentário</label>
      <textarea id="comment-body" value={body} onChange={event => setBody(event.target.value)} rows={3} maxLength={4000} placeholder="Escreva um comentário…" disabled={busy} className="w-full rounded-md border border-[#cecec2] bg-white p-[10px] text-[13px]"/>
      <div className="mt-[8px] flex flex-wrap items-center gap-[8px]">
        <label htmlFor="comment-file" className="text-[12px]">Sobre o arquivo</label>
        <select id="comment-file" value={file} onChange={event => setFile(event.target.value)} disabled={busy} className="max-w-[260px] rounded-md border border-[#cecec2] px-[8px] py-[6px] text-[12px]"><option value="">Projeto inteiro</option>{files.map(path => <option key={path} value={path}>{path}</option>)}</select>
        <button type="submit" disabled={busy || !body.trim()} className="ml-auto rounded-md bg-[#272721] px-[14px] py-[8px] text-[12px] font-medium text-white disabled:opacity-40">Comentar</button>
      </div>
    </form>}
    <label className="mb-[10px] flex items-center gap-[8px] text-[12px]"><input type="checkbox" checked={showResolved} onChange={event => setShowResolved(event.target.checked)}/>Mostrar resolvidos</label>
    {visible.length === 0 ? <p className="text-[13px] text-[#77776b]">Nenhum comentário{showResolved ? '' : ' em aberto'}.</p>
      : <ul className="space-y-[10px]">{visible.map(comment => <li key={comment.id} className={`rounded-md border p-[12px] text-[13px] ${comment.resolved ? 'border-[#e8e8e0] opacity-60' : 'border-[#e3e3d9] bg-white'}`}>
        <p className="text-[11px] text-[#77776b]">{comment.actorId === me ? 'Você' : 'Membro ' + comment.actorId.slice(0, 8)} · {new Date(comment.createdAt).toLocaleString('pt-BR')}{comment.file ? <> · <code>{comment.file}</code></> : null}</p>
        <p className="mt-[6px] whitespace-pre-wrap break-words">{comment.body}</p>
        {!readOnly && <button type="button" disabled={busy} onClick={() => void toggle(comment)} className="mt-[8px] text-[12px] underline">{comment.resolved ? 'Reabrir' : 'Marcar como resolvido'}</button>}
      </li>)}</ul>}
  </div>;
}
