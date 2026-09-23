import { safeLogger } from '@/lib/security/secret-content';
import { streamText } from 'ai';
import { authorizeOperatorRequest } from '@/lib/security/operator-access';
import { readJsonObject, ClientInputError } from '@/lib/security/input-validation';
import { getProviderForModel } from '@/lib/ai/provider-manager';
import { ProviderConfigError } from '@/lib/ai/provider-catalog';

let inFlight = false;
let lastProbe = 0;
export async function POST(request: Request) {
  const denied = await authorizeOperatorRequest(request);
  if (denied) return denied;
  if (inFlight || Date.now()-lastProbe < 3000) return Response.json({success:false,error:'Wait before starting another model test'}, {status:429,headers:{'Retry-After':'3'}});
  inFlight=true;
  try {
    const body = await readJsonObject(request,4096);
    if (body.confirmTokenUse !== true) throw new ClientInputError('Confirm that this test may consume provider tokens');
    const resolved = await getProviderForModel(body.model,request.signal);
    lastProbe=Date.now();
    const started=performance.now();
    const result=streamText({model:resolved.model,onError:({error})=>safeLogger.error('Model probe failed',error),prompt:'Reply with READY.',maxOutputTokens:32,maxRetries:0,
      abortSignal:AbortSignal.any([request.signal,AbortSignal.timeout(30000)])});
    let content='';
    for await (const part of result.fullStream) {
      if (part.type==='error') throw part.error;
      if (part.type==='text-delta') content+=part.text;
    }
    if (!content.trim()) throw new Error('Empty provider response');
    return Response.json({success:true,model:resolved.actualModel,provider:resolved.option.provider,
      checkedAt:new Date().toISOString(),durationMs:Math.round(performance.now()-started),verified:['text','streaming']}, {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    const status = error instanceof ProviderConfigError ? error.status : error instanceof ClientInputError ? 400 : 502;
    return Response.json({success:false,error:status===502 ? 'Model test failed. Check provider credentials, quota, model support and server logs. No fallback was used.' : (error as Error).message}, {status,headers:{'Cache-Control':'no-store'}});
  } finally {inFlight=false;}
}
