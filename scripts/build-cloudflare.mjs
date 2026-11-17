import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

// Keep deployment settings separate from local development and the realtime Worker.
const deploymentEnv = existsSync('.env.cloudflare.local')
  ? dotenv.parse(readFileSync('.env.cloudflare.local'))
  : {};
const { vars } = JSON.parse(readFileSync('wrangler.web.jsonc', 'utf8'));
const result = spawnSync('node_modules/.bin/opennextjs-cloudflare', ['build', '--config', 'wrangler.web.jsonc'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...vars,
    ...deploymentEnv,
    CLOUDFLARE_WEB: 'true',
    NEXT_BUILD_DIR: '.next',
    NEXT_TELEMETRY_DISABLED: '1',
    WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || '/tmp/ve-cung-toi-wrangler.log',
  },
});
process.exitCode = result.status ?? 1;
