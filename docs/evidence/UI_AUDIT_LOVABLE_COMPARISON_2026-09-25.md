# Auditoria visual comparativa — Open Lovable vs. Lovable

**Data:** 2026-09-25
**Projeto auditado:** `LMPrado-DZ23/open-lovable`
**Branch:** `feat/manus-p06-p10-p11-20260924`
**Escopo:** home pública, identidade visual, proposta de produto, responsividade e prontidão do runtime de preview.

## Conclusão executiva

A percepção do usuário está correta: **a interface atual não se parece com o Lovable**. Ela é, na prática, a interface e o design system herdados do Firecrawl/open-lovable original, com o nome “Open Lovable” colocado sobre a experiência de clonagem de websites.

Isso não é somente uma diferença de cor ou gosto visual. Há um **desalinhamento de produto, linguagem e arquitetura de interação**:

- o Lovable comunica “descreva um produto e construa um app full-stack”;
- a home auditada comunica “insira uma URL ou termo de busca para clonar/reimaginar um website”;
- a home auditada exibe logo, ícone, CTA e vocabulário Firecrawl;
- o Lovable organiza a criação em conta → workspace → projeto → chat → preview/código → publicação;
- a home auditada prioriza URL, estilos visuais e scraping.

**Classificação:** P0 — desalinhamento de identidade/proposta principal.

## Evidência visual

| Viewport | Evidência |
|---|---|
| Desktop 1280×720 | [home-desktop.png](./ui-audit-2026-09-25/home-desktop.png) |
| Tablet 768×900 | [home-tablet.png](./ui-audit-2026-09-25/home-tablet.png) |
| Mobile 375×812 | [home-mobile.png](./ui-audit-2026-09-25/home-mobile.png) |

A tela renderizada mostra: logo Firecrawl, ícone de chama, “Use this Template”, badge “Website Builder”, “Open Lovable v3”, “Clone brand format or re-imagine any website, in seconds.”, “Powered by Firecrawl.” e um campo “Enter URL or search term...”.

## Comparação com a referência oficial

A página pública atual do Lovable apresenta a mensagem **“Build something Lovable”**, com o CTA **“Ask Lovable”** e o posicionamento de plataforma para criar, iterar e gerenciar produtos e negócios. A documentação oficial define a experiência como:

> “full-stack AI development platform for building, iterating on, and deploying web applications using natural language, with real code, security, and enterprise governance.”

A documentação também descreve os conceitos centrais como **Account, Workspace, Project e Chats**, com preview, código, histórico, publicação e sincronização Git.

Fontes consultadas:

- [Lovable homepage](https://lovable.dev)
- [Lovable documentation — Welcome](https://docs.lovable.dev/introduction/welcome)

## Achados priorizados

### P0 — Identidade da marca está errada

**Evidência no render:** logo e texto `Firecrawl`; CTA `Use this Template`; selo `Powered by Firecrawl.`
**Evidência no código:**

- `app/page.tsx:233-244` usa `HeaderBrandKit`, `GithubIcon` e “Use this Template”;
- `app/page.tsx:262-273` usa a mensagem de clone, “Powered by Firecrawl.” e links `Conexões de IA`/`Projetos salvos`;
- `components/FirecrawlLogo.tsx` e `components/FirecrawlIcon.tsx` são dependências diretas da identidade;
- `styles/design-system/colors.css` é explicitamente comentado como `Fire Design System Colors` e define heat orange `#fa5d19`/`#ff6600`.

**Impacto:** o usuário entende que está usando um produto Firecrawl ou um template Firecrawl, não o Open Lovable como plataforma de desenvolvimento de aplicações.

**Correção necessária:** criar identidade Open Lovable própria, remover Firecrawl do shell visual e reservar Firecrawl apenas para a integração técnica de scraping, com disclosure contextual quando essa integração for usada.

### P0 — Proposta da home é de clonador de websites, não de app builder

**Evidência:** hero “Clone brand format or re-imagine any website, in seconds.” e input de URL.
**Impacto:** a primeira ação não é descrever uma ideia de produto nem iniciar um projeto; é fornecer um site externo. Isso contradiz o posicionamento full-stack/chat-first do Lovable.

**Correção necessária:** substituir o hero por uma entrada de prompt de produto, exemplos de prompts e ações para criar/abrir workspace/projeto. URL/importação deve ser uma capacidade secundária.

### P1 — Falta o shell de produto esperado

**Ausências na tela inicial:**

- workspace/account switcher;
- lista de projetos com status e atividade;
- chat de construção como elemento primário;
- preview e código como áreas do projeto;
- histórico/versionamento/publicação;
- onboarding orientado a “primeiro app em minutos”.

Os links atuais `Conexões de IA` e `Projetos salvos` são links soltos sob o hero, não uma navegação de produto equivalente a workspace/projetos.

### P1 — Linguagem e conteúdo inconsistentes

A UI mistura português (`Conexões de IA`, `Projetos salvos`) com inglês (`Use this Template`, `Website Builder`, `Enter URL or search term...`, `Powered by Firecrawl`). O `<html lang="en">` em `app/layout.tsx:39` também não corresponde a uma experiência predominantemente em português no render auditado.

**Correção necessária:** definir locale e content model explícitos; evitar mistura incidental de idiomas; usar linguagem de produto consistente.

### P1 — Sistema visual herdado e não diferenciado

O design system tem comentários, tokens e componentes Firecrawl:

- `styles/design-system/colors.css:1` — `Fire Design System Colors`;
- tokens `heat-*`, `accent-amethyst`, `accent-bluetron` e `accent-crimson`;
- `styles/fire.css`, componentes `firecrawl-icon`, `FirecrawlLogo`, `hero-flame`, `ascii-explosion`.

O hero tem estética de grade técnica, ASCII, chama e laranja “heat”. Isso é uma assinatura visual coerente de Firecrawl, mas não comunica o produto Lovable/documentado como workspace de desenvolvimento com chat, preview e código.

### P1 — Runtime de produção local não inicia com o build atual

Durante a auditoria, `node scripts/start-studio.mjs --hostname 0.0.0.0 --port 3000` falhou com:

```text
TypeError: routesManifest.dataRoutes is not iterable
```

O modo dev iniciou após configuração de origem local, mas o processo foi encerrado por `exit 137` em tentativas sob pressão de memória. Isso precisa ser corrigido antes de usar a aplicação como referência de screenshots de produção.

**Hipóteses a investigar:** build Next stale/incompatível, `.next` gerado com versão/estrutura diferente, ou artefato parcial após pressão de memória. O diagnóstico deve começar com limpeza/rebuild controlado e não com alteração visual.

### P2 — Responsividade básica funciona, mas a composição é de landing page, não de produto

Nos screenshots mobile/tablet não há overflow crítico e o campo se adapta para largura disponível. Porém, o layout permanece uma landing page centrada em hero e input, sem navegação de workspace, projeto ou chat. Portanto, a responsividade técnica não corrige o desalinhamento de produto.

## Diagnóstico de causa raiz

A rota principal `app/page.tsx` implementa diretamente um produto de scraping/clonagem:

1. valida URL ou termo de busca;
2. chama `/api/search` para resultados;
3. guarda `targetUrl`, estilo e modelo em `sessionStorage`;
4. direciona para `/generation`;
5. oferece extensão de brand styles.

O componente `app/landing.tsx` também está acoplado a Firecrawl e contém os mesmos padrões. Há, portanto, **dois shells de home divergentes**, ambos orientados a Firecrawl, o que aumenta o risco de uma futura correção visual ser aplicada na rota errada.

## O que está bom

- A home tem hierarquia visual legível e um CTA principal claro.
- O input é reconhecível e se adapta no mobile.
- O contraste preto/branco/laranja é forte.
- Há uma direção visual consistente dentro do sistema Firecrawl.
- A implementação funcional de scraping/clonagem parece deliberada, não um placeholder.

Esses pontos não compensam o fato de que a experiência auditada representa outro produto.

## Plano recomendado de correção

### Fase 1 — alinhar identidade e proposta

1. Definir `Open Lovable Design Language` independente.
2. Criar logo/wordmark Open Lovable e remover Firecrawl do header/hero.
3. Reescrever hero para “descreva o app que quer construir”.
4. Fazer chat/prompt ser o CTA primário.
5. Mover URL cloning/import para ação secundária “Importar um site”.

### Fase 2 — alinhar shell de produto

1. Adicionar account/workspace switcher.
2. Criar home com projetos recentes, templates e CTA “Novo projeto”.
3. Fazer a tela de projeto ter três áreas reconhecíveis: chat, preview e código.
4. Adicionar estados de projeto: rascunho, construindo, publicado, erro.
5. Expor histórico/versionamento/publicação sem esconder essas capacidades em links soltos.

### Fase 3 — polir linguagem e sistema visual

1. Escolher locale principal e traduzir o shell inteiro.
2. Remover nomes/comments/classes Firecrawl do design system público.
3. Definir tokens de cor, tipografia, raio, sombra e espaçamento Open Lovable.
4. Validar foco, headings, landmarks e 200% zoom.
5. Revalidar em 375, 768, 1280 e 1920 px.

### Fase 4 — estabilizar runtime de inspeção

1. Reproduzir `routesManifest.dataRoutes is not iterable` em modo production.
2. Limpar `.next` e reconstruir com limite de memória controlado.
3. Executar `npm run build`, `npm run start` e smoke test HTTP.
4. Capturar screenshots pós-correção com o mesmo conjunto de viewports.

## Veredito

O projeto tem uma base funcional ampla, mas **a camada de produto visível não entrega o que o nome Open Lovable promete**. O usuário não está errado ao dizer que “não parece nada com o Lovable”. A prioridade correta não é adicionar mais pacotes de backend; é substituir o shell Firecrawl por uma experiência de app builder/chat/workspace coerente com Lovable e com as capacidades que o backend já implementa.

**Status da auditoria:** `P0/P1 visual-product mismatch confirmed`
**Correções aplicadas nesta auditoria:** nenhuma; somente evidência e diagnóstico foram registrados.
**Próximo passo recomendado:** autorizar uma refatoração visual de Fase 1 e estabilização do runtime de preview antes de declarar paridade de produto.
