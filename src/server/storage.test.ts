import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  supabaseStorage,
  SupabaseStorageService,
  StorageServiceError,
  STORAGE_BUCKETS,
} from './storage/supabaseStorage';

test('SupabaseStorageService path sanitization', () => {
  const dirty = '..//company_1/employee\\1004/../records/aadhaar .pdf';
  const clean = supabaseStorage.sanitizeStoragePath(dirty);
  assert.ok(clean.includes('company_1'));
  assert.ok(!clean.includes('..'));
});

test('SupabaseStorageService structured path generation across 4 private buckets', () => {
  const companyId = 1;

  // 1. employee-documents
  const empPath = supabaseStorage.buildStructuredPath({
    companyId,
    bucket: STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS,
    employeeId: 'TBT1004',
    documentType: 'ID Proof',
    fileName: 'Aadhaar Card.pdf'
  });
  assert.ok(empPath.startsWith('1/TBT1004/ID_Proof/'));
  assert.ok(empPath.endsWith('_Aadhaar_Card.pdf'));

  // 2. company-assets
  const assetPath = supabaseStorage.buildStructuredPath({
    companyId,
    bucket: STORAGE_BUCKETS.COMPANY_ASSETS,
    documentType: 'branding',
    fileName: 'Company Logo.png'
  });
  assert.ok(assetPath.startsWith('1/assets/branding/'));
  assert.ok(assetPath.endsWith('_Company_Logo.png'));

  // 3. payslip-pdfs
  const payslipPath = supabaseStorage.buildStructuredPath({
    companyId,
    bucket: STORAGE_BUCKETS.PAYSLIP_PDFS,
    employeeId: 'TBT1004',
    year: 2026,
    month: 'October',
    fileName: 'Payslip_TBT1004.pdf'
  });
  assert.ok(payslipPath.startsWith('1/payslips/2026/October/TBT1004/'));

  // 4. import-files
  const importPath = supabaseStorage.buildStructuredPath({
    companyId,
    bucket: STORAGE_BUCKETS.IMPORT_FILES,
    year: 2026,
    month: 'October',
    fileName: 'Employees_Master.xlsx'
  });
  assert.ok(importPath.startsWith('1/imports/2026/October/'));
});

test('SupabaseStorageService initializes without disk writes and returns 503 when unconfigured', async () => {
  const os = await import('node:os');
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eds-storage-test-'));
  const prevCwd = process.cwd();
  try {
    process.chdir(tmpRoot);
    const fallbackDir = path.resolve(tmpRoot, 'data', 'storage_fallback');
    const service = new SupabaseStorageService(null, '');

    assert.equal(service.isConfigured(), false);
    assert.equal(fs.existsSync(fallbackDir), false, 'Should never create data/storage_fallback on disk');

    await assert.rejects(
      () => service.uploadObject(STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS, '1/emp/doc.txt', Buffer.from('abc'), 'text/plain'),
      (err: any) => err instanceof StorageServiceError && err.statusCode === 503
    );
    assert.equal(fs.existsSync(fallbackDir), false, 'Failed upload must never create local fallback folder');
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  const service = new SupabaseStorageService(null, '');

  await assert.rejects(
    () => service.createSignedUrl(STORAGE_BUCKETS.PAYSLIP_PDFS, '1/payslips/test.pdf', 300),
    (err: any) => err instanceof StorageServiceError && err.statusCode === 503
  );

  await assert.rejects(
    () => service.downloadObject(STORAGE_BUCKETS.IMPORT_FILES, '1/imports/test.xlsx'),
    (err: any) => err instanceof StorageServiceError && err.statusCode === 503
  );
});

test('SupabaseStorageService with configured client performs upload, signed url, download, and delete cleanly', async () => {
  const storedObjects = new Map<string, { buffer: Buffer; mimeType: string }>();

  const mockClient: any = {
    storage: {
      from(bucket: string) {
        return {
          async upload(objPath: string, buffer: Buffer, options: { contentType: string }) {
            storedObjects.set(`${bucket}:${objPath}`, { buffer, mimeType: options.contentType });
            return { data: { fullPath: `${bucket}/${objPath}` }, error: null };
          },
          async createSignedUrl(objPath: string, expiresIn: number) {
            return {
              data: { signedUrl: `https://example.supabase.co/storage/v1/object/sign/${bucket}/${objPath}?token=test&expires=${expiresIn}` },
              error: null,
            };
          },
          async download(objPath: string) {
            const entry = storedObjects.get(`${bucket}:${objPath}`);
            if (!entry) return { data: null, error: { message: 'Object not found' } };
            return {
              data: {
                type: entry.mimeType,
                arrayBuffer: async () => entry.buffer.buffer.slice(entry.buffer.byteOffset, entry.buffer.byteOffset + entry.buffer.byteLength),
              },
              error: null,
            };
          },
          async remove(paths: string[]) {
            for (const p of paths) storedObjects.delete(`${bucket}:${p}`);
            return { data: [], error: null };
          },
        };
      },
    },
  };

  const service = new SupabaseStorageService(mockClient, 'https://example.supabase.co');
  assert.equal(service.isConfigured(), true);

  const bucket = STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS;
  const storagePath = '1/test_emp/records/test_doc.txt';
  const testBuffer = Buffer.from('Employee Database Studio Secure Document Test Payload', 'utf-8');

  const uploadRes = await service.uploadObject(bucket, storagePath, testBuffer, 'text/plain');
  assert.equal(uploadRes.path, storagePath);

  const signedUrl = await service.createSignedUrl(bucket, uploadRes.path, 120);
  assert.ok(signedUrl.includes('https://example.supabase.co/storage/v1/object/sign/'));

  const downloadRes = await service.downloadObject(bucket, uploadRes.path);
  assert.equal(downloadRes.buffer.toString('utf-8'), 'Employee Database Studio Secure Document Test Payload');
  assert.equal(downloadRes.mimeType, 'text/plain');

  const deleted = await service.deleteObject(bucket, uploadRes.path);
  assert.equal(deleted, true);
});
