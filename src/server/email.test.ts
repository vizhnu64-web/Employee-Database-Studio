import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  getResolvedSmtpConfig,
  validateSmtpInput,
  isSingleRecipientEmail,
  buildMimeRawMessage,
  resetRuntimeEmailStateForTesting,
} from './routes/email';
import { app } from '../../server';

function startEmailTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

test('Initial deployment: Server resolves SMTP cleanly from env without fake credentials', () => {
  resetRuntimeEmailStateForTesting();
  const prevHost = process.env.SMTP_HOST;
  const prevSender = process.env.SMTP_SENDER_EMAIL;
  const prevUser = process.env.SMTP_USER;

  try {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_SENDER_EMAIL;
    delete process.env.SMTP_USER;

    const cfg = getResolvedSmtpConfig();
    assert.equal(cfg.source, 'unconfigured');
    assert.equal(cfg.isConfigured, false);
    assert.equal(cfg.smtpHost, '');
    assert.notEqual(cfg.smtpUser, 'fake_user@example.com');
  } finally {
    if (prevHost !== undefined) process.env.SMTP_HOST = prevHost;
    else delete process.env.SMTP_HOST;
    if (prevSender !== undefined) process.env.SMTP_SENDER_EMAIL = prevSender;
    else delete process.env.SMTP_SENDER_EMAIL;
    if (prevUser !== undefined) process.env.SMTP_USER = prevUser;
    else delete process.env.SMTP_USER;
  }
});

test('validateSmtpInput rejects missing host, invalid port, or malformed sender email', () => {
  assert.equal(validateSmtpInput({ smtpHost: '', smtpPort: 587, senderEmail: 'hr@co.com' }).valid, false);
  assert.equal(validateSmtpInput({ smtpHost: 'smtp.gmail.com', smtpPort: 999999, senderEmail: 'hr@co.com' }).valid, false);
  assert.equal(validateSmtpInput({ smtpHost: 'smtp.gmail.com', smtpPort: 587, senderEmail: 'invalid-email' }).valid, false);
  assert.equal(validateSmtpInput({ smtpHost: 'smtp.gmail.com', smtpPort: 587, senderEmail: 'hr@company.com' }).valid, true);
});

test('isSingleRecipientEmail allows exactly one valid email and rejects multiple or malformed addresses', () => {
  assert.equal(isSingleRecipientEmail('employee@company.com'), true);
  assert.equal(isSingleRecipientEmail('one@company.com, two@company.com'), false);
  assert.equal(isSingleRecipientEmail('one@company.com;two@company.com'), false);
  assert.equal(isSingleRecipientEmail('not-an-email'), false);
  assert.equal(isSingleRecipientEmail(''), false);
});

test('buildMimeRawMessage constructs base64url MIME payload with PDF attachment and strips CRLF header injection', () => {
  const raw = buildMimeRawMessage({
    from: 'Payroll HR <hr@company.com>\r\nBcc: evil@attacker.com',
    to: 'staff@company.com',
    subject: 'Payslip October 2026\r\nCc: leak@attacker.com',
    bodyText: 'Attached is your payslip.',
    attachmentName: 'Payslip_EMP001.pdf',
    pdfBase64: 'data:application/pdf;base64,JVBERi0xLjQK',
  });

  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  assert.ok(decoded.includes('To: staff@company.com'));
  assert.ok(decoded.includes('Content-Type: application/pdf; name="Payslip_EMP001.pdf"'));
  assert.ok(decoded.includes('JVBERi0xLjQK'));
  assert.ok(!decoded.includes('\r\nBcc: evil@attacker.com'));
  assert.ok(!decoded.includes('\r\nCc: leak@attacker.com'));
});

test('Company SMTP runtime memory settings work independently of Google OAuth and never expose smtpPass', async () => {
  resetRuntimeEmailStateForTesting();
  const { server, baseUrl } = await startEmailTestServer();

  try {
    // 1. PUT /api/email/settings without Google Bearer token succeeds (SMTP is independent)
    const putRes = await fetch(`${baseUrl}/api/email/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smtpHost: 'smtp.sendgrid.net',
        smtpPort: 587,
        smtpUser: 'apikey',
        smtpPass: 'SG.very_secret_api_key_38194',
        senderEmail: 'payroll@enterprise.com',
        senderName: 'Enterprise Payroll',
      }),
    });
    assert.equal(putRes.status, 200);
    const putJson: any = await putRes.json();
    assert.equal(putJson.success, true);
    assert.equal(putJson.source, 'runtime_memory');
    assert.equal(putJson.isVerified, false);

    // 2. GET /api/email/settings never exposes smtpPass or smtp_pass
    const getRes = await fetch(`${baseUrl}/api/email/settings`);
    assert.equal(getRes.status, 200);
    const getJson: any = await getRes.json();
    assert.equal(getJson.success, true);
    assert.equal(getJson.isConfigured, true);
    assert.equal(getJson.settings.smtpHost, 'smtp.sendgrid.net');
    assert.equal(getJson.settings.smtpPort, 587);
    assert.equal(getJson.settings.hasPassword, true);
    assert.equal(getJson.settings.smtpPass, undefined);
    assert.equal(getJson.settings.smtp_pass, undefined);

    // 3. GET /api/email/status works cleanly offline without Google connected
    const statusRes = await fetch(`${baseUrl}/api/email/status`);
    assert.equal(statusRes.status, 200);
    const statusJson: any = await statusRes.json();
    assert.equal(statusJson.success, true);
    assert.equal(statusJson.smtpConfigured, true);
    assert.equal(statusJson.googleConnected, false);
    assert.equal(statusJson.gmailConnected, false);

    // 4. POST /api/email/test rejects malformed recipient cleanly
    const badTestRes = await fetch(`${baseUrl}/api/email/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail: 'not-an-email' }),
    });
    assert.equal(badTestRes.status, 400);

    // 5. POST /api/email/send via Gmail without Google Bearer token fails cleanly with 401
    const unauthGmailRes = await fetch(`${baseUrl}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'gmail',
        recipientEmail: 'emp@company.com',
        subject: 'Payslip',
        bodyText: 'Hello',
      }),
    });
    assert.equal(unauthGmailRes.status, 401);
    const unauthGmailJson: any = await unauthGmailRes.json();
    assert.equal(unauthGmailJson.code, 'GOOGLE_AUTH_REQUIRED');
  } finally {
    resetRuntimeEmailStateForTesting();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
