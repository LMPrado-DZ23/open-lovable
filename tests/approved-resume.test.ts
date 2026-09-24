import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ProjectStore} from '../lib/projects/store';
import {SqliteProjectRepository} from '../lib/persistence/sqlite';
import {RunQueue} from '../lib/runs/queue';
import type {RunAuthority} from '../lib/runs/types';

async function setup(t:{after(fn:()=>void):void}){
 const store=new ProjectStore(':memory:');t.after(()=>store.close());let now=Date.now();
 const repo=new SqliteProjectRepository(store),ctx=repo.individualContext('alice'),project=await repo.create(ctx,'Approved resume','gateway/model');
 const authority:RunAuthority={workspaceId:ctx.principal.workspaceId,actorId:ctx.principal.actorId,memberVersion:1,mode:'individual',sessionId:null,origin:'http://127.0.0.1:3100',settingsOwner:'alice',allowLoopback:true,modelBinding:'a'.repeat(64),policyVersion:1};
 const queue=new RunQueue(store,()=>now),run=queue.enqueue(authority,{projectId:project.id,baseVersion:1,requestKey:randomUUID(),prompt:'Preserve source',model:'gateway/model',mode:'build',imageIDs:[],confirmCost:true});
 const worker=queue.acquireWorker('worker')!,job=queue.claim(worker)!;
 const implementation=await import('../lib/approvals/service').catch(()=>({})) as Record<string,any>;
 assert.equal(typeof implementation.ApprovalService,'function','Typed pause/resume service must exist');
 const service=new implementation.ApprovalService(queue,()=>now),connection={provider:'gateway',endpoint:'https://provider.example/v1',credentialConfigured:true};
 return {store,queue,authority,run,worker,job,project,service,connection,advance:(ms:number)=>now+=ms};
}
const resolution=(view:any,decision='approve')=>({approvalId:view.id,actionDigest:view.actionDigest,nonce:view.nonce,decision});
test('typed connection pause frees the worker and resumes the same frozen request only after approval',async t=>{
 const f=await setup(t);f.service.pause(f.job,'connection');assert.equal(f.queue.get(f.authority,f.run.id).state,'AWAITING_INPUT');assert.equal(f.queue.claim(f.worker),null);
 const changed={...f.authority,modelBinding:'b'.repeat(64)},view=f.service.prepare(f.authority,f.run.id,changed,f.connection);
 assert.equal(view.kind,'connection');assert.equal(JSON.stringify(view).includes('sessionId'),false);assert.equal(JSON.stringify(view).includes('settingsOwner'),false);
 assert.throws(()=>f.service.resolve(f.authority,f.run.id,{...resolution(view),actionDigest:'c'.repeat(64)},changed),/digest|approval|decision/i);
 const accepted=f.service.resolve(f.authority,f.run.id,resolution(view),changed);assert.equal(accepted.state,'QUEUED');
 const resumed=f.queue.claim(f.worker)!;assert.equal(resumed.run.id,f.run.id);assert.equal(resumed.authority.modelBinding,changed.modelBinding);assert.equal(resumed.inputDigest,f.job.inputDigest);assert.ok(resumed.token>f.job.token);
 assert.equal(f.store.getProject('alice',f.project.id).version,1);
 assert.throws(()=>f.service.resolve(f.authority,f.run.id,resolution(view),changed),/resolved|approval|state/i);
});
test('an approval is bound to exact connection, actor, membership and expiration',async t=>{
 const f=await setup(t);f.service.pause(f.job,'connection');const changed={...f.authority,modelBinding:'b'.repeat(64)},view=f.service.prepare(f.authority,f.run.id,changed,f.connection);
 const other=randomUUID();f.store.db.prepare("INSERT INTO workspace_members VALUES(?,?,'admin',1,1)").run(f.authority.workspaceId,other);
 assert.throws(()=>f.service.resolve({...f.authority,actorId:other},f.run.id,resolution(view),{...changed,actorId:other}),/requester|actor|permission/i);
 assert.throws(()=>f.service.resolve(f.authority,f.run.id,resolution(view),{...changed,modelBinding:'c'.repeat(64)}),/changed|invalidated|connection/i);
 assert.equal(f.service.status(f.authority,f.run.id).pending,null);
 const next=f.service.prepare(f.authority,f.run.id,changed,f.connection);f.advance(601000);
 assert.throws(()=>f.service.resolve(f.authority,f.run.id,resolution(next),changed),/expired/i);
 assert.equal(f.service.status(f.authority,f.run.id).pending,null);
});
test('denial and cancellation never create a grant or start an external request',async t=>{
 const f=await setup(t);f.service.pause(f.job,'connection');const view=f.service.prepare(f.authority,f.run.id,f.authority,f.connection);
 assert.equal(f.service.resolve(f.authority,f.run.id,resolution(view,'deny'),f.authority).state,'CANCELLED');
 assert.equal(f.store.db.prepare('SELECT count(*) AS n FROM run_grants').get()?.n,0);assert.equal(f.queue.claim(f.worker),null);
 assert.equal(f.queue.events(f.authority,f.run.id).events.filter(e=>e.type==='model.requested').length,0);
});
test('a wait cannot approve a changed revision or silently replay a started model request',async t=>{
 const f=await setup(t);f.queue.markModelStarted(f.job);assert.throws(()=>f.service.pause(f.job,'connection'),/started|uncertain|replay/i);
 assert.equal(f.queue.get(f.authority,f.run.id).state,'RUNNING');
});
test('pending decisions expire durably and do not retain a project execution lock forever',async t=>{
 const f=await setup(t);f.service.pause(f.job,'connection');f.advance(86400001);f.queue.reconcile();
 assert.equal(f.queue.get(f.authority,f.run.id).state,'FAILED');assert.equal(f.queue.get(f.authority,f.run.id).outcome,'APPROVAL_EXPIRED');
});
