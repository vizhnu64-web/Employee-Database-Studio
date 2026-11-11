import test from 'node:test';
import assert from 'node:assert';
import {
  maskAadhaar,
  maskPan,
  maskBankAccount,
  maskUan,
  validateUploadedFile,
  calculateOnboardingChecklist,
  filterAndSearchEmployees,
  SEED_DIRECTORY_EMPLOYEES,
  SEED_EMPLOYEE_DOCUMENTS
} from './employeeDb';
import { DirectoryEmployee, EmployeeDocument, EmployeeFilterOptions } from '../types/employeeDirectory';

test('Sensitive Data Masking: Aadhaar masks first 8 digits and displays last 4', () => {
  assert.strictEqual(maskAadhaar('548291038472'), '•••• •••• 8472');
  assert.strictEqual(maskAadhaar('5482 9103 8472'), '•••• •••• 8472');
  assert.strictEqual(maskAadhaar(''), '—');
  assert.strictEqual(maskAadhaar(undefined), '—');
});

test('Sensitive Data Masking: PAN masks first 6 characters and shows last 4', () => {
  assert.strictEqual(maskPan('ABCDE1234F'), '••••••234F');
  assert.strictEqual(maskPan(''), '—');
  assert.strictEqual(maskPan(undefined), '—');
});

test('Sensitive Data Masking: Bank Account masks leading digits and preserves last 4', () => {
  assert.strictEqual(maskBankAccount('50100293847162'), '••••••••7162');
  assert.strictEqual(maskBankAccount('12345'), '••••••••2345');
  assert.strictEqual(maskBankAccount(''), '—');
  assert.strictEqual(maskBankAccount(undefined), '—');
});

test('Sensitive Data Masking: UAN masks leading digits and preserves last 4', () => {
  assert.strictEqual(maskUan('100928374651'), '••••••••4651');
  assert.strictEqual(maskUan(''), '—');
});

test('Document Validation: Accepts supported file formats (PDF, JPG, PNG, DOCX, XLSX)', () => {
  const pdfRes = validateUploadedFile('aadhaar_card.pdf', 500000, 'application/pdf');
  assert.strictEqual(pdfRes.valid, true);
  assert.strictEqual(pdfRes.mimeType, 'application/pdf');

  const jpgRes = validateUploadedFile('passport_photo.jpg', 300000, 'image/jpeg');
  assert.strictEqual(jpgRes.valid, true);

  const pngRes = validateUploadedFile('pan_card.png', 400000, 'image/png');
  assert.strictEqual(pngRes.valid, true);

  const docxRes = validateUploadedFile('appointment_letter.docx', 800000);
  assert.strictEqual(docxRes.valid, true);
  assert.strictEqual(docxRes.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  const xlsxRes = validateUploadedFile('salary_breakup.xlsx', 250000);
  assert.strictEqual(xlsxRes.valid, true);
});

test('Document Validation: Rejects executable and dangerous file types', () => {
  const exeRes = validateUploadedFile('malicious_file.exe', 1000);
  assert.strictEqual(exeRes.valid, false);
  assert.ok(exeRes.error?.includes('Unsupported file type'));

  const batRes = validateUploadedFile('script.bat', 1000);
  assert.strictEqual(batRes.valid, false);

  const shRes = validateUploadedFile('run.sh', 1000);
  assert.strictEqual(shRes.valid, false);
});

test('Document Validation: Rejects files exceeding 15MB limit', () => {
  const oversizedBytes = 16 * 1024 * 1024; // 16MB
  const res = validateUploadedFile('large_document.pdf', oversizedBytes);
  assert.strictEqual(res.valid, false);
  assert.ok(res.error?.includes('exceeds maximum allowed limit of 15 MB'));
});

test('Onboarding Checklist: Accurately checks completion of required documents', () => {
  const emp1Docs = SEED_EMPLOYEE_DOCUMENTS.filter(d => d.employeeId === 'EMP001');
  const checklist = calculateOnboardingChecklist(emp1Docs);

  assert.strictEqual(checklist.hasIdentityProof, true);
  assert.strictEqual(checklist.hasPanProof, true);
  assert.strictEqual(checklist.hasBankProof, true);
  assert.strictEqual(checklist.totalRequired, 5);
  // EMP001 has Identity, PAN, Bank (3 out of 5)
  assert.strictEqual(checklist.totalCompleted, 3);
  assert.strictEqual(checklist.isComplete, false);

  // Add remaining address proof and education certificate
  const fullDocs: EmployeeDocument[] = [
    ...emp1Docs,
    {
      id: 'doc_addr',
      employeeId: 'EMP001',
      title: 'Electricity Bill',
      category: 'Address Proof',
      originalFilename: 'bill.pdf',
      storedFilename: 'bill.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 100000,
      uploadDate: new Date().toISOString(),
      verificationStatus: 'Verified',
      lastModified: new Date().toISOString()
    },
    {
      id: 'doc_edu',
      employeeId: 'EMP001',
      title: 'BE Degree',
      category: 'Educational Certificate',
      originalFilename: 'degree.pdf',
      storedFilename: 'degree.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 200000,
      uploadDate: new Date().toISOString(),
      verificationStatus: 'Verified',
      lastModified: new Date().toISOString()
    }
  ];

  const fullChecklist = calculateOnboardingChecklist(fullDocs);
  assert.strictEqual(fullChecklist.totalCompleted, 5);
  assert.strictEqual(fullChecklist.isComplete, true);
});

test('Global Search: Searches across Employee ID, Name, Department, and Email', () => {
  const filters: EmployeeFilterOptions = {
    searchQuery: 'arun',
    department: 'All',
    employmentStatus: 'All',
    verificationStatus: 'All'
  };

  const results = filterAndSearchEmployees(SEED_DIRECTORY_EMPLOYEES, SEED_EMPLOYEE_DOCUMENTS, filters);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].employeeId, 'EMP001');

  // Search by department
  const qaFilters: EmployeeFilterOptions = {
    searchQuery: 'Quality Assurance',
    department: 'All',
    employmentStatus: 'All',
    verificationStatus: 'All'
  };
  const qaResults = filterAndSearchEmployees(SEED_DIRECTORY_EMPLOYEES, SEED_EMPLOYEE_DOCUMENTS, qaFilters);
  assert.strictEqual(qaResults.length, 1);
  assert.strictEqual(qaResults[0].employeeId, 'EMP002');
});

test('Global Search: Searches across Degree Qualifications', () => {
  const filters: EmployeeFilterOptions = {
    searchQuery: 'PSG College',
    department: 'All',
    employmentStatus: 'All',
    verificationStatus: 'All'
  };

  const results = filterAndSearchEmployees(SEED_DIRECTORY_EMPLOYEES, SEED_EMPLOYEE_DOCUMENTS, filters);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].legalName, 'Arun Kumar');
});

test('Global Search: Searches across uploaded Document Titles', () => {
  const filters: EmployeeFilterOptions = {
    searchQuery: 'Passport',
    department: 'All',
    employmentStatus: 'All',
    verificationStatus: 'All'
  };

  const results = filterAndSearchEmployees(SEED_DIRECTORY_EMPLOYEES, SEED_EMPLOYEE_DOCUMENTS, filters);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].legalName, 'Deepa Rajan');
});

test('Duplicate Employee ID Prevention Logic', () => {
  const existing = SEED_DIRECTORY_EMPLOYEES;
  const isDuplicate = (newEmpId: string, currentEmpId?: string) => {
    return existing.some(e =>
      e.employeeId.toUpperCase() === newEmpId.toUpperCase() &&
      (!currentEmpId || e.id !== currentEmpId)
    );
  };

  assert.strictEqual(isDuplicate('EMP001'), true);
  assert.strictEqual(isDuplicate('emp001'), true);
  assert.strictEqual(isDuplicate('EMP001', 'dir_emp_001'), false); // Editing self is permitted
  assert.strictEqual(isDuplicate('EMP999'), false);
});
