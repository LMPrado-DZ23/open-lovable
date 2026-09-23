import {test,expect} from '@playwright/test';

test('operator configures a provider in the UI without exposing its saved key',async({page,request})=>{
 await page.goto('/settings/ai');
 await expect(page.getByRole('heading',{name:'Cadastrar e editar conexões'})).toBeVisible();
 await page.getByLabel('Provedor da conexão',{exact:true}).selectOption('openai');
 await page.getByLabel('Chave de API',{exact:true}).fill('fixture-ui-private-key');
 await page.getByLabel('IDs dos modelos',{exact:true}).fill('my-test-model');
 await page.getByRole('button',{name:'Salvar conexão',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Conexão salva'})).toBeVisible();
 await expect(page.getByLabel('Chave de API',{exact:true})).toHaveValue('');
 await page.reload();
 await page.getByLabel('Provedor da conexão',{exact:true}).selectOption('openai');
 await expect(page.getByLabel('Chave de API',{exact:true})).toHaveValue('');
 await expect(page.getByText('Chave armazenada; o valor nunca é devolvido.')).toBeVisible();
 const response=await request.get('/api/provider-settings');
 expect(response.ok()).toBe(true);
 expect(await response.text()).not.toContain('fixture-ui-private-key');
 await page.getByLabel('Limpar chave armazenada',{exact:true}).check();
 await page.getByRole('button',{name:'Salvar conexão',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Conexão salva'})).toBeVisible();
});
