import { studioAccess } from '@/lib/identity/request';
import { accountFailure } from '@/lib/identity/http';
import { PUBLIC_SITE_HEADERS, readLocalPublication } from '@/lib/publish/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The locally published build of a project, served sandboxed so its scripts never share the Studio origin. */
export async function GET(request: Request, {params}: {params: Promise<{projectId: string}>}) {
  try {
    const {projectId} = await params;
    if (!/^[0-9a-f-]{36}$/.test(projectId)) return new Response('Not found', {status: 404});
    const access = await studioAccess(request, projectId); if (access instanceof Response) return access;
    access.guard(projectId);
    const publication = readLocalPublication(projectId);
    if (!publication) return new Response('Este projeto ainda não foi publicado.', {status: 404, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    return new Response(publication.html, {headers: PUBLIC_SITE_HEADERS});
  } catch (error) {
    return accountFailure(error);
  }
}
