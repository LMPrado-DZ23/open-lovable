import {randomUUID} from 'node:crypto';
import {test,expect} from '@playwright/test';

test('closing the Studio tab never cancels an admitted run and reopening resumes its journal',async({page,context,request},info)=>{
 const response=await request.post('/api/projects',{data:{action:'create',name:'Execucao independente '+Date.now(),model:'gateway/fixture/coder'}});
 const {project}=await response.json(),marker='DURABLE_BROWSER_CLOSE_'+randomUUID();
 await page.goto('/projects/'+project.id);
 await page.getByLabel('Descreva a altera??o',{exact:true}).fill(marker+' Build the page');
 await page.getByLabel('Autorizar consumo de tokens para esta gera??o',{exact:true}).check();
 await page.getByRole('button',{name:'Gerar proposta',exact:true}).click();
 await expect(page.getByRole('button',{name:'Cancelar gera??o',exact:true})).toBeVisible();
 await page.close();
 const reopened=await context.newPage();await reopened.goto('/projects/'+project.id);
 await expect(reopened.getByRole('button',{name:'Aprovar revis?o',exact:true})).toBeVisible({timeout:20000});
 await expect(reopened.getByTestId('project-version')).toHaveText('Revis?o 1');
 await reopened.getByRole('tab',{name:'Execu??es',exact:true}).click();
 await expect(reopened.getByRole('heading',{name:'Execu??o rastre?vel',exact:true})).toBeVisible();
 await expect(reopened.getByText('Proposta compilada',{exact:true})).toBeVisible();
 const stats=await request.get('http://127.0.0.1:3101/stats?marker='+marker,{headers:{authorization:'Bearer browser-contract-fixture'}});expect((await stats.json()).calls).toBe(1);
 await reopened.screenshot({path:info.outputPath('durable-run-journal.png'),fullPage:true});
 await reopened.getByRole('button',{name:'Aprovar revis?o',exact:true}).click();await expect(reopened.getByTestId('project-version')).toHaveText('Revis?o 2');
});

test('versioned execution endpoints reject anonymous and cross-origin requests against the running server',async({request})=>{
 const route='/api/v1/runs';
 const invalid=await request.post(route,{headers:{authorization:'Basic invalid'},data:{}});expect(invalid.status()).toBe(401);
 const foreign=await request.post(route,{headers:{origin:'https://foreign.example'},data:{}});expect(foreign.status()).toBe(403);
});
