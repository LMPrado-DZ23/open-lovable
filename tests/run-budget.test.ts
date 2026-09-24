import test from 'node:test';
import assert from 'node:assert/strict';
async function budget(){const mod=await import('../lib/budgets/run-limits').catch(()=>({})) as Record<string,any>;assert.equal(typeof mod.resolveRunLimits,'function');return mod;}
test('run limits enforce server ceilings, bounded input/output and explicit privacy without guessing locality',async()=>{
 const {resolveRunLimits}=await budget(),defaults=resolveRunLimits(undefined,'build');assert.equal(defaults.maxOutputTokens,12000);assert.equal(defaults.maxModelCalls,1);assert.equal(defaults.maxRepairs,0);
 assert.equal(resolveRunLimits({maxModelCalls:0,maxOutputTokens:512},'build').maxModelCalls,0);
 for(const input of [{maxOutputTokens:12001},{maxModelCalls:2},{timeoutMs:600001},{maxOutputBytes:99999999},{maxRepairs:1},{price:0},{privacy:'local-only'}])assert.throws(()=>resolveRunLimits(input,'build'));
});
test('lower deployment ceilings are applied and invalid operator limits fail closed',async()=>{
 const {resolveRunLimits}=await budget(),before=process.env.OPEN_LOVABLE_MAX_OUTPUT_TOKENS;
 try{process.env.OPEN_LOVABLE_MAX_OUTPUT_TOKENS='2048';assert.equal(resolveRunLimits(undefined,'build').maxOutputTokens,2048);assert.throws(()=>resolveRunLimits({maxOutputTokens:4096},'build'));
  process.env.OPEN_LOVABLE_MAX_OUTPUT_TOKENS='not-a-number';assert.throws(()=>resolveRunLimits(undefined,'build'));
 }finally{if(before===undefined)delete process.env.OPEN_LOVABLE_MAX_OUTPUT_TOKENS;else process.env.OPEN_LOVABLE_MAX_OUTPUT_TOKENS=before;}
});
