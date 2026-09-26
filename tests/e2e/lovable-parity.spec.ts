import {test,expect} from '@playwright/test';
import {zipSync,strToU8} from 'fflate';

const app=`export default function App(){return <main className="p-8"><h1>Loja da Ana</h1><a href="https://example.com" target="_blank" rel="noopener noreferrer">Contato</a></main>}`;

test('home prompt, instructions, security scan, publish, undo, duplicate and theme work like Lovable',async({page,request})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Vamos criar algo'})).toBeVisible();
 const name='Loja '+Date.now();
 await page.getByLabel('Descreva o que você quer construir').fill(name);
 await page.getByRole('button',{name:'Começar a construir'}).click();
 await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
 const projectURL=page.url(),projectId=projectURL.split('/').pop()!;
 await expect(page.getByLabel('Descreva a alteração',{exact:true})).toHaveValue(name);

 await page.getByLabel('Importar ZIP',{exact:true}).setInputFiles({name:'app.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync({'src/App.jsx':strToU8(app)}))});
 await expect(page.getByTestId('project-version')).toHaveText('Revisão 2');
 await expect(page.frameLocator('iframe[title="Prévia isolada"]').getByRole('heading',{name:'Loja da Ana'})).toBeVisible();

 await page.getByRole('tab',{name:'Referências',exact:true}).click();
 await page.getByRole('textbox',{name:'Instruções do projeto'}).fill('Use sempre português do Brasil.');
 await page.getByRole('button',{name:'Salvar instruções'}).click();
 await expect(page.getByRole('status').filter({hasText:'Instruções do projeto salvas'})).toBeVisible();

 await page.getByRole('tab',{name:'Segurança',exact:true}).click();
 await page.getByRole('button',{name:'Verificar segurança'}).click();
 await expect(page.getByText('Nenhum problema encontrado pelas regras automáticas.')).toBeVisible();

 await page.getByRole('button',{name:'Publicar',exact:true}).click();
 await page.getByRole('button',{name:'Gerar site'}).click();
 await expect(page.getByText('Revisão 2 publicada.')).toBeVisible();
 const published=await request.get('/p/'+projectId);
 expect(published.status()).toBe(200);
 expect(published.headers()['content-security-policy']).toMatch(/^sandbox allow-scripts/);
 expect(await published.text()).toContain('Loja da Ana');
 await page.getByRole('button',{name:'Fechar'}).click();

 await page.getByRole('button',{name:'Desfazer',exact:true}).click();
 await expect(page.getByTestId('project-version')).toHaveText('Revisão 3');
 await expect(page.getByText('Seu projeto começa aqui')).toBeVisible();

 await page.getByRole('button',{name:'Tema escuro'}).click();
 await expect(page.locator('html')).toHaveClass(/dark/);
 await page.reload();
 await expect(page.locator('html')).toHaveClass(/dark/);
 await page.getByRole('button',{name:'Tema claro'}).click();
 await expect(page.locator('html')).not.toHaveClass(/dark/);

 await page.getByRole('button',{name:'Duplicar',exact:true}).click();
 await expect(page).not.toHaveURL(projectURL);
 await expect(page.getByRole('heading',{name:'Cópia de '+name})).toBeVisible();
 expect(errors).toEqual([]);
});

test('a starter template opens as a working project and the team can comment on it',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await page.getByRole('tab',{name:'Modelos',exact:true}).click();
 await page.getByRole('button',{name:/^Landing page SaaS/}).click();
 await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
 await expect(page.getByTestId('project-version')).toHaveText('Revisão 2');
 await expect(page.frameLocator('iframe[title="Prévia isolada"]').getByRole('heading',{name:'Organize sua empresa em um só lugar'})).toBeVisible();
 await page.getByRole('tab',{name:'Comentários',exact:true}).click();
 await page.getByLabel('Novo comentário').fill('Trocar o nome da marca');
 await page.getByLabel('Sobre o arquivo').selectOption('src/App.jsx');
 await page.getByRole('button',{name:'Comentar'}).click();
 await expect(page.getByText('Trocar o nome da marca')).toBeVisible();
 await page.getByRole('button',{name:'Marcar como resolvido'}).click();
 await expect(page.getByText('Nenhum comentário em aberto.')).toBeVisible();
 await page.reload();
 await page.getByRole('tab',{name:'Comentários',exact:true}).click();
 await page.getByLabel('Mostrar resolvidos').check();
 await expect(page.getByText('Trocar o nome da marca')).toBeVisible();
 expect(errors).toEqual([]);
});
