import { validateProviderURL } from '@/lib/ai/provider-transport';
import { z } from 'zod';
import { authorizeOperatorRequest } from '@/lib/security/operator-access';
import { readJsonObject, ClientInputError } from '@/lib/security/input-validation';
import { credentialStore, providerIDs, effectiveProvider } from '@/lib/settings/store';
import { operatorID, ProjectError } from '@/lib/projects/store';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const schema=z.object({provider:z.enum(providerIDs),version:z.number().int().min(0),enabled:z.boolean(),baseURL:z.string().max(2048).optional(),apiKey:z.string().max(8192).optional(),clearKey:z.boolean().optional(),models:z.array(z.string().max(200)).max(500).optional()}).strict();
export async function GET(request:Request) {
 const denied=await authorizeOperatorRequest(request);if(denied)return denied;
 try {
  const saved=credentialStore().metadata(operatorID());
  return Response.json({providers:providerIDs.map(provider=>{
   const value=effectiveProvider(provider);if(value.baseURL)validateProviderURL(value.baseURL,true);const metadata=saved.find(item=>item.provider===provider);
   return {provider,version:metadata?.version||0,source:value.source,enabled:value.enabled,baseURL:value.baseURL,credentialConfigured:Boolean(value.apiKey),models:value.models||[]};
  })},{headers:{'Cache-Control':'no-store'}});
 }catch {return Response.json({error:'Unable to read encrypted settings. Check the private data directory and master key.'},{status:503});}
}
export async function POST(request:Request) {
 const denied=await authorizeOperatorRequest(request);if(denied)return denied;
 try {
  // This dedicated credential endpoint accepts bounded secrets; it never logs or returns their values.
  const body=schema.parse(await readJsonObject(request,16384,false));
  if(effectiveProvider(body.provider).source==='environment')throw new ProjectError('This provider is managed by environment variables. Remove the deployment override before editing it here.',409);
  credentialStore().save(operatorID(),body.provider,body.version,body);
  return Response.json({success:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error) {
  const status=error instanceof ProjectError?error.status:error instanceof ClientInputError||error instanceof z.ZodError?400:400;
  return Response.json({error:error instanceof ProjectError?error.message:'Invalid settings. Use an HTTPS endpoint or explicitly configured loopback, and review the fields.'},{status,headers:{'Cache-Control':'no-store'}});
 }
}
