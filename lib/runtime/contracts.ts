import type {CommandResult, SandboxFile, SandboxInfo, SandboxProvider} from '../sandbox/types';
export interface RuntimeIdentity {workspaceId:string;projectId:string;draftId:string;revisionId:string;runId:string;actorId:string;}
export interface RuntimeCapabilities {terminal:boolean;hmr:boolean;browser:boolean;temporaryPersistence:boolean;mobile:boolean;provider:string;version:string;}
export interface RuntimeRef {id:string;identity:RuntimeIdentity;provider:string;sandboxId:string;leaseId:string;createdAt:number;expiresAt:number;capabilities:RuntimeCapabilities;}
export interface ExecutionSpec {argv:string[];cwd?:string;timeoutMs?:number;env?:Record<string,string>;}
export interface RuntimeAdapter {create(identity:RuntimeIdentity):Promise<{sandbox:SandboxInfo;capabilities:RuntimeCapabilities}>;apply(ref:RuntimeRef,files:SandboxFile[]):Promise<void>;execute(ref:RuntimeRef,spec:ExecutionSpec):Promise<CommandResult>;logs(ref:RuntimeRef):Promise<string>;health(ref:RuntimeRef):Promise<boolean>;export(ref:RuntimeRef):Promise<Uint8Array>;destroy(ref:RuntimeRef):Promise<void>;}
export interface RuntimeFactory {createAdapter():RuntimeAdapter;}
export class RuntimeContractError extends Error {constructor(message:string,readonly status=409){super(message);this.name='RuntimeContractError';}}
export function assertRuntimeIdentity(identity:RuntimeIdentity):void {for(const [key,value] of Object.entries(identity)){if(!/^[a-zA-Z0-9_-]{1,128}$/.test(value))throw new RuntimeContractError(`Invalid runtime identity: ${key}`,400);}}
export function providerRuntimeAdapter(provider:SandboxProvider,providerName:string,version='legacy-1'):RuntimeAdapter {
 const quote=(value:string)=>`'${value.replace(/'/g,"'\\''")}'`;
 return {async create(identity){const sandbox=await provider.createSandbox();return {sandbox,capabilities:{terminal:true,hmr:true,browser:false,temporaryPersistence:true,mobile:false,provider:providerName,version}};},async apply(_ref,files){for(const file of files)await provider.writeFile(file.path,file.content);},async execute(_ref,spec){if(!spec.argv.length)throw new RuntimeContractError('Execution argv cannot be empty',400);return provider.runCommand(spec.argv.map(quote).join(' '));},async logs(_ref){return '';},async health(_ref){return provider.isAlive();},async export(_ref){const result=await provider.runCommand('find . -maxdepth 3 -type f -print');return Buffer.from(result.stdout,'utf8');},async destroy(_ref){await provider.terminate();}};
}
