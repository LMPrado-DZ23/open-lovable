import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {projectStore} from '../lib/projects/store';
import {SqliteProjectRepository} from '../lib/persistence/sqlite';

async function fixture(t:{after(fn:()=>void):void}){
 const root=mkdtempSync(join(tmpdir(),'run-api-contract-'));
 const env={NODE_ENV:'production',OPEN_LOVABLE_DATA_DIR:root,OPEN_LOVABLE_MASTER_KEY:randomBytes(32).toString('base64'),OPEN_LOVABLE_AUTH_MODE:'individual',OPEN_LOVABLE_USERNAME:'admin',OPEN_LOVABLE_PASSWORD:'a-long-run-api-test-password-not-production',OPEN_LOVABLE_APP_ORIGIN:'http://127.0.0.1:3100',OPEN_LOVABLE_GATEWAY_URL:'http://127.0.0.1:39999/v1',OPEN_LOVABLE_GATEWAY_API_KEY:'api-queue-fixture',OPEN_LOVABLE_GATEWAY_MODELS:'["fixture/coder"]'};
 const before=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));Object.assign(process.env,env);
 const store=projectStore(),repo=new SqliteProjectRepository(store),ctx=repo.individualContext('admin'),project=await repo.create(ctx,'API queue','gateway/fixture/coder');
 t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});for(const key of Object.keys(env)){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}});
 const headers={authorization:'Basic '+Buffer.from('admin:'+env.OPEN_LOVABLE_PASSWORD).toString('base64'),origin:env.OPEN_LOVABLE_APP_ORIGIN,'content-type':'application/json'};
 const req=(path:string,body?:unknown,authenticated=true)=>new Request(env.OPEN_LOVABLE_APP_ORIGIN+path,{method:body===undefined?'GET':'POST',headers:authenticated?headers:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const route=await import('../app/api/v1/runs/route').catch(()=>({})) as Record<string,any>;assert.equal(typeof route.POST,'function');
 const detail=await import('../app/api/v1/runs/[runId]/route').catch(()=>({})) as Record<string,any>;
 const stream=await import('../app/api/v1/runs/[runId]/events/route').catch(()=>({})) as Record<string,any>;
 const cancel=await import('../app/api/v1/runs/[runId]/cancel/route').catch(()=>({})) as Record<string,any>;
 const body={projectId:project.id,baseVersion:1,requestKey:randomUUID(),prompt:'Prepare a page',model:'gateway/fixture/coder',mode:'build',imageIDs:[],confirmCost:true};
 return {store,ctx,project,req,route,detail,stream,cancel,body};
}
test('v1 enqueue is a 202 command; stream disconnect cannot cancel the queued execution',async t=>{
 const f=await fixture(t),response=await f.route.POST(f.req('/api/v1/runs',f.body));assert.equal(response.status,202);
 const {run}=await response.json();assert.equal(run.state,'QUEUED');assert.equal(typeof run.requestId,'string');
 assert.equal((await f.route.POST(f.req('/api/v1/runs',f.body))).status,202);
 const res=await f.stream.GET(f.req('/api/v1/runs/'+run.id+'/events'));assert.equal(res.status,200);
 const reader=res.body!.getReader();const first=await reader.read();assert.match(new TextDecoder().decode(first.value),/run.queued/);await reader.cancel();
 const status=await f.detail.GET(f.req('/api/v1/runs/'+run.id));assert.equal(status.status,200);assert.equal((await status.json()).run.state,'QUEUED');
 const cancelled=await f.cancel.POST(f.req('/api/v1/runs/'+run.id+'/cancel',{}));assert.equal(cancelled.status,200);assert.equal((await cancelled.json()).run.state,'CANCELLED');
 assert.equal(f.store.getProject('admin',f.project.id).version,1);
});
test('v1 APIs authenticate before reading bodies and reject unapproved cost and caller-supplied authority',async t=>{
 const f=await fixture(t);assert.equal((await f.route.POST(f.req('/api/v1/runs',f.body,false))).status,401);
 assert.equal((await f.route.POST(f.req('/api/v1/runs',{...f.body,confirmCost:false}))).status,400);
 assert.equal((await f.route.POST(f.req('/api/v1/runs',{...f.body,actorId:randomUUID(),workspaceId:randomUUID()}))).status,400);
 assert.equal(f.store.runs('admin',f.project.id).length,0);
});
test('foreign and nonexistent executions are indistinguishable and malformed event cursors fail',async t=>{
 const f=await fixture(t),created=await f.route.POST(f.req('/api/v1/runs',f.body)),{run}=await created.json();
 f.store.db.prepare('UPDATE workspace_members SET active=0 WHERE workspace_id=?').run(f.ctx.principal.workspaceId);
 const foreign=await f.detail.GET(f.req('/api/v1/runs/'+run.id)),missing=await f.detail.GET(f.req('/api/v1/runs/'+randomUUID()));
 assert.equal(foreign.status,404);assert.equal(missing.status,404);assert.equal((await foreign.json()).code,(await missing.json()).code);
 f.store.db.prepare('UPDATE workspace_members SET active=1 WHERE workspace_id=?').run(f.ctx.principal.workspaceId);
 assert.equal((await f.stream.GET(f.req('/api/v1/runs/'+run.id+'/events?cursor=-1'))).status,400);
});
