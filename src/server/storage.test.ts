import test from 'node:test';
import assert from 'node:assert';
import { supabaseStorage, STORAGE_BUCKETS } from './storage/supabaseStorage';

test('SupabaseStorageService path sanitization', () => {
  const dirty = '..//company_1/employee\\1004/../records/aadhaar .pdf';
  const clean = supabaseStorage.sanitizeStoragePath(dirty);
  assert.ok(clean.includes('company_1'));
});

test('SupabaseStorageService structured path generation across 4 buckets', () => {
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

test('SupabaseStorageService resilient fallback upload, signed url, download and delete', async () => {
  const bucket = STORAGE_BUCKETS.EMPLOYEE_DOCUMENTS;
  const storagePath = '1/test_emp/records/test_doc.txt';
  const testBuffer = Buffer.from('Employee Database Studio Secure Document Test Payload', 'utf-8');

  // 1. Upload
  const uploadRes = await supabaseStorage.uploadObject(bucket, storagePath, testBuffer, 'text/plain');
  assert.ok(uploadRes.path);

  // 2. Signed URL
  const signedUrl = await supabaseStorage.createSignedUrl(bucket, uploadRes.path, 120);
  assert.ok(signedUrl);

  // 3. Download
  const downloadRes = await supabaseStorage.downloadObject(bucket, uploadRes.path);
  assert.strictEqual(downloadRes.buffer.toString('utf-8'), 'Employee Database Studio Secure Document Test Payload');
  assert.ok(downloadRes.mimeType === 'application/octet-stream' || downloadRes.mimeType === 'text/plain');

  // 4. Delete
  const deleted = await supabaseStorage.deleteObject(bucket, uploadRes.path);
  assert.strictEqual(deleted, true);
});
