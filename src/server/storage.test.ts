import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {
  buildCanonicalDriveFolderUrl,
  createGoogleDriveClient,
  extractDriveFolderId,
  GoogleDriveError,
} from './services/googleDrive';
import { app } from '../../server';

function startStorageTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

test('Google Drive service enforces access token and builds canonical folder URLs', () => {
  assert.throws(
    () => createGoogleDriveClient(''),
    (err: any) => err instanceof GoogleDriveError && err.statusCode === 401
  );

  const client = createGoogleDriveClient('ya29.test_access_token', 'https://drive.google.com/drive/folders/1FolderAlphaBeta123');
  assert.equal(client.rootFolderId, '1FolderAlphaBeta123');
  assert.equal(client.folderUrl, 'https://drive.google.com/drive/folders/1FolderAlphaBeta123');
  assert.equal(buildCanonicalDriveFolderUrl('1FolderAlphaBeta123'), 'https://drive.google.com/drive/folders/1FolderAlphaBeta123');
});

test('extractDriveFolderId rejects invalid or non-folder URLs cleanly', () => {
  assert.equal(extractDriveFolderId(''), null);
  assert.equal(extractDriveFolderId('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'), null);
  assert.equal(extractDriveFolderId('https://drive.google.com/drive/folders/1MyFolderId_98765?usp=share_link'), '1MyFolderId_98765');
});

test('Server Drive, Documents, and Backup modules contain zero local disk fallback writes', () => {
  const filesToCheck = [
    path.resolve(process.cwd(), 'src', 'server', 'services', 'googleDrive.ts'),
    path.resolve(process.cwd(), 'src', 'server', 'services', 'googleSheets.ts'),
    path.resolve(process.cwd(), 'src', 'server', 'routes', 'documents.ts'),
    path.resolve(process.cwd(), 'src', 'server', 'routes', 'backup.ts'),
  ];

  for (const filePath of filesToCheck) {
    const source = fs.readFileSync(filePath, 'utf-8');
    assert.equal(/\bfrom\s+['"](?:node:)?fs(?:\/promises)?['"]/.test(source), false, `Unexpected fs import in ${filePath}`);
    assert.equal(/\bmkdirSync\b|\bwriteFileSync\b|\bappendFileSync\b/.test(source), false, `Unexpected sync disk write in ${filePath}`);
  }
});

test('Document, Drive, Logo, and Backup endpoints enforce Bearer Google OAuth cleanly', async () => {
  const { server, baseUrl } = await startStorageTestServer();
  try {
    const unauthDocs = await fetch(`${baseUrl}/api/documents/EMP001`);
    assert.equal(unauthDocs.status, 401);

    const unauthUpload = await fetch(`${baseUrl}/api/documents/upload`, { method: 'POST' });
    assert.equal(unauthUpload.status, 401);

    const unauthDriveFiles = await fetch(`${baseUrl}/api/drive/files`);
    assert.equal(unauthDriveFiles.status, 401);

    const unauthLogo = await fetch(`${baseUrl}/api/settings/logo`, { method: 'POST' });
    assert.equal(unauthLogo.status, 401);

    const unauthBackup = await fetch(`${baseUrl}/api/backup/export`);
    assert.equal(unauthBackup.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
