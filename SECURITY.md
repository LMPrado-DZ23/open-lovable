# Security and deployment scope

This branch hardens the existing **single-operator** builder. It is not a multi-user SaaS release.
The legacy cloud builder's global sandbox and conversation state remain shared by the operator's browser sessions. The separate durable `/projects` workflow does not use those globals.
Do not share a deployment or its credentials among mutually untrusted users.

## Access configuration

Production requires OPEN_LOVABLE_APP_ORIGIN and OPEN_LOVABLE_PASSWORD (32 to 512 characters).
OPEN_LOVABLE_USERNAME defaults to admin. Use a password-manager-generated unique secret.
The password must stay in server environment variables, never NEXT_PUBLIC variables or source control.
Public deployments require HTTPS. The reverse proxy must preserve the original Host header.
The application rejects Host/Origin mismatches and cross-site requests. Browser authentication
uses the native HTTP Basic dialog; passwords are not persisted in browser localStorage.

Development binds to 127.0.0.1. Never tunnel or reverse-proxy an unauthenticated development
server. Configure credentials before access from another machine. For internet exposure,
add VPN/private access or a hardened reverse proxy with throttling and access logging.
This release does not include distributed rate limiting or fine-grained user authorization.

## Generated code

Generated code and commands are untrusted. The legacy command flow must run only inside E2B/Vercel. The durable preview compiles virtual files without running project scripts on the host, then runs generated JavaScript in a restricted iframe; this is not a hardened multi-user VM boundary.
Do not mount host directories or inject control-plane credentials into generated projects.
Registry package-name validation prevents argument/code interpolation; it does not prove
that npm packages or their lifecycle scripts are trustworthy. Supply-chain review remains required.
Path validation is lexical and does not establish full filesystem isolation against all
symlink races. Provider sandbox isolation remains an independent required boundary.

Legacy API JSON bodies are bounded to 2 MiB. The durable project API allows 18 MiB JSON for encoded uploads, then enforces 8 MiB decoded snapshots and per-file limits. Middleware has a 20 MiB transport ceiling so it does not silently truncate a valid project upload. File changes reject incomplete XML file blocks,
unsafe paths, credential paths, more than 200 files and files larger than 1 MiB.
The legacy sandbox workflow has no transactional multi-file rollback. The durable workflow stores whole-file snapshots transactionally, checks revision versions and requires explicit proposal approval; a conflict does not overwrite the saved version.

## Export limits and secrets

Legacy ZIP export is bounded to 500 files, 2 MiB per file and 8 MiB total before compression. Durable project imports/exports have a 300-file snapshot limit (1 MiB text, 2 MiB asset, 8 MiB total).
Common environment/credential filenames, private-key extensions, build output and symbolic
links are excluded. Binary files are preserved. The legacy data-URL response remains supported;
Accept: application/zip selects a binary response. Both are bounded in-memory exports, not streaming.
Filename filtering cannot identify secrets embedded in arbitrary source files. Review exports
and run secret scanning before distributing them. Real credentials must never enter generated code.

## Diagnostics and validation

Runtime diagnostics inspect the sandbox HTTP endpoint and bounded Vite logs. They do not
execute the application JavaScript or prove rendering; isRendering is explicitly unknown.
A previous error can remain in logs until restart. The browser smoke suite verifies the
builder UI and access/input error paths without creating paid sandboxes or making AI calls.
SDK-boundary unit tests are not live E2B/Vercel integration tests.

## Remaining release blockers

- Full user/tenant isolation: HTTP identity is still a single operator. Durable data methods check owner/project, but this is not multi-user authentication.
- Distributed jobs, durable autonomous workers, automatic legacy-to-project migration and cloud sandbox revision transactions.
- Live AI, Firecrawl, E2B and Vercel end-to-end checks with explicitly authorized credentials.
- Distributed throttling, full log redaction and a complete security review of legacy routes.
- Visual/functional review of generated applications, not only the builder interface.

Never advertise this branch as fully secure, production-certified or multi-tenant ready.

## Durable data and credentials

Data is stored outside the checkout in `OPEN_LOVABLE_DATA_DIR` (default: the server user home `.open-lovable`). Database migrations are versioned and additive. Directory validation rejects nested checkout paths and linked ancestors before creating data. Source content and exported credentials are checked heuristically, not certified secret-free.

Connection values in SQLite are encrypted with AES-256-GCM and owner/provider/version authenticated data. Keep `credentials.key` or the separately configured `OPEN_LOVABLE_MASTER_KEY` private and backed up. Missing/corrupt keys fail closed; the application does not erase stored configuration. Operating-system ACLs and encrypted backups remain deployment responsibilities.

See `docs/durable-projects.md` for backup/recovery and the exact scope of the React preview. Imported source is data, never permission to run scripts, install packages, publish, or access the host.
