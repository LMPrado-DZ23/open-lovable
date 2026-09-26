import { z } from 'zod';
import { studioAccess } from '@/lib/identity/request';
import { ProjectError } from '@/lib/projects/store';
import { readJsonObject, ClientInputError } from '@/lib/security/input-validation';
import { credentialStore, integrationCredential, integrationIDs } from '@/lib/settings/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = {'Cache-Control': 'no-store'};
const schema = z.object({integration: z.enum(integrationIDs), version: z.number().int().min(0), token: z.string().max(4096).optional(), clear: z.boolean().optional()}).strict();

/** Publishing tokens: stored encrypted, never returned; only "configured" is reported. */
export async function GET(request: Request) {
  try {
    const access = await studioAccess(request); if (access instanceof Response) return access; access.requireAdmin();
    return Response.json({integrations: integrationIDs.map(integration => {
      const credential = integrationCredential(integration, access.scope);
      return {integration, configured: Boolean(credential.token), source: credential.source, version: credential.version};
    })}, {headers: noStore});
  } catch (error) {
    if (error instanceof ProjectError) return Response.json({error: error.message}, {status: error.status, headers: noStore});
    return Response.json({error: 'Não foi possível ler as integrações. Verifique o diretório privado de dados.'}, {status: 503, headers: noStore});
  }
}

export async function POST(request: Request) {
  try {
    const access = await studioAccess(request); if (access instanceof Response) return access; access.requireAdmin();
    const body = schema.parse(await readJsonObject(request, 8192, false));
    if (integrationCredential(body.integration, access.scope).source === 'environment') throw new ProjectError('Esta integração é controlada por variável de ambiente no servidor.', 409);
    const token = body.token?.trim();
    if (token && !/^[A-Za-z0-9_.\-]{8,4096}$/.test(token)) throw new ClientInputError('Token em formato inválido.');
    credentialStore().save(access.settingsOwner, body.integration, body.version, {enabled: true, apiKey: token || undefined, clearKey: body.clear === true});
    return Response.json({success: true}, {headers: noStore});
  } catch (error) {
    const status = error instanceof ProjectError ? error.status : 400;
    const message = error instanceof ProjectError || error instanceof ClientInputError ? error.message : 'Dados inválidos para a integração.';
    return Response.json({error: message}, {status, headers: noStore});
  }
}
