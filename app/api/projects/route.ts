import { z } from 'zod';
import { authorizeOperatorRequest } from '@/lib/security/operator-access';
import { readJsonObject, ClientInputError } from '@/lib/security/input-validation';
import { SecretContentError, redactSecretText, safeLogger } from '@/lib/security/secret-content';
import { ProviderConfigError } from '@/lib/ai/provider-catalog';
import { projectStore, operatorID, ProjectError } from '@/lib/projects/store';
import { importProjectZip, exportProjectZip } from '@/lib/projects/archive';
import { compileProject } from '@/lib/projects/preview';
import { streamProjectRun } from '@/lib/projects/generation';

export const dynamic='force-dynamic';
export const runtime='nodejs';
const id=z.string().uuid();const version=z.number().int().min(1);
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),name:z.string().min(1).max(120),model:z.string().max(240)}).strict(),
 z.object({action:z.literal('save'),id,version,snapshot:z.unknown(),label:z.string().min(1).max(200)}).strict(),
 z.object({action:z.literal('import'),id,version,archive:z.string().max(16*1024*1024)}).strict(),
 z.object({action:z.literal('restore'),id,version,revisionID:id}).strict(),
 z.object({action:z.literal('generate'),id,version,requestKey:z.string().min(8).max(128),prompt:z.string().min(1).max(32768),model:z.string().min(1).max(240)}).strict(),
 z.object({action:z.literal('cancel'),id,runID:id}).strict(),
 z.object({action:z.literal('accept'),id,version,runID:id}).strict(),
 z.object({action:z.literal('preview'),id,runID:id.optional(),channel:z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)}).strict(),
 z.object({action:z.literal('document'),id,name:z.string().min(1).max(200),content:z.string().min(1).max(200000)}).strict(),
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
 const denied=await authorizeOperatorRequest(request);if(denied)return denied;
 try{
  const params=new URL(request.url).searchParams;const store=projectStore(),owner=operatorID(),projectID=params.get('id');
  if(!projectID)return json({projects:store.listProjects(owner)});
  const project=store.getProject(owner,projectID);
  if(params.get('action')==='preview'){
   const channel=params.get('channel')||'';if(!/^[a-zA-Z0-9_-]{1,128}$/.test(channel))throw new ProjectError('Invalid preview channel');
   const runID=params.get('runID');const snapshot=runID?store.getRun(owner,projectID,runID).candidate:project.snapshot;
   if(!snapshot)throw new ProjectError('This run has no preview candidate',409);
   const compiled=await compileProject(snapshot,channel);
   if(request.signal.aborted)return new Response(null,{status:499});
   return json(compiled);
  }
  if(params.get('action')==='export'){
   const bytes=exportProjectZip(project.snapshot);
   return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="project-${project.id}.zip"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  return json({project,revisions:store.revisions(owner,projectID),runs:store.runs(owner,projectID),messages:store.messages(owner,projectID),documents:store.documents(owner,projectID)});
 }catch(error){return failure(error);}
}
/** Mutations validate bounded input and delegate to transactional, ownership-checked stores. */
export async function POST(request:Request){
 const denied=await authorizeOperatorRequest(request);if(denied)return denied;
 try{
  const body=schema.parse(await readJsonObject(request,18*1024*1024));const store=projectStore(),owner=operatorID();
  switch(body.action){
   case 'create':return json({project:store.createProject(owner,body.name,body.model)},201);
   case 'save':return json({project:store.saveSnapshot(owner,body.id,body.version,body.snapshot,body.label)});
   case 'import':{
    store.getProject(owner,body.id);const imported=importProjectZip(body.archive);
    return json({project:store.saveSnapshot(owner,body.id,body.version,imported.snapshot,'Imported ZIP'),excluded:imported.excluded});
   }
   case 'restore':return json({project:store.restoreRevision(owner,body.id,body.version,body.revisionID)});
   case 'generate':{
    const run=store.beginRun(owner,body.id,body.requestKey,body.prompt,body.model,body.version);
    if(!store.claimRun(owner,body.id,run.id))return json({run});
    return streamProjectRun(store,owner,run,request.signal);
   }
   case 'cancel':return json({run:store.cancelRun(owner,body.id,body.runID)});
   case 'accept':{
    const run=store.getRun(owner,body.id,body.runID);if(!run.candidate)throw new ProjectError('No candidate is awaiting approval',409);
    await compileProject(run.candidate);
    return json({project:store.acceptRun(owner,body.id,body.runID,body.version)});
   }
   case 'preview':{
    const project=store.getProject(owner,body.id);const snapshot=body.runID?store.getRun(owner,body.id,body.runID).candidate:project.snapshot;
    if(!snapshot)throw new ProjectError('This run has no preview candidate',409);
    return json(await compileProject(snapshot,body.channel));
   }
   case 'document':return json({documents:store.addDocument(owner,body.id,body.name,body.content)});
  }
 }catch(error){return failure(error);}
}
