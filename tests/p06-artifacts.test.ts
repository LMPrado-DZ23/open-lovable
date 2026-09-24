import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {LocalArtifactStore} from '../lib/artifacts/store';
import {QuotaService} from '../lib/quotas/service';
import {ProjectError} from '../lib/projects/store';

test('P06 local artifacts preserve digest and refuse another tenant',()=>{const root=mkdtempSync(join(tmpdir(),'artifacts-'));try{const store=new LocalArtifactStore(root),data=Buffer.from('source bytes'),ref=store.put('workspace_a','project_a',data,'text/plain','source');assert.deepEqual(store.get(ref,'workspace_a','project_a'),data);assert.throws(()=>store.get(ref,'workspace_b','project_b'),(e)=>e instanceof ProjectError&&e.status===404);assert.throws(()=>store.put('../escape','project_a',data,'text/plain','source'),/scope/i);}finally{rmSync(root,{recursive:true,force:true});}});
test('P06 quotas include archived classes and reject overage before storage',()=>{const quota=new QuotaService({maxBytes:100,maxArtifacts:2,retentionMs:1000});const usage={source:40,references:20,candidates:0,logs:0,captures:0,research:0,release:0};quota.assertCanStore(usage,'captures',40);assert.throws(()=>quota.assertCanStore(usage,'release',41),/quota/i);assert.equal(quota.retentionCutoff(5000),4000);});
