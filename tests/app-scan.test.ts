import test from 'node:test';
import assert from 'node:assert/strict';
import { scanProject } from '../lib/security/app-scan';

test('security scan flags the risky patterns a generated app should not ship', () => {
  const result = scanProject({
    'src/App.jsx': [
      'export default function App(){',
      '  const run = eval(input);',
      '  return <div dangerouslySetInnerHTML={{__html: bio}}><a href="https://x.com" target="_blank">x</a><img src="http://example.com/a.png"/></div>',
      '}',
    ].join('\n'),
    'src/api.js': 'localStorage.setItem("auth_token", token); fetch(`/login?password=${p}`);',
    'src/config.js': 'const key = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;',
    'README.md': 'Use a chave sk-123456789012345678901234567890 no teste',
  });
  const rules = new Set(result.findings.map(finding => finding.rule));
  for (const rule of ['eval', 'html-injection', 'blank-target', 'insecure-http', 'token-in-storage', 'password-in-url', 'client-secret-env', 'hardcoded-secret']) assert.ok(rules.has(rule), rule);
  assert.equal(result.findings[0].severity, 'alta', 'most severe first');
  assert.equal(result.findings.find(finding => finding.rule === 'eval')?.line, 2);
  assert.equal(result.filesScanned, 4);
});

test('a clean app and safe links produce no findings', () => {
  const result = scanProject({'src/App.jsx': 'export default function App(){return <a href="https://x.com" target="_blank" rel="noopener noreferrer">ok</a>}', 'src/dev.js': 'fetch("http://localhost:3000/api")'});
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.summary, {alta: 0, 'média': 0, baixa: 0});
});
