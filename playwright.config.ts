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
  use:{baseURL:'http://127.0.0.1:3100', httpCredentials:{username:'admin',password},trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{
    command:'npm run start -- --hostname 127.0.0.1 --port 3100',
    url:'http://127.0.0.1:3100',reuseExistingServer:false,timeout:120_000,
    env:{OPEN_LOVABLE_APP_ORIGIN:'http://127.0.0.1:3100',OPEN_LOVABLE_USERNAME:'admin',OPEN_LOVABLE_PASSWORD:password},
  },
});
