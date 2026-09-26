import {RunQueue,runDigest} from '@/lib/runs/queue';
import {reader as runAccess} from '@/lib/runs/http';
import {studioAccess,authenticateStudio} from '@/lib/identity/request';
import { z } from 'zod';
import { readJsonObject, ClientInputError } from '@/lib/security/input-validation';
import { SecretContentError, redactSecretText, safeLogger } from '@/lib/security/secret-content';
import { ProviderConfigError } from '@/lib/ai/provider-catalog';
import { ProjectError } from '@/lib/projects/store';
import { importProjectZip } from '@/lib/projects/archive';
import { compileProject, compileProjectCached } from '@/lib/projects/preview';
import { buildPublishedSite, saveLocalPublication } from '@/lib/publish/site';
import { addVercelDomain, deployToVercel, vercelProjectName } from '@/lib/publish/vercel';
import { pushToGitHub } from '@/lib/publish/github';
import { scanProject } from '@/lib/security/app-scan';
import { STARTER_TEMPLATES, starterTemplate } from '@/lib/templates/starters';
import { deletePrivateTemplate, importPrivateTemplateZip, listPrivateTemplates, PRIVATE_PREFIX, readPrivateTemplate, savePrivateTemplate } from '@/lib/templates/private';
import { addComment, listComments, setCommentResolved } from '@/lib/collaboration/project-comments';
import { readLiveText, summarizeLiveText } from '@/lib/runs/live-text';
import { CONNECTORS } from '@/lib/connectors/catalog';
import { usageSummary } from '@/lib/usage/summary';
import { readWorkspaceKnowledge, saveWorkspaceKnowledge, WORKSPACE_KNOWLEDGE_LIMIT } from '@/lib/settings/workspace-knowledge';
import { connectorsModuleSource, CONNECTORS_FILE_PATH, connectorSecretStatus, pushConnectorSecrets, readProjectConnectors, saveProjectConnectors } from '@/lib/connectors/project-connectors';
import { applySupabaseMigration, MIGRATIONS_DIRECTORY, readProjectBackend, saveProjectBackend, SUPABASE_CLIENT_PATH, supabaseClientSource } from '@/lib/backend/project-supabase';
import { integrationCredential } from '@/lib/settings/store';
import { createRun } from '@/lib/runs/http';
import { exportProjectBundle, exportBundleFileName } from '@/lib/artifacts/export-bundle';
import { applyPatchSet } from '@/lib/revisions/patches';
import { requireReleaseReady } from '@/lib/verification/release-gate';
import type { VerificationReport } from '@/lib/verification/evidence';
import {buildTextVisualEdit} from '@/lib/visual/edits';
import {buildVisualEvidence,assertComparableVisualEvidence,type VisualEvidence} from '@/lib/visual/comparison';
import {DraftService} from '@/lib/drafts/service';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const id=z.string().uuid();const version=z.number().int().min(1);
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),name:z.string().min(1).max(120),model:z.string().max(240)}).strict(),
 z.object({action:z.literal('template'),template:z.string().min(1).max(80),name:z.string().min(1).max(120).optional(),model:z.string().max(240)}).strict(),
 z.object({action:z.literal('templateImport'),name:z.string().min(2).max(80),description:z.string().max(240).optional(),category:z.string().max(40).optional(),archive:z.string().max(17*1024*1024)}).strict(),
 z.object({action:z.literal('templateSave'),id,name:z.string().min(2).max(80),description:z.string().max(240).optional(),category:z.string().max(40).optional()}).strict(),
 z.object({action:z.literal('templateDelete'),template:z.string().min(2).max(60)}).strict(),
 z.object({action:z.literal('save'),id,version,snapshot:z.unknown(),label:z.string().min(1).max(200)}).strict(),
 z.object({action:z.literal('patch'),id,version,baseRevision:z.string().min(1).max(128),operations:z.array(z.object({kind:z.enum(['create','update','delete']),path:z.string().min(1).max(500),content:z.string().optional()}).strict()).min(1).max(200),expectedHashes:z.record(z.string().regex(/^[a-f0-9]{64}$/))}).strict(),
 z.object({action:z.literal('visualEdit'),id,version,baseRevision:z.string().min(1).max(128),element:z.object({runtimeId:z.string().min(1).max(128),revisionDigest:z.string().regex(/^[a-f0-9]{64}$/),elementId:z.string().regex(/^[a-f0-9]{32}$/),file:z.string().min(1).max(500),start:z.number().int().min(0),end:z.number().int().gt(0),tag:z.string().min(1).max(80),sourceHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),value:z.string().max(2000)}).strict(),
 z.object({action:z.literal('import'),id,version,archive:z.string().max(16*1024*1024)}).strict(),
 z.object({action:z.literal('restore'),id,version,revisionID:id}).strict(),
 z.object({action:z.literal('generate'),id,version,requestKey:z.string().min(8).max(128),prompt:z.string().min(1).max(32768),model:z.string().min(1).max(240),mode:z.enum(['build','plan']).optional(),imageIDs:z.array(id).max(4).optional(),confirmCost:z.literal(true),confirmVision:z.boolean().optional()}).strict(),
 z.object({action:z.literal('cancel'),id,runID:id}).strict(),
 z.object({action:z.literal('accept'),id,version,runID:id}).strict(),
 z.object({action:z.literal('preview'),id,runID:id.optional(),channel:z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)}).strict(),
 z.object({action:z.literal('verify'),id,runID:id.optional(),report:z.unknown()}).strict(),
 z.object({action:z.literal('visualCompare'),id,targetDigest:z.string().regex(/^[a-f0-9]{64}$/),renderDigest:z.string().regex(/^[a-f0-9]{64}$/),viewport:z.object({width:z.number().int(),height:z.number().int()}).strict(),metric:z.number().min(0).max(1).optional(),review:z.string().min(1).max(4000),functionalErrors:z.array(z.string().max(500)).max(100),referenceOnly:z.boolean().optional()}).strict(),
 z.object({action:z.literal('draftMerge'),id,base:z.unknown(),ours:z.unknown(),theirs:z.unknown()}).strict(),
 z.object({action:z.literal('document'),id,name:z.string().min(1).max(200),content:z.string().min(1).max(200000)}).strict(),
 z.object({action:z.literal('instructions'),id,content:z.string().max(200000)}).strict(),
 z.object({action:z.literal('publish'),id,target:z.enum(['local','vercel'])}).strict(),
 z.object({action:z.literal('scan'),id}).strict(),
 z.object({action:z.literal('domain'),id,domain:z.string().min(3).max(253)}).strict(),
 z.object({action:z.literal('comment'),id,body:z.string().min(1).max(4000),file:z.string().max(300).optional()}).strict(),
 z.object({action:z.literal('commentResolve'),id,commentId:z.string().uuid(),resolved:z.boolean()}).strict(),
 z.object({action:z.literal('backend'),id,version:z.number().int().min(1),url:z.string().min(1).max(200),anonKey:z.string().min(10).max(2048)}).strict(),
 z.object({action:z.literal('backendApply'),id,path:z.string().min(1).max(300)}).strict(),
 z.object({action:z.literal('connectorsSave'),id,version:z.number().int().min(1),enabled:z.array(z.string().regex(/^[a-z0-9-]{2,40}$/)).max(100),publicValues:z.record(z.record(z.string().max(500))).optional()}).strict(),
 z.object({action:z.literal('connectorSecretsPush'),id}).strict(),
 z.object({action:z.literal('knowledgeSave'),content:z.string().max(WORKSPACE_KNOWLEDGE_LIMIT+1000)}).strict(),
 z.object({action:z.literal('github'),id,repository:z.string().min(1).max(100),private:z.boolean()}).strict(),
]);
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function failure(error:unknown):Response {
 const status=error instanceof ProjectError||error instanceof ProviderConfigError||error instanceof SecretContentError?error.status:error instanceof ClientInputError||error instanceof z.ZodError?400:500;
 if(status===500)safeLogger.error('Project operation failed',error);
 const message=status===500?'Project operation failed; the last saved revision was preserved. Check server logs.':error instanceof z.ZodError?'Invalid project request. Reload the project and review the fields.':redactSecretText((error as Error).message);
 return json({success:false,error:message},status);
}
/** Reads are always scoped to the authenticated operator, never to a supplied owner. */
export async function GET(request:Request){
 try{
  const params=new URL(request.url).searchParams,projectID=params.get('id');
  const access=await studioAccess(request,projectID||undefined);if(access instanceof Response)return access;
  const {store,owner,repository,workspace,guard}=access;guard(projectID||undefined);
  if(!projectID&&params.get('action')==='templates'){
   // Public starters ship with the app; private ones stay in this installation's data directory.
   const publicTemplates=STARTER_TEMPLATES.map(template=>({id:template.id,name:template.name,description:template.description,category:template.category,private:false}));
   const privateTemplates=access.mode==='individual'?listPrivateTemplates().map(template=>({id:PRIVATE_PREFIX+template.id,name:template.name,description:template.description,category:template.category,private:true,files:template.files})):[];
   return json({templates:[...privateTemplates,...publicTemplates]});
  }
  if(!projectID&&params.get('action')==='connectors'){
   // Catalog plus which secret connectors already have a saved key; values never leave the server.
   let manage=true;try{access.requireAdmin();}catch(error){if(error instanceof ProjectError&&error.status===403)manage=false;else throw error;}
   return json({catalog:CONNECTORS,secrets:connectorSecretStatus(access.settingsOwner),manage});
  }
  if(!projectID&&params.get('action')==='usage')return json({usage:usageSummary(store.db,workspace.principal.workspaceId,Math.min(90,Math.max(7,Number(params.get('days'))||14)))});
  if(!projectID&&params.get('action')==='knowledge')return json({content:readWorkspaceKnowledge(workspace.principal.workspaceId),limit:WORKSPACE_KNOWLEDGE_LIMIT});
  if(!projectID)return json({projects:await repository.list(workspace)});
  const context={...workspace,projectId:projectID};
  const project=await repository.read(context);
  if(params.get('action')==='preview'){
   const channel=params.get('channel')||'';if(!/^[a-zA-Z0-9_-]{1,128}$/.test(channel))throw new ProjectError('Invalid preview channel');
   const runID=params.get('runID');const snapshot=runID?store.getRun(owner,projectID,runID).candidate:project.snapshot;
   if(!snapshot)throw new ProjectError('This run has no preview candidate',409);
   const backend=readProjectBackend(projectID);
   const compiled=await compileProjectCached(snapshot,channel,true,backend?[backend.url]:[]);
   if(request.signal.aborted)return new Response(null,{status:499});
   guard(projectID);
   return json(compiled);
  }
  if(params.get('action')==='comments')return json({comments:listComments(projectID),actorId:workspace.principal.actorId});
  if(params.get('action')==='live'){
   // Partial output of a running generation for the chat; the run must belong to this project.
   const runID=params.get('runID')||'';if(!id.safeParse(runID).success)throw new ProjectError('Invalid run');
   store.getRun(owner,projectID,runID);
   return json({text:summarizeLiveText(readLiveText(runID))});
  }
  if(params.get('action')==='backend'){
   const backend=readProjectBackend(projectID);
   const migrations=Object.keys(project.snapshot.files).filter(path=>path.startsWith(MIGRATIONS_DIRECTORY)&&path.endsWith('.sql')).sort().map(path=>({path,sql:project.snapshot.files[path],applied:Boolean(backend?.appliedMigrations.includes(path))}));
   return json({backend:backend?{url:backend.url,projectRef:backend.projectRef,updatedAt:backend.updatedAt}:null,migrations,tokenConfigured:Boolean(integrationCredential('supabase',access.scope).token)});
  }
  if(params.get('action')==='connectors'){
   const backend=readProjectBackend(projectID);
   return json({catalog:CONNECTORS,state:readProjectConnectors(projectID),secrets:connectorSecretStatus(access.settingsOwner),backend:Boolean(backend),tokenConfigured:Boolean(integrationCredential('supabase',access.scope).token)});
  }
  if(params.get('action')==='export'){
   const runID=params.get('runID');
   const runIDValue=runID&&id.safeParse(runID).success?runID:undefined;
   if(runID&&!runIDValue)throw new ProjectError('Invalid export run');
   const run=runIDValue?store.getRun(owner,projectID,runIDValue):null;
   if(runIDValue&&(!run?.candidate||run.state!=='AWAITING_APPROVAL'))throw new ProjectError('This run has no exportable candidate',409);
   const bundle=exportProjectBundle(run?.candidate||project.snapshot,{projectId:project.id,projectVersion:run?.base_version||project.version,runId:run?.id,baseVersion:run?.base_version,source:run?.candidate?'candidate':'project'});
   return new Response(new Uint8Array(bundle.bytes),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${exportBundleFileName(project.id,run?.id)}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  let write=true,manageConnections=true;
  try{guard(projectID,true);}catch(error){if(error instanceof ProjectError&&error.status===403)write=false;else throw error;}
  try{access.requireAdmin();}catch(error){if(error instanceof ProjectError&&error.status===403)manageConnections=false;else throw error;}
  return json({permissions:{write,manageConnections},profile:access.mode,project,revisions:await repository.revisions(context),runs:store.runs(owner,projectID),messages:store.messages(owner,projectID),documents:store.documents(owner,projectID)});
 }catch(error){return failure(error);}
}
/** Mutations validate bounded input and delegate to transactional, ownership-checked stores. */
export async function POST(request:Request){
 try{
  const authenticated=await authenticateStudio(request);if(authenticated instanceof Response)return authenticated;
  const body=schema.parse(await readJsonObject(request,18*1024*1024));
  const access=await studioAccess(request,'id' in body?body.id:undefined,authenticated);if(access instanceof Response)return access;
  const {store,owner,repository,workspace,guard}=access;guard('id' in body?body.id:undefined,body.action!=='preview'&&body.action!=='scan');
  const context=(projectId:string)=>({...workspace,projectId});
  if('id' in body){if(body.action==='preview'||body.action==='scan')await repository.read(context(body.id));else await repository.requireWrite(context(body.id));}
  switch(body.action){
   case 'create':return json({project:await repository.create(workspace,body.name,body.model)},201);
   case 'template':{
    if(body.template.startsWith(PRIVATE_PREFIX)&&access.mode!=='individual')throw new ProjectError('Modelos privados estão disponíveis apenas no perfil individual.',403);
    const privateTemplate=body.template.startsWith(PRIVATE_PREFIX)?readPrivateTemplate(body.template.slice(PRIVATE_PREFIX.length)):null;
    const template=privateTemplate?{name:privateTemplate.info.name,snapshot:privateTemplate.snapshot}:(()=>{const found=starterTemplate(body.template);return found?{name:found.name,snapshot:{files:found.files,assets:{}}}:null;})();
    if(!template)throw new ProjectError('Modelo de projeto desconhecido.',404);
    const created=await repository.create(workspace,body.name||template.name,body.model);
    const project=await repository.save({...workspace,projectId:created.id},created.version,template.snapshot,'Modelo: '+template.name);
    return json({project},201);
   }
   case 'templateImport':{access.requireAdmin();if(access.mode!=='individual')throw new ProjectError('Modelos privados estão disponíveis apenas no perfil individual.',403);const result=importPrivateTemplateZip({name:body.name,description:body.description,category:body.category,archive:body.archive});return json(result,201);}
   case 'templateSave':{access.requireAdmin();if(access.mode!=='individual')throw new ProjectError('Modelos privados estão disponíveis apenas no perfil individual.',403);const project=store.getProject(owner,body.id);return json({template:savePrivateTemplate({name:body.name,description:body.description,category:body.category,snapshot:project.snapshot})},201);}
   case 'templateDelete':{access.requireAdmin();if(access.mode!=='individual')throw new ProjectError('Modelos privados estão disponíveis apenas no perfil individual.',403);deletePrivateTemplate(body.template);return json({success:true});}
   case 'save':return json({project:await repository.save(context(body.id),body.version,body.snapshot,body.label)});
   case 'patch':{const project=store.getProject(owner,body.id);const result=applyPatchSet(project.snapshot,{baseRevision:body.baseRevision,operations:body.operations,expectedHashes:body.expectedHashes},String(project.version));const saved=await repository.save(context(body.id),body.version,result.snapshot,'Edição visual: '+result.changed.join(', '));return json({project:saved,changed:result.changed,diffDigest:result.diffDigest});}
   case 'visualEdit':{const project=store.getProject(owner,body.id);const patch=buildTextVisualEdit(project.snapshot,body.element,body.value,body.baseRevision);const result=applyPatchSet(project.snapshot,patch,String(project.version));const saved=await repository.save(context(body.id),body.version,result.snapshot,'Edição visual assistida: '+body.element.tag);return json({project:saved,changed:result.changed,diffDigest:result.diffDigest});}
   case 'import':{
    store.getProject(owner,body.id);const imported=importProjectZip(body.archive);
    return json({project:await repository.save(context(body.id),body.version,imported.snapshot,'Imported ZIP'),excluded:imported.excluded});
   }
   case 'restore':return json({project:await repository.restore(context(body.id),body.version,body.revisionID)});
   case 'generate':{
    if(body.imageIDs?.length&&body.confirmVision!==true)throw new ProjectError('Confirm that the selected model accepts images. No text-only fallback is allowed.');
    const headers=new Headers(request.headers);headers.set('content-type','application/json');
    return createRun(new Request(new URL('/api/v1/runs',request.url),{method:'POST',headers,body:JSON.stringify({projectId:body.id,baseVersion:body.version,requestKey:body.requestKey,prompt:body.prompt,model:body.model,mode:body.mode||'build',imageIDs:body.imageIDs||[],confirmCost:body.confirmCost,confirmVision:body.confirmVision}),signal:request.signal}));
   }
   case 'cancel':{
    store.getRun(owner,body.id,body.runID);
    if(store.db.prepare('SELECT 1 FROM run_controls WHERE run_id=?').get(body.runID))new RunQueue(store).cancel(runAccess(access),body.runID);
    else store.cancelRun(owner,body.id,body.runID);
    return json({run:store.getRun(owner,body.id,body.runID)});
   }
   case 'accept':{
    const run=store.getRun(owner,body.id,body.runID);if(!run.candidate)throw new ProjectError('No candidate is awaiting approval',409);
    await compileProject(run.candidate);
    await repository.requireWrite(context(body.id));
    guard(body.id,true);
    return json({project:store.db.prepare('SELECT 1 FROM run_controls WHERE run_id=?').get(body.runID)?new RunQueue(store).accept(runAccess(access),body.runID,body.version):store.acceptRun(owner,body.id,body.runID,body.version)});
   }
   case 'preview':{
    const project=store.getProject(owner,body.id);const snapshot=body.runID?store.getRun(owner,body.id,body.runID).candidate:project.snapshot;
    if(!snapshot)throw new ProjectError('This run has no preview candidate',409);
    const compiled=await compileProjectCached(snapshot,body.channel,true);guard(body.id);return json(compiled);
   }
   case 'document':return json({documents:store.addDocument(owner,body.id,body.name,body.content)});
   case 'instructions':return json({documents:store.setInstructions(owner,body.id,body.content)});
   case 'scan':return json({scan:scanProject(store.getProject(owner,body.id).snapshot.files)});
   case 'comment':return json({comments:addComment(body.id,workspace.principal.actorId,body.body,body.file||undefined)});
   case 'commentResolve':return json({comments:setCommentResolved(body.id,body.commentId,body.resolved)});
   case 'backend':{
    // Connecting writes the dependency-free client into the app as a normal, undoable revision.
    const backend=saveProjectBackend(body.id,body.url,body.anonKey);const project=store.getProject(owner,body.id);
    const connectors=readProjectConnectors(body.id);
    const snapshot={...project.snapshot,files:{...project.snapshot.files,[SUPABASE_CLIENT_PATH]:supabaseClientSource(backend),...(connectors.enabled.length?{[CONNECTORS_FILE_PATH]:connectorsModuleSource(connectors,backend.url)}:{})}};
    const saved=await repository.save(context(body.id),body.version,snapshot,'Supabase conectado');
    return json({project:saved,backend:{url:backend.url,projectRef:backend.projectRef}});
   }
   case 'connectorsSave':{
    // Public values become src/lib/connectors.js as a normal, undoable revision.
    const state=saveProjectConnectors(body.id,{enabled:body.enabled,publicValues:body.publicValues??{}});
    const project=store.getProject(owner,body.id),backend=readProjectBackend(body.id);
    const snapshot={...project.snapshot,files:{...project.snapshot.files,[CONNECTORS_FILE_PATH]:connectorsModuleSource(state,backend?.url)}};
    const saved=await repository.save(context(body.id),body.version,snapshot,'Conectores atualizados');
    return json({project:saved,state});
   }
   case 'knowledgeSave':{access.requireAdmin();return json({content:saveWorkspaceKnowledge(workspace.principal.workspaceId,body.content)});}
   case 'connectorSecretsPush':{
    const backend=readProjectBackend(body.id);if(!backend)throw new ProjectError('Conecte o Supabase a este projeto antes de enviar as chaves.',409);
    const credential=integrationCredential('supabase',access.scope);if(!credential.token)throw new ProjectError('Salve o token de acesso do Supabase em Integrações para enviar as chaves.',409);
    const names=await pushConnectorSecrets({owner:access.settingsOwner,state:readProjectConnectors(body.id),projectRef:backend.projectRef,token:credential.token});
    guard(body.id);return json({pushed:names});
   }
   case 'backendApply':{
    const project=store.getProject(owner,body.id),backend=readProjectBackend(body.id);
    if(!backend)throw new ProjectError('Conecte o Supabase a este projeto antes de aplicar migrações.',409);
    const sql=project.snapshot.files[body.path];if(typeof sql!=='string')throw new ProjectError('Migração não encontrada na revisão salva.',404);
    const credential=integrationCredential('supabase',access.scope);if(!credential.token)throw new ProjectError('Salve o token de acesso do Supabase em Integrações para aplicar migrações.',409);
    const updated=await applySupabaseMigration({projectId:body.id,backend,path:body.path,sql,token:credential.token});
    guard(body.id);return json({appliedMigrations:updated.appliedMigrations});
   }
   case 'publish':{
    const project=store.getProject(owner,body.id);if(!Object.keys(project.snapshot.files).length)throw new ProjectError('O projeto ainda não tem arquivos para publicar.',409);
    const site=await buildPublishedSite(project.snapshot,project.name);guard(body.id);
    const local=saveLocalPublication(project.id,project.version,site.html,site.sha256);
    if(body.target==='local')return json({publication:local});
    const credential=integrationCredential('vercel',access.scope);if(!credential.token)throw new ProjectError('Configure o token da Vercel em Integrações antes de publicar na internet.',409);
    const deployment=await deployToVercel({token:credential.token,name:vercelProjectName(project.name,project.id),html:site.html});
    return json({publication:{...local,publicUrl:deployment.url,deploymentId:deployment.id}});
   }
   case 'domain':{
    const project=store.getProject(owner,body.id);const credential=integrationCredential('vercel',access.scope);
    if(!credential.token)throw new ProjectError('Configure o token da Vercel em Integrações antes de conectar um domínio.',409);
    const setup=await addVercelDomain({token:credential.token,project:vercelProjectName(project.name,project.id),domain:body.domain});
    guard(body.id);return json({domain:setup});
   }
   case 'github':{
    const project=store.getProject(owner,body.id);const credential=integrationCredential('github',access.scope);
    if(!credential.token)throw new ProjectError('Configure o token do GitHub em Integrações antes de enviar o projeto.',409);
    const assets=Object.keys(project.snapshot.assets);
    const result=await pushToGitHub({token:credential.token,repository:body.repository,privateRepo:body.private,files:project.snapshot.files,message:`Open Lovable: ${project.name} (revisão ${project.version})`});
    guard(body.id);return json({github:{...result,skippedAssets:assets.length}});
   }
   case 'verify':{const project=store.getProject(owner,body.id);const candidate=body.runID?store.getRun(owner,body.id,body.runID).candidate:null;if(body.runID&&!candidate)throw new ProjectError('This run has no candidate to verify',409);const snapshot=candidate||project.snapshot;const gate=requireReleaseReady(body.report as VerificationReport,runDigest(snapshot));return json({gate,runID:body.runID||null});}
   case 'visualCompare':{const evidence=buildVisualEvidence({...body,referenceOnly:body.referenceOnly===true});assertComparableVisualEvidence(evidence);return json({evidence});}
   case 'draftMerge':{store.getProject(owner,body.id);const result=new DraftService().merge(workspace.principal.workspaceId,body.base as never,body.ours as never,body.theirs as never);return json({result},result.conflicts.length?409:200);}
  }
 }catch(error){return failure(error);}
}
