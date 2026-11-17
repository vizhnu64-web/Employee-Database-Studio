import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  buildGoogleOAuthScopes,
  buildRequestedScopeMetadata,
} from './routes/googleAuth';
import {
  extractSpreadsheetId,
  WORKSHEET_SCHEMAS,
  REQUIRED_WORKSHEETS,
} from './services/googleSheets';
import { extractDriveFolderId } from './services/googleDrive';
import { extractBearerToken } from './middleware/googleAuth';
import { app } from '../../server';

function startGoogleTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

test('extractSpreadsheetId accepts Google Sheets URLs/raw IDs and rejects Drive folder URLs or paths', () => {
  assert.equal(
    extractSpreadsheetId('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0'),
    '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
  );
  assert.equal(
    extractSpreadsheetId('https://docs.google.com/spreadsheets/u/1/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/view'),
    '1AbCdEfGhIjKlMnOpQrStUvWxYz123456'
  );
  assert.equal(
    extractSpreadsheetId('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'),
    '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
  );
  assert.equal(
    extractSpreadsheetId('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrSt'),
    null
  );
  assert.equal(extractSpreadsheetId('https://example.com/sheet/123'), null);
  assert.equal(extractSpreadsheetId('too-short'), null);
});

test('extractDriveFolderId accepts Drive folder URLs/raw IDs and rejects Spreadsheet URLs or non-folder paths', () => {
  assert.equal(
    extractDriveFolderId('https://drive.google.com/drive/folders/1H9sK2L3mNpQrStUvWxYz123456?usp=sharing'),
    '1H9sK2L3mNpQrStUvWxYz123456'
  );
  assert.equal(
    extractDriveFolderId('https://drive.google.com/drive/u/0/folders/1FolderIdAlphaBeta987654'),
    '1FolderIdAlphaBeta987654'
  );
  assert.equal(
    extractDriveFolderId('https://drive.google.com/open?id=1OpenParamFolderId98765'),
    '1OpenParamFolderId98765'
  );
  assert.equal(
    extractDriveFolderId('1H9sK2L3mNpQrStUvWxYz123456'),
    '1H9sK2L3mNpQrStUvWxYz123456'
  );
  assert.equal(
    extractDriveFolderId('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'),
    null
  );
  assert.equal(extractDriveFolderId('not/a/folder/id'), null);
});

test('buildGoogleOAuthScopes and buildRequestedScopeMetadata enforce least-privilege & optional Gmail opt-in', () => {
  const baseScopes = buildGoogleOAuthScopes();
  assert.ok(baseScopes.includes('openid'));
  assert.ok(baseScopes.includes('email'));
  assert.ok(baseScopes.includes('profile'));
  assert.ok(baseScopes.includes('https://www.googleapis.com/auth/drive.file'));
  assert.ok(baseScopes.includes('https://www.googleapis.com/auth/spreadsheets'));
  assert.equal(baseScopes.includes('https://www.googleapis.com/auth/gmail.send'), false);

  const withGmail = buildGoogleOAuthScopes({ includeGmail: true });
  assert.equal(withGmail.includes('https://www.googleapis.com/auth/gmail.send'), true);

  const metaWithoutGmail = buildRequestedScopeMetadata(baseScopes);
  assert.equal(metaWithoutGmail.length, 4);
  assert.equal(metaWithoutGmail.find((s) => s.key === 'drive')?.granted, true);
  assert.equal(metaWithoutGmail.find((s) => s.key === 'sheets')?.granted, true);
  assert.equal(metaWithoutGmail.find((s) => s.key === 'gmail')?.granted, false);
  assert.equal(metaWithoutGmail.find((s) => s.key === 'gmail')?.optional, true);
});

test('WORKSHEET_SCHEMAS defines all 10 required HR worksheets with Version optimistic-concurrency columns', () => {
  assert.equal(REQUIRED_WORKSHEETS.length, 10);
  const expectedNames = [
    'Employees',
    'Salary Structures',
    'Payroll Batches',
    'Payroll Details',
    'Manual Payslips',
    'Payslip History',
    'Email Logs',
    'Company Settings',
    'Layout Settings',
    'Synchronization Logs',
  ];
  assert.deepEqual(REQUIRED_WORKSHEETS, expectedNames);
  assert.ok(WORKSHEET_SCHEMAS.Employees.includes('Version'));
  assert.ok(WORKSHEET_SCHEMAS['Layout Settings'].includes('Version'));
  assert.ok(WORKSHEET_SCHEMAS['Synchronization Logs'].includes('Sync ID'));
});

test('extractBearerToken validates Bearer Authorization header cleanly', () => {
  assert.equal(extractBearerToken({ headers: { authorization: 'Bearer ya29.test_token_123' } } as any), 'ya29.test_token_123');
  assert.equal(extractBearerToken({ headers: { authorization: 'Bearer null' } } as any), null);
  assert.equal(extractBearerToken({ headers: { authorization: 'Basic abc' } } as any), null);
  assert.equal(extractBearerToken({ headers: {} } as any), null);
});

test('Stateless Google Workspace endpoints respond cleanly over HTTP with Bearer token isolation', async () => {
  const { server, baseUrl } = await startGoogleTestServer();

  try {
    // 1. Health check reports Google Sheets + Drive + GIS architecture
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health: any = await healthRes.json();
    assert.equal(health.architecture?.database, 'google_sheets');
    assert.equal(health.architecture?.fileStorage, 'google_drive');
    assert.equal(health.architecture?.authentication, 'google_identity_services_client_in_memory');
    assert.equal(health.checks?.googleSheets?.statelessProxyReady, true);
    assert.equal(health.checks?.googleDrive?.statelessProxyReady, true);

    // 2. Public /api/google/config reports client_gis_in_memory & 4 scopes without any secret
    const cfgRes = await fetch(`${baseUrl}/api/google/config`);
    assert.equal(cfgRes.status, 200);
    const cfgJson: any = await cfgRes.json();
    assert.equal(cfgJson.success, true);
    assert.equal(cfgJson.authModel, 'client_gis_in_memory');
    assert.equal(cfgJson.clientSecret, undefined);
    assert.equal(cfgJson.requestedScopesMetadata.length, 4);

    // 3. /api/google/verify-session rejects missing tokens with 401
    const unauthVerify = await fetch(`${baseUrl}/api/google/verify-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(unauthVerify.status, 401);

    // 4. Protected /api/sheets/* & /api/drive/* enforce Google Bearer OAuth
    const unauthSheets = await fetch(`${baseUrl}/api/sheets/status`);
    assert.equal(unauthSheets.status, 401);
    const unauthDrive = await fetch(`${baseUrl}/api/drive/status`);
    assert.equal(unauthDrive.status, 401);

    // 5. Spreadsheet & Drive URL verification reject malformed URLs cleanly
    const badSheetRes = await fetch(`${baseUrl}/api/sheets/verify-url`, {
      method: 'POST',
      headers: { Authorization: 'Bearer fake.test.token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetUrl: 'https://drive.google.com/drive/folders/abc1234567890' }),
    });
    assert.equal(badSheetRes.status, 400);

    const badDriveRes = await fetch(`${baseUrl}/api/drive/verify-url`, {
      method: 'POST',
      headers: { Authorization: 'Bearer fake.test.token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderUrl: 'https://docs.google.com/spreadsheets/d/abc12345678901234567/edit' }),
    });
    assert.equal(badDriveRes.status, 400);

    // 6. Revoke works cleanly even when unauthenticated
    const revokeRes = await fetch(`${baseUrl}/api/google/revoke`, { method: 'POST' });
    assert.equal(revokeRes.status, 200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
