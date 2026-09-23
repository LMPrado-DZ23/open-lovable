import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const testDataRoot=mkdtempSync(join(tmpdir(),'open-lovable-browser-data-'));
import { defineConfig } from '@playwright/test';

// Test-only credentials for a loopback server, never a deployment default.
const password = 'playwright-local-test-password-not-for-production';
export default defineConfig({
  testDir:'./tests/e2e',
  fullyParallel:false,
  workers:1,
  retries:0,
  timeout:45_000,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:3100', httpCredentials:{username:'admin',password,origin:'http://127.0.0.1:3100',send:'always'},trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:[{command:'node tests/fixtures/ai-gateway.mjs',url:'http://127.0.0.1:3101/ready',reuseExistingServer:false}, {
    command:'npm run start -- --hostname 127.0.0.1 --port 3100',
    url:'http://127.0.0.1:3100',reuseExistingServer:false,timeout:120_000,
    env:{OPEN_LOVABLE_DATA_DIR:testDataRoot,OPEN_LOVABLE_DISABLE_SAVED_SETTINGS:'0',OPENAI_API_KEY:'',ANTHROPIC_API_KEY:'',GEMINI_API_KEY:'',GROQ_API_KEY:'',AI_GATEWAY_API_KEY:'',OPENAI_BASE_URL:'',ANTHROPIC_BASE_URL:'',GEMINI_BASE_URL:'',GROQ_BASE_URL:'',OPEN_LOVABLE_APP_ORIGIN:'http://127.0.0.1:3100',OPEN_LOVABLE_USERNAME:'admin',OPEN_LOVABLE_PASSWORD:password,OPEN_LOVABLE_GATEWAY_URL:'http://127.0.0.1:3101/v1',OPEN_LOVABLE_GATEWAY_API_KEY:'browser-contract-fixture',OPEN_LOVABLE_GATEWAY_MODELS:''},
  }],
});
