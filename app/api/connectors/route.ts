import { z } from 'zod';
import { studioAccess } from '@/lib/identity/request';
import { ProjectError } from '@/lib/projects/store';
import { readJsonObject, ClientInputError } from '@/lib/security/input-validation';
import { connectorSecretStatus, saveConnectorSecret } from '@/lib/connectors/project-connectors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = {'Cache-Control': 'no-store'};
const schema = z.object({connector: z.string().regex(/^[a-z0-9-]{2,40}$/), values: z.record(z.string().max(2000)).nullable()}).strict();

/**
 * Secret connector keys. Like provider and integration credentials, this is the one
 * route that accepts key material: it is stored encrypted and only "saved" is reported back.
 */
export async function POST(request: Request) {
  try {
    const access = await studioAccess(request); if (access instanceof Response) return access; access.requireAdmin();
    const body = schema.parse(await readJsonObject(request, 16 * 1024, false));
    saveConnectorSecret(access.settingsOwner, body.connector, body.values);
    return Response.json({secrets: connectorSecretStatus(access.settingsOwner)}, {headers: noStore});
  } catch (error) {
    const status = error instanceof ProjectError ? error.status : 400;
    const message = error instanceof ProjectError || error instanceof ClientInputError ? error.message : 'Dados inválidos para o conector.';
    return Response.json({error: message}, {status, headers: noStore});
  }
}
