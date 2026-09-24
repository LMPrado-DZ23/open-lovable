import {test,expect} from '@playwright/test';
test('project settings keep the project workspace despite a different session selection',async({browser},info)=>{
 const base='http://127.0.0.1:3102',context=await browser.newContext();
 try{
  const post=async(path:string,data:unknown)=>context.request.post(base+path,{headers:{origin:base},data});
  expect((await post('/api/auth',{action:'login',email:'alice@example.test',password:'identity-contract-password'})).status()).toBe(200);
  const a=await post('/api/workspaces',{action:'create',name:'Workspace project source'});expect(a.status()).toBe(201);const first=(await a.json()).workspace;
  const created=await post('/api/projects',{action:'create',name:'Scoped settings project',model:'gateway/fixture/coder'});expect(created.status()).toBe(201);const {project}=await created.json();
  const b=await post('/api/workspaces',{action:'create',name:'Different selected workspace'});expect(b.status()).toBe(201);const second=(await b.json()).workspace;
  const page=await context.newPage();await page.goto(base+'/projects/'+project.id);
  await expect(page.getByLabel('Workspace',{exact:true})).toHaveValue(first.id);
  await page.getByRole('link',{name:'Conex\u00f5es de IA',exact:true}).click();
  await expect(page.getByLabel('Workspace',{exact:true})).toHaveValue(first.id);
  expect(new URL(page.url()).searchParams.get('projectId')).toBe(project.id);
  const saved=await post('/api/provider-settings?projectId='+project.id,{provider:'gateway',version:0,enabled:true,baseURL:'https://scoped.example/v1',models:['scoped/model']});expect(saved.status()).toBe(200);
  const selected=await context.request.get(base+'/api/provider-settings');expect((await selected.json()).providers.find((p:{provider:string})=>p.provider==='gateway').source).toBe('unconfigured');
  expect((await (await context.request.get(base+'/api/auth')).json()).selectedWorkspaceId).toBe(second.id);
  await page.screenshot({path:info.outputPath('project-settings-context.png'),fullPage:true});
 }finally{await context.close();}
});
