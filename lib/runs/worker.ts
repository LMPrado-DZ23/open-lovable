import {authMode} from '../identity/config';
import {accountService} from '../identity/factory';
import {ProjectError,operatorID} from '../projects/store';
import {requestFrozenModel,validateRunResult} from '../projects/generation';
import {safeLogger} from '../security/secret-content';
import type {ProviderScope} from '../settings/store';
import {RunQueue} from './queue';
import {modelBindingDigest} from './model-binding';
import type {ClaimedRun,WorkerLease} from './types';

/** Server configuration, current session and original connection must still match admitted work. */
function localGuard(queue:RunQueue,job:ClaimedRun):ProviderScope|undefined {
 queue.assertLease(job);const a=job.authority;
 if(authMode()!==a.mode)throw new ProjectError('Authentication profile changed; authorize a new request.',403);
 const configured=process.env.OPEN_LOVABLE_APP_ORIGIN;
 if(configured?new URL(configured).origin!==a.origin:!['localhost','127.0.0.1','[::1]'].includes(new URL(a.origin).hostname))throw new ProjectError('Studio origin changed; authorize a new request.',403);
 if(a.mode==='individual'&&a.settingsOwner!==operatorID())throw new ProjectError('Operator identity changed.',403);
 if(a.mode==='supabase'&&a.settingsOwner!=='workspace:'+a.workspaceId)throw new ProjectError('Connection scope mismatch.',403);
 const scope=a.mode==='supabase'?{owner:a.settingsOwner,allowLoopback:a.allowLoopback}:undefined;
 if(modelBindingDigest(job.run.model,scope)!==a.modelBinding)throw new ProjectError('Model connection changed. Review settings and authorize a new request.',409);
 return scope;
}
async function verifySession(job:ClaimedRun,signal:AbortSignal):Promise<void> {
 if(job.authority.mode!=='supabase')return;
 const service=accountService(job.authority.origin);
 const session=await service.authenticateSession(job.authority.sessionId!,signal);
 if(session.actor_id!==job.authority.actorId)throw new ProjectError('Execution session identity changed.',401);
}
/** Executes at most one admitted run. The only model call is preceded by a durable effect marker. */
export async function runWorkerOnce(queue:RunQueue,worker:WorkerLease,stopSignal?:AbortSignal):Promise<{worked:boolean;runId?:string;state?:string}> {
 const job=queue.claim(worker);if(!job)return {worked:false};
 const cancelled=new AbortController();const signal=AbortSignal.any([cancelled.signal,AbortSignal.timeout(Math.max(1,job.deadlineAt-Date.now())),...(stopSignal?[stopSignal]:[])]);
 const heartbeat=setInterval(()=>{
  try{if(!queue.heartbeatWorker(worker))throw new ProjectError('Worker lease lost',409);localGuard(queue,job);queue.heartbeat(job);}
  catch(error){cancelled.abort(error);}
 },1000);heartbeat.unref();
 try{
  let scope=localGuard(queue,job);await verifySession(job,signal);signal.throwIfAborted();scope=localGuard(queue,job);
  let text=job.output;
  if(text===null){
   const result=await requestFrozenModel(job.run,job.input,signal,{scope,assertLive:()=>{localGuard(queue,job);},beforeModel:()=>queue.markModelStarted(job),status:payload=>queue.event(job,'run.progress',payload)});
   queue.recordModelResult(job,result.text,result.usage);text=result.text;
  }
  queue.event(job,'run.progress',{phase:job.run.inputs.mode==='plan'?'planning':'compiling'});
  const result=await validateRunResult(job.run,job.input,text,signal);
  await verifySession(job,signal);signal.throwIfAborted();localGuard(queue,job);
  if(result.kind==='plan')queue.completePlan(job,result.text);
  else queue.stage(job,result.snapshot,result.explanation,{entry:result.compiled.entry,sha256:result.compiled.sha256,warnings:result.compiled.warnings});
 }catch(error){
  const message=error instanceof Error?error.message:'Execution failed; saved files were preserved.';
  try{queue.fail(job,message,Boolean(stopSignal?.aborted));}catch(recordError){safeLogger.error('Worker could not record its interrupted state',recordError);}
 }finally{clearInterval(heartbeat);}
 const final=queue.store.getRun(job.owner,job.run.project_id,job.run.id);
 return {worked:true,runId:job.run.id,state:final.state};
}
