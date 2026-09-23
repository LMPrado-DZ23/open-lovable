/** Additive, transactional SQLite migrations. Never edit an applied migration. */
export const migrations = [{version:1, sql:`
CREATE TABLE projects (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, model TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version >= 1), snapshot TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX projects_owner ON projects(owner, updated_at);
CREATE TABLE revisions (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), version INTEGER NOT NULL,
 label TEXT NOT NULL, snapshot TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(project_id, version)
) STRICT;
CREATE TABLE runs (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), request_key TEXT NOT NULL,
 prompt TEXT NOT NULL, model TEXT NOT NULL, base_version INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('RUNNING','AWAITING_APPROVAL','SUCCEEDED','FAILED','CANCELLED','INTERRUPTED')),
 candidate TEXT, explanation TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '',
 lease_until INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(project_id,request_key)
) STRICT;
CREATE UNIQUE INDEX one_active_project_run ON runs(project_id) WHERE state IN ('RUNNING','AWAITING_APPROVAL');
CREATE TABLE messages (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), run_id TEXT REFERENCES runs(id),
 role TEXT NOT NULL CHECK(role IN ('user','assistant','system')), content TEXT NOT NULL, created_at TEXT NOT NULL
) STRICT;
CREATE INDEX messages_project ON messages(project_id,created_at);
CREATE TABLE run_events (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id),
 type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL
) STRICT;
CREATE TABLE provider_settings (
 owner TEXT NOT NULL, provider TEXT NOT NULL, version INTEGER NOT NULL,
 encrypted TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(owner,provider)
) STRICT;
CREATE TABLE project_documents (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL,
 content TEXT NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(project_id,sha256)
) STRICT;
`},{version:2,sql:`
CREATE TABLE execution_claims (
 run_id TEXT PRIMARY KEY REFERENCES runs(id), created_at TEXT NOT NULL
) STRICT;
CREATE INDEX events_by_run ON run_events(run_id,sequence);
`}];
