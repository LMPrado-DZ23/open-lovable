import {z} from 'zod';
export const digestSchema=z.string().regex(/^[a-f0-9]{64}$/);
export const admissionManifestSchema=z.object({
 id:z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
 sourceURL:z.string().url().refine(value=>{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash;},'An HTTPS source without credentials is required'),
 revision:z.string().regex(/^[a-f0-9]{40}$/),
 licensePath:z.string().min(1).max(300),licenseDigest:digestSchema,
 paths:z.array(z.string().min(1).max(300)).min(1).max(200),
 artifactDigests:z.record(digestSchema),dependencyDigests:z.array(digestSchema).max(1000),
 purpose:z.string().min(1).max(240),requiredPermissions:z.array(z.string().regex(/^[a-z0-9:_-]{1,100}$/)).max(100),
 maintenanceStatus:z.enum(['active','archived','unknown']),
}).strict();
export type AdoptionManifest=z.infer<typeof admissionManifestSchema>;
export interface AdmissionApproval {manifestDigest:string;reviewer:string;decision:'allowed'|'conditional'|'denied';expiresAt:string;evidenceDigest:string;restrictedPathsReviewed:readonly string[];}
export interface AdmissionDecision {status:'allowed'|'conditional'|'denied';approvedDigest?:string;reasons:string[];}
