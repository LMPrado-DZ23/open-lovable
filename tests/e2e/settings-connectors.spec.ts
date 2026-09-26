import {test,expect} from '@playwright/test';

test.beforeEach(async({context})=>{await context.addInitScript(()=>{try{localStorage.setItem('open-lovable:auto-apply','off');}catch{}});});

test('settings area has every section and saves workspace knowledge and connector keys',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/settings');
 await expect(page).toHaveURL(/\/settings\/general$/);
 const menu=page.getByRole('navigation',{name:'Configurações'});
 for(const label of ['Geral','Conhecimento','Uso','Preferências','Conexões de IA','Conectores','Integrações','Modelos privados','Dados e backup','Segurança'])await expect(menu.getByRole('link',{name:label,exact:true})).toBeVisible();

 await menu.getByRole('link',{name:'Conhecimento',exact:true}).click();
 const knowledge=page.getByLabel('Instruções para todos os projetos');
 await expect(knowledge).toBeEnabled();
 await knowledge.fill('Escreva tudo em português do Brasil. '+Date.now());
 await page.getByRole('button',{name:'Salvar',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'todos os projetos'})).toBeVisible();

 await menu.getByRole('link',{name:'Uso',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Gerações por dia'})).toBeVisible();

 await menu.getByRole('link',{name:'Conectores',exact:true}).click();
 await page.getByLabel('Buscar conector').fill('Resend');
 const card=page.getByRole('listitem').filter({hasText:'E-mails transacionais.'});
 await card.getByRole('button',{name:/Adicionar chave|Trocar chave/}).click();
 await card.getByLabel('API key').fill('re_e2e_'+Date.now());
 await card.getByRole('button',{name:'Salvar chave'}).click();
 await expect(page.getByRole('status').filter({hasText:'Chave de Resend salva'})).toBeVisible();
 await expect(card.getByText('Chave salva',{exact:true})).toBeVisible();
 await expect(page.locator('input[type="password"]')).toHaveCount(0);

 await menu.getByRole('link',{name:'Dados e backup',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Exportar projetos'})).toBeVisible();
 await menu.getByRole('link',{name:'Segurança',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Proteções ativas'})).toBeVisible();
 expect(errors).toEqual([]);
});

test('a project enables connectors and gets src/lib/connectors.js as a new revision',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Descreva o que você quer construir').fill('Conectores '+Date.now());
 await page.getByRole('button',{name:'Começar a construir'}).click();
 await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
 const before=await page.getByTestId('project-version').textContent();
 await page.getByRole('tab',{name:'Conectores',exact:true}).click();
 await page.getByLabel('Buscar conector').fill('PayPal');
 const card=page.getByRole('listitem').filter({hasText:'Botões de pagamento PayPal.'});
 await card.getByRole('checkbox').check();
 await card.getByLabel('Client ID').fill('test-client-id');
 await page.getByRole('button',{name:'Salvar conectores'}).click();
 await expect(page.getByRole('status').filter({hasText:'Conectores salvos'})).toBeVisible();
 await expect(page.getByTestId('project-version')).not.toHaveText(before??'');
 await page.getByRole('tab',{name:'Código',exact:true}).click();
 await expect(page.getByText('src/lib/connectors.js').first()).toBeVisible();
});
