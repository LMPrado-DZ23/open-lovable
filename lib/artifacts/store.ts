import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {ProjectError} from '../projects/store';
export interface ArtifactRef {workspaceId:string;projectId:string;digest:string;mediaType:string;bytes:number;storageKey:string;}
export interface ArtifactManifest extends ArtifactRef {id:string;kind:'source'|'reference'|'candidate'|'log'|'capture'|'release'|'research';createdAt:string;}
const digest=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
const safe=(value:string)=>/^[a-zA-Z0-9_-]{1,128}$/.test(value);
export class LocalArtifactStore {
 constructor(private readonly root:string){mkdirSync(resolve(root),{recursive:true,mode:0o700});}
 private key(workspaceId:string,projectId:string,digestValue:string){if(!safe(workspaceId)||!safe(projectId)||!/^[a-f0-9]{64}$/.test(digestValue))throw new ProjectError('Invalid artifact scope',400);return join(resolve(this.root),workspaceId,projectId,digestValue);}
 put(workspaceId:string,projectId:string,data:Uint8Array,mediaType:string,kind:ArtifactManifest['kind']):ArtifactManifest {if(data.byteLength>32*1024*1024)throw new ProjectError('Artifact exceeds the 32 MiB limit',413);const d=digest(data),storageKey=this.key(workspaceId,projectId,d);mkdirSync(join(resolve(this.root),workspaceId,projectId),{recursive:true,mode:0o700});if(!statSafe(storageKey))writeFileSync(storageKey,data,{flag:'wx',mode:0o600});return {id:randomUUID(),workspaceId,projectId,digest:d,mediaType,bytes:data.byteLength,storageKey,kind,createdAt:new Date().toISOString()};}
 get(ref:ArtifactRef,workspaceId:string,projectId:string):Buffer {if(ref.workspaceId!==workspaceId||ref.projectId!==projectId)throw new ProjectError('Artifact not found',404);const expected=this.key(workspaceId,projectId,ref.digest);if(ref.storageKey!==expected)throw new ProjectError('Artifact not found',404);let data:Buffer;try{data=readFileSync(expected);}catch{throw new ProjectError('Artifact not found',404);}if(digest(data)!==ref.digest)throw new ProjectError('Artifact integrity check failed',503);return data;}
}
function statSafe(path:string){try{statSync(path);return true;}catch{return false;}}
