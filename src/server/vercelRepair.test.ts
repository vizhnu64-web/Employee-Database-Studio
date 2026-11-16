import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import {
  resolvePostgresConnection,
  normalizePostgresConfig,
  query,
  DatabaseError,
  resetPoolForTesting,
} from './db/pool';
import { getJwtSecret, AuthConfigError } from './middleware/auth';
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

test('PostgreSQL connection resolution supports DATABASE_URL, POSTGRES_URL, and POSTGRES_URL_NON_POOLING', () => {
  const prevDb = process.env.DATABASE_URL;
  const prevPg = process.env.POSTGRES_URL;
  const prevNonPool = process.env.POSTGRES_URL_NON_POOLING;

  try {
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = 'postgresql://user:pass@pooler.supabase.com:6543/postgres?sslmode=require';
    process.env.POSTGRES_URL_NON_POOLING = 'postgresql://user:pass@db.supabase.co:5432/postgres?sslmode=require';

    const runtimeConn = resolvePostgresConnection('runtime');
    assert.equal(runtimeConn.sourceVar, 'POSTGRES_URL');
    assert.ok(runtimeConn.connectionString.includes('6543'));

    const migrationConn = resolvePostgresConnection('migration');
    assert.equal(migrationConn.sourceVar, 'POSTGRES_URL_NON_POOLING');
    assert.ok(migrationConn.connectionString.includes('5432'));

    process.env.DATABASE_URL = 'postgresql://user:pass@custom-pooler.supabase.com:6543/postgres?sslmode=require';
    const overrideConn = resolvePostgresConnection('runtime');
    assert.equal(overrideConn.sourceVar, 'DATABASE_URL');
  } finally {
    if (prevDb !== undefined) process.env.DATABASE_URL = prevDb;
    else delete process.env.DATABASE_URL;
    if (prevPg !== undefined) process.env.POSTGRES_URL = prevPg;
    else delete process.env.POSTGRES_URL;
    if (prevNonPool !== undefined) process.env.POSTGRES_URL_NON_POOLING = prevNonPool;
    else delete process.env.POSTGRES_URL_NON_POOLING;
  }
});

test('PostgreSQL SSL normalization prevents pg v8 ?sslmode=require override while honoring verify-full', () => {
  const supaPooler = normalizePostgresConfig(
    'postgresql://postgres.proj:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true'
  );
  assert.equal(supaPooler.isLocalHost, false);
  assert.equal(supaPooler.sslModeNormalized, true);
  assert.deepEqual(supaPooler.ssl, { rejectUnauthorized: false });
  assert.ok(!supaPooler.connectionString.includes('sslmode=require'));
  assert.ok(supaPooler.connectionString.includes('pgbouncer=true'));

  const strictVerify = normalizePostgresConfig(
    'postgresql://postgres:secret@db.example.com:5432/postgres?sslmode=verify-full'
  );
  assert.deepEqual(strictVerify.ssl, { rejectUnauthorized: true });

  const localDb = normalizePostgresConfig('postgresql://postgres:postgres@localhost:5432/app');
  assert.equal(localDb.isLocalHost, true);
  assert.equal(localDb.ssl, undefined);

  // Regression test: surrounding quotes or KEY= prefix must be stripped so pg-connection-string never falls back to hostname 'base'
  const quoted = normalizePostgresConfig(
    '"postgresql://postgres:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"'
  );
  assert.equal(quoted.host, 'aws-0-ap-south-1.pooler.supabase.com');
  assert.deepEqual(quoted.ssl, { rejectUnauthorized: false });

  assert.throws(
    () => normalizePostgresConfig('base'),
    (err: any) => err instanceof DatabaseError && err.statusCode === 503
  );
  assert.throws(
    () => normalizePostgresConfig('postgresql://user:pass@base:5432/db'),
    (err: any) => err instanceof DatabaseError && err.statusCode === 503
  );
});

test('Production runtime fails safely with 503 instead of falling back to local JSON when DB env is missing', async () => {
  const prevVercel = process.env.VERCEL;
  const prevNodeEnv = process.env.NODE_ENV;
  const prevDb = process.env.DATABASE_URL;
  const prevPg = process.env.POSTGRES_URL;

  try {
    process.env.VERCEL = '1';
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    await resetPoolForTesting();

    await assert.rejects(
      () => query('SELECT 1'),
      (err: any) => err instanceof DatabaseError && err.statusCode === 503
    );
  } finally {
    if (prevVercel !== undefined) process.env.VERCEL = prevVercel;
    else delete process.env.VERCEL;
    if (prevNodeEnv !== undefined) process.env.NODE_ENV = prevNodeEnv;
    else delete process.env.NODE_ENV;
    if (prevDb !== undefined) process.env.DATABASE_URL = prevDb;
    else delete process.env.DATABASE_URL;
    if (prevPg !== undefined) process.env.POSTGRES_URL = prevPg;
    else delete process.env.POSTGRES_URL;
    await resetPoolForTesting();
  }
});

test('JWT secret is mandatory in production and throws AuthConfigError (503) when missing', () => {
  const prevVercel = process.env.VERCEL;
  const prevNodeEnv = process.env.NODE_ENV;
  const prevJwt = process.env.JWT_SECRET;

  try {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '1';
    delete process.env.JWT_SECRET;

    assert.throws(
      () => getJwtSecret(),
      (err: any) => err instanceof AuthConfigError && err.statusCode === 503
    );

    process.env.JWT_SECRET = 'test_production_jwt_secret_value_123456';
    assert.equal(getJwtSecret(), 'test_production_jwt_secret_value_123456');
  } finally {
    if (prevVercel !== undefined) process.env.VERCEL = prevVercel;
    else delete process.env.VERCEL;
    if (prevNodeEnv !== undefined) process.env.NODE_ENV = prevNodeEnv;
    else delete process.env.NODE_ENV;
    if (prevJwt !== undefined) process.env.JWT_SECRET = prevJwt;
    else delete process.env.JWT_SECRET;
  }
});

test('Migration 001 SQL is non-destructive, idempotent, and includes brand columns on companies', () => {
  const migrationPath = path.resolve(process.cwd(), 'migrations', '001_initial_schema.sql');
  assert.equal(fs.existsSync(migrationPath), true);
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  const sqlNoComments = sql.replace(/--.*$/gm, '');
  const upper = sqlNoComments.toUpperCase();

  assert.equal(upper.includes('DROP TABLE'), false, 'Migration must not drop tables');
  assert.equal(upper.includes('TRUNCATE'), false, 'Migration must not truncate tables');
  assert.equal(upper.includes('DELETE FROM'), false, 'Migration must not delete existing rows');
  assert.ok(sql.includes('schema_migrations'));
  assert.ok(sql.includes('secondary_color'));
  assert.ok(sql.includes('accent_color'));
  assert.ok(sql.includes('brand_colors_json'));
});

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

test('Frontend code never references SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY', () => {
  const srcRoot = path.resolve(process.cwd(), 'src');
  const violations: string[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'server' || entry.name === 'node_modules') continue;
        walk(fullPath);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (content.includes('SUPABASE_SERVICE_ROLE_KEY') || content.includes('SUPABASE_SECRET_KEY')) {
          violations.push(fullPath);
        }
      }
    }
  }

  walk(srcRoot);
  assert.deepEqual(violations, []);
});

test('Express app health, auth isolation, and storage tenant checks respond cleanly over HTTP', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    // 1. Health endpoint
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson: any = await healthRes.json();
    assert.equal(healthJson.app, 'Employee Database Studio Enterprise Cloud');
    assert.ok(healthJson.checks?.database);
    assert.ok(healthJson.checks?.storage);

    // 2. Storage status with valid dev JWT
    const token = jwt.sign({ id: 1, companyId: 1, username: 'admin', role: 'admin' }, getJwtSecret(), { expiresIn: '1h' });
    const statusRes = await fetch(`${baseUrl}/api/storage/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(statusRes.status, 200);
    const statusJson: any = await statusRes.json();
    assert.equal(statusJson.accessMode, 'private');
    assert.deepEqual(statusJson.buckets, ['employee-documents', 'company-assets', 'payslip-pdfs', 'import-files']);

    // 3. Cross-tenant signed-url isolation check (companyId 1 requesting company 999 path)
    const crossTenantRes = await fetch(`${baseUrl}/api/storage/signed-url?bucket=employee-documents&path=999/test/doc.pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(crossTenantRes.status, 403);

    // 4. Download requires auth or valid HMAC token (no hardcoded fallback secret)
    const unauthDownload = await fetch(`${baseUrl}/api/storage/download?bucket=employee-documents&path=1/test.pdf`);
    assert.equal(unauthDownload.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
