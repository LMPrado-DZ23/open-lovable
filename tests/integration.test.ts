import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('every exported API handler rejects unauthenticated production requests before side effects',async()=>{
  const original = {...process.env};
  Object.assign(process.env,{NODE_ENV:'production',OPEN_LOVABLE_APP_ORIGIN:'https://builder.example',OPEN_LOVABLE_PASSWORD:'test-password-with-at-least-thirty-two-characters'});
  try {
    let checked=0;
    for(const entry of await readdir('app/api',{withFileTypes:true})) {
      if(!entry.isDirectory()) continue;
      const route = await import(pathToFileURL(resolve('app/api',entry.name,'route.ts')).href);
      for(const method of ['GET','POST','DELETE','PATCH','PUT','OPTIONS','HEAD']) {
        if(typeof route[method] !== 'function') continue;
        const response=await route[method](new Request(`https://builder.example/api/${entry.name}`,{method,headers:{host:'builder.example'}}));
        assert.equal(response.status,401,`${method} /api/${entry.name}`); checked++;
      }
    }
    assert.ok(checked>=30,`Only ${checked} API handlers were checked`);
  } finally {
    for(const key of Object.keys(process.env)) if(!(key in original)) delete process.env[key];
    Object.assign(process.env,original);
  }
});
