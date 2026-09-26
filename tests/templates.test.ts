import test from 'node:test';
import assert from 'node:assert/strict';
import { compileProject } from '../lib/projects/preview';
import { scanProject } from '../lib/security/app-scan';
import { STARTER_TEMPLATES, starterTemplate } from '../lib/templates/starters';

test('every starter template compiles in the isolated preview and passes the security scan', async () => {
  assert.ok(STARTER_TEMPLATES.length >= 5);
  assert.equal(new Set(STARTER_TEMPLATES.map(template => template.id)).size, STARTER_TEMPLATES.length);
  for (const template of STARTER_TEMPLATES) {
    const compiled = await compileProject({files: template.files, assets: {}});
    assert.ok(compiled.html.length > 1000, template.id);
    assert.deepEqual(scanProject(template.files).findings, [], template.id);
  }
  assert.equal(starterTemplate('loja')?.name, 'Loja virtual');
  assert.equal(starterTemplate('nao-existe'), undefined);
});
