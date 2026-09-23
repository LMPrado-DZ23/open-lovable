import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { projectStore } from '../lib/projects/store';

async function setup(t:any) {
 const env={...process.env};
 const root=mkdtempSync(join(tmpdir(),'project-workflow-'));
 Object.assign(process.env,{NODE_ENV:'development',OPEN_LOVABLE_DATA_DIR:root,OPEN_LOVABLE_DISABLE_SAVED_SETTINGS:'1'});
 delete process.env.OPEN_LOVABLE_PASSWORD;delete process.env.OPEN_LOVABLE_APP_ORIGIN;delete process.env.AI_GATEWAY_API_KEY;
 t.after(()=>{projectStore().close();for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);rmSync(root,{recursive:true,force:true});});
 const routes=await import('../app/api/projects/route').catch(()=>({})) as Record<string,any>;
 assert.equal(typeof routes.POST,'function','durable project API must be implemented');
 const post=(body:any)=>routes.POST(new Request('http://127.0.0.1/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 const get=(query='')=>routes.GET(new Request('http://127.0.0.1/api/projects'+query));
 const create=async(name:string)=>{const response=await post({action:'create',name,model:'gateway/test/coder'});assert.equal(response.status,201);return (await response.json()).project;};
 return {post,get,create};
}
const first={files:{'src/App.jsx':'export default function App(){return <h1>Original</h1>}'},assets:{}};
async function aiFixture(t:any,code:string) {
 let calls=0;
 const server=createServer((req,res)=>{let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
  calls++;assert.equal(JSON.parse(body).model,'test/coder');
  res.writeHead(200,{'content-type':'text/event-stream'});
  const chunk={id:'test',object:'chat.completion.chunk',created:1,model:'test/coder',choices:[{index:0,delta:{content:code},finish_reason:null}]};
  res.write('data: '+JSON.stringify(chunk)+'\n\n');res.end('data: '+JSON.stringify({...chunk,choices:[{index:0,delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');
 });});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise<void>(resolve=>{server.closeAllConnections();server.close(()=>resolve());}));
 Object.assign(process.env,{OPEN_LOVABLE_GATEWAY_URL:`http://127.0.0.1:${(server.address() as any).port}/v1`,OPEN_LOVABLE_GATEWAY_API_KEY:'project-fixture',OPEN_LOVABLE_GATEWAY_MODELS:'["test/coder"]'});
 return ()=>calls;
}

test('project APIs preserve separate revisions and restoration does not affect another project',async t=>{
 const {post,get,create}=await setup(t);const a=await create('Project A'),b=await create('Project B');
 assert.equal((await post({action:'save',id:a.id,version:1,snapshot:first,label:'First'})).status,200);
 assert.equal((await post({action:'save',id:a.id,version:1,snapshot:first,label:'Stale'})).status,409);
 const state=await (await get('?id='+a.id)).json();assert.equal(state.project.version,2);
 const restore=await post({action:'restore',id:a.id,version:2,revisionID:state.revisions.find((r:any)=>r.version===1).id});
 assert.equal(restore.status,200);assert.equal((await restore.json()).project.version,3);
 assert.deepEqual((await (await get('?id='+b.id)).json()).project.snapshot.files,{});
 assert.equal((await post({action:'save',id:b.id,version:1,snapshot:first,label:'B',owner:'intruder'})).status,400);
});

test('generation compiles a proposal, requires approval, and a repeated request does not call the model twice',async t=>{
 const {post,get,create}=await setup(t);
 const count=await aiFixture(t,'<file path="src/App.jsx">export default function App(){return <h1>Generated</h1>}</file>');
 const p=await create('Generation');const key=randomUUID();
 const body={action:'generate',id:p.id,version:1,requestKey:key,prompt:'Build a title',model:'gateway/test/coder'};
 const response=await post(body);assert.equal(response.status,200);const text=await response.text();assert.match(text,/AWAITING_APPROVAL/);
 const duplicate=await post(body);await duplicate.text();assert.equal(count(),1);
 const state=await (await get('?id='+p.id)).json();assert.equal(state.project.version,1);
 const run=state.runs[0];assert.equal(run.state,'AWAITING_APPROVAL');
 assert.equal((await post({action:'accept',id:p.id,version:1,runID:run.id})).status,200);
 assert.equal((await (await get('?id='+p.id)).json()).project.version,2);
});

test('invalid generated code fails without overwriting a saved revision',async t=>{
 const {post,get,create}=await setup(t);await aiFixture(t,'<file path="src/App.jsx">export default function App( { broken </file>');
 const p=await create('Failure');await post({action:'save',id:p.id,version:1,snapshot:first,label:'Original'});
 const result=await post({action:'generate',id:p.id,version:2,requestKey:randomUUID(),prompt:'Change title',model:'gateway/test/coder'});
 assert.match(await result.text(),/FAILED|error/);
 const state=await (await get('?id='+p.id)).json();assert.equal(state.project.version,2);assert.deepEqual(state.project.snapshot,first);
});

test('ZIP import/export preserves source and blocks unsafe names without writing a partial revision',async t=>{
 const {post,get,create}=await setup(t);const p=await create('ZIP');
 const zip=zipSync({'src/App.jsx':strToU8(first.files['src/App.jsx'])});
 const result=await post({action:'import',id:p.id,version:1,archive:Buffer.from(zip).toString('base64')});assert.equal(result.status,200);
 const exported=await get('?id='+p.id+'&action=export');assert.equal(exported.status,200);
 const files=unzipSync(new Uint8Array(await exported.arrayBuffer()));assert.equal(strFromU8(files['src/App.jsx']),first.files['src/App.jsx']);
 const bad=zipSync({'../outside.ts':strToU8('bad')});
 assert.equal((await post({action:'import',id:p.id,version:2,archive:Buffer.from(bad).toString('base64')})).status,400);
 assert.equal((await (await get('?id='+p.id)).json()).project.version,2);
});

test('unauthenticated project requests and foreign-owned IDs reveal no project data',async t=>{
 const {post,get,create}=await setup(t);const p=await create('Private');
 Object.assign(process.env,{NODE_ENV:'production',OPEN_LOVABLE_APP_ORIGIN:'http://127.0.0.1',OPEN_LOVABLE_PASSWORD:'test-password-thirty-two-characters-long'});
 assert.equal((await get('?id='+p.id)).status,401);assert.equal((await post({action:'create',name:'Denied',model:'gateway/test/coder'})).status,401);
 process.env.NODE_ENV='development';delete process.env.OPEN_LOVABLE_PASSWORD;
 process.env.OPEN_LOVABLE_USERNAME='other-owner';assert.equal((await get('?id='+p.id)).status,404);
});


test('a preview is a read-only GET with channel validation and project ownership',async t=>{
 const {post,get,create}=await setup(t);const p=await create('Read-only preview');
 await post({action:'save',id:p.id,version:1,snapshot:first,label:'Source'});
 const response=await get('?id='+p.id+'&action=preview&channel=test-channel');
 assert.equal(response.status,200);const data=await response.json();assert.equal(typeof data.html,'string');assert.match(data.html,/test-channel/);
 assert.equal((await get('?id='+p.id+'&action=preview&channel=%3Cscript%3E')).status,400);
 assert.equal((await (await get('?id='+p.id)).json()).project.version,2);
});


test('cancelling the response cancels the durable run and retains all saved source',async t=>{
 const {post,get,create}=await setup(t);
 const server=createServer((req,res)=>{req.resume();req.on('end',()=>{res.writeHead(200,{'content-type':'text/event-stream'});res.write(': waiting\n\n');});});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise<void>(resolve=>{server.closeAllConnections();server.close(()=>resolve());}));
 Object.assign(process.env,{OPEN_LOVABLE_GATEWAY_URL:`http://127.0.0.1:${(server.address() as any).port}/v1`,OPEN_LOVABLE_GATEWAY_API_KEY:'project-fixture',OPEN_LOVABLE_GATEWAY_MODELS:'["test/coder"]'});
 const p=await create('Cancellation');await post({action:'save',id:p.id,version:1,snapshot:first,label:'Saved'});
 const response=await post({action:'generate',id:p.id,version:2,requestKey:randomUUID(),prompt:'Generate slowly',model:'gateway/test/coder'});
 const reader=response.body!.getReader();await reader.read();await reader.cancel();
 let state:any;
 for(let tries=0;tries<50;tries++){state=await(await get('?id='+p.id)).json();if(state.runs[0].state==='CANCELLED')break;await new Promise(resolve=>setTimeout(resolve,20));}
 assert.equal(state.runs[0].state,'CANCELLED');assert.equal(state.project.version,2);assert.deepEqual(state.project.snapshot,first);
});
