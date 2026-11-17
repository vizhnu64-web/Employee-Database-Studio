import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { app } from '../../server';

function startTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

test('Vercel serverless configuration preserves /api/* routes and has catch-all handler', () => {
  const vercelJsonPath = path.resolve(process.cwd(), 'vercel.json');
  const vercelCfg = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));

  assert.equal(vercelCfg.buildCommand, 'vite build');
  assert.equal(vercelCfg.outputDirectory, 'dist');
  const apiStripRewrite = (vercelCfg.rewrites || []).find((r: any) => r.destination === '/api');
  assert.equal(apiStripRewrite, undefined, 'Must not rewrite /api/(.*) -> /api and strip subpaths');

  const catchAllPath = path.resolve(process.cwd(), 'api', '[...route].ts');
  assert.equal(fs.existsSync(catchAllPath), true);
});

test('Codebase has zero PostgreSQL, Supabase, legacy JWT, or server client-secret references', () => {
  const srcRoot = path.resolve(process.cwd(), 'src');
  const forbiddenPatterns = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY',
    'DATABASE_URL',
    'POSTGRES_URL',
    'JWT_SECRET',
    'GOOGLE_CLIENT_SECRET',
    'TOKEN_ENCRYPTION_KEY',
    'peopledesk_auth',
  ];
  const violations: Array<{ file: string; token: string }> = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(fullPath);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        if (entry.name.endsWith('.test.ts')) continue;
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const token of forbiddenPatterns) {
          if (content.includes(token)) {
            violations.push({ file: fullPath, token });
          }
        }
      }
    }
  }

  walk(srcRoot);
  assert.deepEqual(violations, []);
});

test('Client Google Identity Services module stores access tokens strictly in memory (never in localStorage/sessionStorage/IndexedDB)', () => {
  const gisPath = path.resolve(process.cwd(), 'src', 'utils', 'googleAuthClient.ts');
  const source = fs.readFileSync(gisPath, 'utf-8');
  assert.ok(source.includes('https://accounts.google.com/gsi/client'));
  // Only WORKSPACE_LINKS_KEY (non-secret IDs/URLs) may be persisted in localStorage
  const setItemMatches = source.match(/localStorage\.setItem\([^)]+\)/g) || [];
  for (const match of setItemMatches) {
    assert.ok(match.includes('WORKSPACE_LINKS_KEY'), `Unexpected localStorage.setItem: ${match}`);
  }
  assert.equal(source.includes('sessionStorage.setItem'), false);
});

test('Express stateless API health and auth-guarded Sheets routes work without external DB connection', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson: any = await healthRes.json();
    assert.equal(healthJson.status, 'healthy');
    assert.equal(healthJson.app, 'Employee Database Studio Enterprise Cloud');
    assert.equal(healthJson.checks?.googleSheets?.statelessProxyReady, true);
    assert.equal(healthJson.checks?.googleDrive?.statelessProxyReady, true);

    const employeesRes = await fetch(`${baseUrl}/api/employees`);
    assert.equal(employeesRes.status, 401);
    const employeesJson: any = await employeesRes.json();
    assert.equal(employeesJson.code, 'GOOGLE_AUTH_REQUIRED');

    const settingsRes = await fetch(`${baseUrl}/api/settings`);
    assert.equal(settingsRes.status, 401);

    const payslipPdfRes = await fetch(`${baseUrl}/api/payroll/save-payslip-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(payslipPdfRes.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
