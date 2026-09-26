import { scanSecretContent } from './secret-content';

/**
 * Static security review of a generated project, in the spirit of Lovable's
 * security scan. Heuristic by design: it points at code to review, it does
 * not certify an app as safe.
 */
export type Severity = 'alta' | 'média' | 'baixa';
export interface ScanFinding {rule: string; severity: Severity; file: string; line: number; message: string; fix: string}

interface Rule {id: string; severity: Severity; pattern: RegExp; message: string; fix: string; files?: RegExp}

const CODE = /\.(jsx?|tsx?|mjs|cjs|html|vue|svelte)$/i;
const RULES: Rule[] = [
  {id: 'eval', severity: 'alta', pattern: /\beval\s*\(|\bnew\s+Function\s*\(/, message: 'Executa texto como código (eval/new Function).', fix: 'Remova eval/new Function; use lógica explícita ou JSON.parse para dados.'},
  {id: 'html-injection', severity: 'alta', pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|document\.write\s*\(/, message: 'Insere HTML bruto na página, o que abre espaço para XSS.', fix: 'Renderize o conteúdo como texto ou sanitize com uma biblioteca como DOMPurify antes de inserir.'},
  {id: 'client-secret-env', severity: 'alta', pattern: /\b(?:VITE|NEXT_PUBLIC|REACT_APP)_[A-Z0-9_]*(?:SECRET|PRIVATE|SERVICE_ROLE|PASSWORD)[A-Z0-9_]*/, message: 'Variável secreta exposta ao navegador por um prefixo público.', fix: 'Segredos só podem ficar no servidor; o navegador deve chamar uma função de backend.'},
  {id: 'service-role', severity: 'alta', pattern: /service_role|serviceRoleKey/i, message: 'Chave de serviço (acesso total) referenciada no frontend.', fix: 'Use apenas a chave pública/anon no navegador e mova operações privilegiadas para o servidor.'},
  {id: 'insecure-http', severity: 'média', pattern: /["'`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^"'`\s]+/, message: 'Recurso carregado sem HTTPS.', fix: 'Troque o endereço para https://.'},
  {id: 'blank-target', severity: 'baixa', pattern: /target\s*=\s*["']_blank["'](?![^>]*rel\s*=\s*["'][^"']*noopener)/, message: 'Link abre nova aba sem rel="noopener noreferrer".', fix: 'Adicione rel="noopener noreferrer" aos links com target="_blank".'},
  {id: 'token-in-storage', severity: 'média', pattern: /localStorage\.setItem\(\s*["'`][^"'`]*(?:token|senha|password|secret)[^"'`]*["'`]/i, message: 'Token ou senha guardado no localStorage (acessível a qualquer script da página).', fix: 'Prefira cookies HttpOnly definidos pelo servidor para sessões.'},
  {id: 'password-in-url', severity: 'média', pattern: /[?&](?:password|senha|token|apikey|api_key)=/i, message: 'Credencial enviada na URL (fica em históricos e logs).', fix: 'Envie credenciais no corpo de uma requisição POST ou em cabeçalhos.'},
  {id: 'wildcard-post-message', severity: 'média', pattern: /postMessage\([^)]*,\s*["']\*["']\s*\)/, message: 'postMessage com destino "*" pode vazar dados para outras janelas.', fix: 'Informe a origem exata de destino em vez de "*".'},
];

export function scanProject(files: Record<string, string>): {findings: ScanFinding[]; filesScanned: number; summary: Record<Severity, number>} {
  const findings: ScanFinding[] = [];
  let filesScanned = 0;
  for (const [file, content] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    if (typeof content !== 'string' || content.length > 2_000_000) continue;
    filesScanned++;
    const lines = content.split('\n');
    const secretKinds = scanSecretContent(content);
    if (secretKinds.length) {
      const line = Math.max(1, lines.findIndex(text => scanSecretContent(text).length > 0) + 1);
      findings.push({rule: 'hardcoded-secret', severity: 'alta', file, line, message: `Possível credencial escrita no código (${secretKinds.join(', ')}).`, fix: 'Remova a credencial do código, revogue-a no provedor e leia de uma variável de ambiente no servidor.'});
    }
    if (!CODE.test(file)) continue;
    for (const rule of RULES) {
      if (rule.files && !rule.files.test(file)) continue;
      lines.forEach((text, index) => {
        if (rule.pattern.test(text) && findings.filter(item => item.rule === rule.id && item.file === file).length < 5) {
          findings.push({rule: rule.id, severity: rule.severity, file, line: index + 1, message: rule.message, fix: rule.fix});
        }
      });
    }
  }
  const order: Record<Severity, number> = {alta: 0, 'média': 1, baixa: 2};
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.file.localeCompare(b.file) || a.line - b.line);
  const summary = {alta: 0, 'média': 0, baixa: 0} as Record<Severity, number>;
  for (const finding of findings) summary[finding.severity]++;
  return {findings, filesScanned, summary};
}
