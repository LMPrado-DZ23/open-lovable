import {studioAccess} from '@/lib/identity/request';
import {accountFailure} from '@/lib/identity/http';
import {loadModelCatalog} from '@/lib/ai/provider-catalog';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request):Promise<Response> {
 try{
  const projectId=new URL(request.url).searchParams.get('projectId')||undefined;
  const access=await studioAccess(request,projectId);if(access instanceof Response)return access;
  access.guard(projectId);
  const catalog=await loadModelCatalog(request.signal,access.scope);access.guard(projectId);
  return Response.json({...catalog,profile:access.mode,workspaceId:access.workspace.principal.workspaceId},{headers:{'Cache-Control':'no-store','Vary':'Cookie'}});
 }catch(error){return accountFailure(error);}
}
