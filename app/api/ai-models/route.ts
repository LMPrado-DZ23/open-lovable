import { authorizeOperatorRequest } from '@/lib/security/operator-access';
import { loadModelCatalog } from '@/lib/ai/provider-catalog';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const denied = await authorizeOperatorRequest(request);
  if (denied) return denied;
  try {
    return Response.json(await loadModelCatalog(request.signal), {headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({success:false,error:'Model catalog unavailable'}, {status:503,headers:{'Cache-Control':'no-store'}});
  }
}
