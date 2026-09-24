import {randomUUID} from 'node:crypto';
import type {SandboxFile,CommandResult} from '../sandbox/types';
import {assertRuntimeIdentity,RuntimeContractError,type ExecutionSpec,type RuntimeAdapter,type RuntimeCapabilities,type RuntimeIdentity,type RuntimeRef} from './contracts';
import {RuntimeLeaseStore,type RuntimeLease} from './leases';
export class RuntimeService {
 private readonly leases:RuntimeLeaseStore;
 constructor(private readonly adapter:RuntimeAdapter,leases:RuntimeLeaseStore|undefined=undefined,private readonly clock=()=>Date.now()){this.leases=leases??new RuntimeLeaseStore(clock);}
 async create(identity:RuntimeIdentity,requestedTtlMs=5*60*1000):Promise<RuntimeRef>{assertRuntimeIdentity(identity);const created=await this.adapter.create(identity);const id=randomUUID(),lease=this.leases.issue(id,identity.actorId,requestedTtlMs);return {id,identity,provider:created.sandbox.provider,sandboxId:created.sandbox.sandboxId,leaseId:lease.id,createdAt:this.clock(),expiresAt:lease.expiresAt,capabilities:created.capabilities};}
 private lease(ref:RuntimeRef,actorId:string):RuntimeLease {if(ref.identity.actorId!==actorId)throw new RuntimeContractError('Runtime actor scope mismatch',403);return this.leases.bind(ref,actorId);}
 async apply(ref:RuntimeRef,actorId:string,files:SandboxFile[]):Promise<void>{this.lease(ref,actorId);if(files.length>500)throw new RuntimeContractError('Runtime file batch exceeds limit',413);await this.adapter.apply(ref,files);}
 async execute(ref:RuntimeRef,actorId:string,spec:ExecutionSpec):Promise<CommandResult>{this.lease(ref,actorId);if(!ref.capabilities.terminal)throw new RuntimeContractError('Runtime terminal capability unavailable',409);return this.adapter.execute(ref,spec);}
 async logs(ref:RuntimeRef,actorId:string):Promise<string>{this.lease(ref,actorId);return this.adapter.logs(ref);}
 async health(ref:RuntimeRef,actorId:string):Promise<boolean>{this.lease(ref,actorId);return this.adapter.health(ref);}
 renew(ref:RuntimeRef,actorId:string,ttlMs=5*60*1000):RuntimeRef {const lease=this.lease(ref,actorId),renewed=this.leases.renew(lease.id,actorId,ttlMs);return {...ref,leaseId:renewed.id,expiresAt:renewed.expiresAt};}
 async destroy(ref:RuntimeRef,actorId:string):Promise<void>{this.lease(ref,actorId);this.leases.revoke(ref.leaseId,actorId);await this.adapter.destroy(ref);}
 capabilities(ref:RuntimeRef,actorId:string):RuntimeCapabilities{this.lease(ref,actorId);return {...ref.capabilities};}
}
