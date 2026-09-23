import sharp from 'sharp';
import {createHash,randomUUID} from 'node:crypto';
import {isBase64} from '@/lib/security/base64';
import {assertNoSecrets} from '@/lib/security/secret-content';
import {ProjectError,type ProjectStore} from './store';

export interface ReferenceImage {
 id:string;project_id:string;name:string;role:'target'|'current';mime:string;
 width:number;height:number;bytes:number;sha256:string;created_at:string;
}
interface StoredImage extends ReferenceImage {data:string;archived:number;}
let decoding=0;
/** Decode raster bytes, enforce budgets, orient/resize and re-encode without EXIF or profiles. */
export async function normalizeReferenceImage(data:unknown) {
 if(typeof data!=='string'||data.length>7*1024*1024||!isBase64(data))throw new ProjectError('Use a valid PNG, JPEG or WebP file up to 5 MiB.');
 const bytes=Buffer.from(data,'base64');
 if(!bytes.length||bytes.length>5*1024*1024)throw new ProjectError('Image exceeds 5 MiB.');
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
 if(!png&&!jpeg&&!webp)throw new ProjectError('Only raster PNG, JPEG and WebP images are accepted.');
 if(decoding>=2)throw new ProjectError('Image processor is busy. Retry after the current upload.',429);
 decoding++;
 try {
  const image=sharp(bytes,{limitInputPixels:20_000_000,failOn:'warning',animated:false});
  const metadata=await image.metadata();
  if(!metadata.width||!metadata.height||metadata.width>8192||metadata.height>8192||(metadata.pages||1)>1)throw new ProjectError('Image dimensions exceed 8192 pixels or contain animation.');
  const resized=image.rotate().resize({width:2048,height:4096,fit:'inside',withoutEnlargement:true});
  const encoded=await (jpeg?resized.jpeg({quality:90}):webp?resized.webp({quality:90}):resized.png({compressionLevel:9})).toBuffer({resolveWithObject:true});
  if(encoded.data.length>3*1024*1024)throw new ProjectError('Normalized image exceeds 3 MiB. Crop or reduce the input.');
  return {data:encoded.data.toString('base64'),mime:jpeg?'image/jpeg':webp?'image/webp':'image/png',width:encoded.info.width,height:encoded.info.height,bytes:encoded.data.length,sha256:createHash('sha256').update(encoded.data).digest('hex')};
 }catch(error){if(error instanceof ProjectError)throw error;throw new ProjectError('Image could not be decoded within its pixel and format limits.');}
 finally{decoding--;}
}
/** Only normalized immutable references live here; archives retain evidence used by past runs. */
export class ReferenceImageStore {
 constructor(private readonly store:ProjectStore){}
 list(owner:string,projectID:string):ReferenceImage[]{
  this.store.getProject(owner,projectID);
  return this.store.db.prepare('SELECT id,project_id,name,role,mime,width,height,bytes,sha256,created_at FROM project_images WHERE project_id=? AND archived=0 ORDER BY created_at,id').all(projectID) as unknown as ReferenceImage[];
 }
 get(owner:string,projectID:string,id:string):StoredImage {
  this.store.getProject(owner,projectID);
  const row=this.store.db.prepare('SELECT * FROM project_images WHERE project_id=? AND id=? AND archived=0').get(projectID,id);
  if(!row)throw new ProjectError('Image not found',404);
  return row as unknown as StoredImage;
 }
 async add(owner:string,projectID:string,name:string,role:'target'|'current',data:string):Promise<ReferenceImage>{
  this.store.getProject(owner,projectID);
  if(typeof name!=='string'||!name.trim()||name.length>160||/[\\/\p{Cc}]/u.test(name)||!['target','current'].includes(role))throw new ProjectError('Invalid image name or role');
  assertNoSecrets(name);
  const normalized=await normalizeReferenceImage(data),id=randomUUID(),created_at=new Date().toISOString();
  this.store.transaction(()=>{
   this.store.getProject(owner,projectID);
   const quota=this.store.db.prepare('SELECT count(*) AS count, coalesce(sum(bytes),0) AS bytes FROM project_images WHERE project_id=?').get(projectID)!;
   if(Number(quota.count)>=32||Number(quota.bytes)+normalized.bytes>32*1024*1024)throw new ProjectError('Image storage budget reached (32 images / 32 MiB including archived references).',413);
   this.store.db.prepare('INSERT INTO project_images(id,project_id,name,role,mime,width,height,bytes,sha256,data,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,projectID,name.trim(),role,normalized.mime,normalized.width,normalized.height,normalized.bytes,normalized.sha256,normalized.data,created_at);
  });
  return this.list(owner,projectID).find(image=>image.id===id)!;
 }
 archive(owner:string,projectID:string,id:string):void {
  this.get(owner,projectID,id);
  this.store.db.prepare('UPDATE project_images SET archived=1 WHERE project_id=? AND id=?').run(projectID,id);
 }
 forRun(owner:string,projectID:string,runID:string):StoredImage[]{
  const run=this.store.getRun(owner,projectID,runID);
  return run.inputs.images.map(reference=>{
   const row=this.store.db.prepare('SELECT * FROM project_images WHERE project_id=? AND id=?').get(projectID,reference.id) as unknown as StoredImage;
   if(!row||row.sha256!==reference.sha256||createHash('sha256').update(Buffer.from(row.data,'base64')).digest('hex')!==reference.sha256)throw new ProjectError('Run image integrity check failed',503);
   return row;
  });
 }
}
