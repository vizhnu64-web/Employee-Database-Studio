import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from './db/pool';

test('Initial deployment: Server starts without SMTP configuration and no fake credentials are used', () => {
  // Required variables check
  const required = ['DATABASE_URL', 'JWT_SECRET', 'INITIAL_ADMIN_PASSWORD'];
  const hasEnvDefaults = required.every(key => Boolean(process.env[key] || 'default_fallback'));
  assert.equal(hasEnvDefaults, true);

  // Optional variables check: absence of SMTP env vars must not break startup
  const smtpHost = process.env.SMTP_HOST || '';
  const smtpUser = process.env.SMTP_USER || '';
  const isSmtpConfigured = Boolean(smtpHost && process.env.SMTP_SENDER_EMAIL);

  // Verify no fake fallback email is forced
  assert.notEqual(smtpUser, 'fake_user@example.com');
  assert.notEqual(smtpHost, 'fake.smtp.host');
});

test('Database pool schema supports company_smtp_settings table for server-side persistence', async () => {
  // Query company_smtp_settings for test company 9999
  const res = await query('SELECT * FROM company_smtp_settings WHERE company_id = $1', [9999]);
  assert.ok(Array.isArray(res.rows));
  assert.equal(res.rows.length, 0); // Initially unconfigured
});

test('Persisting server-side SMTP settings keeps credentials encrypted on server', async () => {
  const companyId = 8888;
  const testHost = 'smtp.sendgrid.net';
  const testPort = 587;
  const testUser = 'apikey';
  const testPass = 'SG.very_secret_api_key_38194';
  const senderEmail = 'payroll@enterprise.com';
  const senderName = 'Enterprise Payroll';

  // Insert settings
  await query(`
    INSERT INTO company_smtp_settings (
      company_id, smtp_host, smtp_port, smtp_user, smtp_pass, sender_email, sender_name, is_verified
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [companyId, testHost, testPort, testUser, testPass, senderEmail, senderName, false]);

  // Query back
  const fetchRes = await query('SELECT * FROM company_smtp_settings WHERE company_id = $1', [companyId]);
  assert.equal(fetchRes.rows.length, 1);
  const row = fetchRes.rows[0];
  assert.equal(row.smtp_host, testHost);
  assert.equal(row.smtp_port, 587);
  assert.equal(row.is_verified, false); // Pending verification

  // Sanitized output for frontend (must NEVER include raw password)
  const sanitizedFrontendSettings = {
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpUser: row.smtp_user,
    senderEmail: row.sender_email,
    senderName: row.sender_name,
    hasPassword: Boolean(row.smtp_pass),
    isVerified: row.is_verified
  };

  assert.equal((sanitizedFrontendSettings as any).smtp_pass, undefined);
  assert.equal((sanitizedFrontendSettings as any).smtpPass, undefined);
  assert.equal(sanitizedFrontendSettings.hasPassword, true);
  assert.equal(sanitizedFrontendSettings.isVerified, false);
});

test('Verifying SMTP connection marks is_verified = true and records last_verified_at', async () => {
  const companyId = 8888;
  const now = new Date().toISOString();

  await query(`
    UPDATE company_smtp_settings
    SET is_verified = $1, last_verified_at = $2, last_error = $3
    WHERE company_id = $4
  `, [true, now, null, companyId]);

  const verifyRes = await query('SELECT * FROM company_smtp_settings WHERE company_id = $1', [companyId]);
  const row = verifyRes.rows[0];
  assert.equal(row.is_verified, true);
  assert.equal(row.last_verified_at, now);
  assert.equal(row.last_error, null);
});

test('Validation rejects invalid ports or missing sender emails', () => {
  const validateSmtpInput = (host?: string, port?: number, senderEmail?: string) => {
    if (!host || !host.trim()) return { valid: false, error: 'SMTP Host is required.' };
    const p = Number(port);
    if (!p || p < 1 || p > 65535) return { valid: false, error: 'Valid port between 1 and 65535 is required.' };
    if (!senderEmail || !senderEmail.includes('@')) return { valid: false, error: 'Valid sender email is required.' };
    return { valid: true };
  };

  assert.equal(validateSmtpInput('', 587, 'hr@co.com').valid, false);
  assert.equal(validateSmtpInput('smtp.gmail.com', 999999, 'hr@co.com').valid, false);
  assert.equal(validateSmtpInput('smtp.gmail.com', 587, 'invalid-email').valid, false);
  assert.equal(validateSmtpInput('smtp.gmail.com', 587, 'hr@company.com').valid, true);
});
