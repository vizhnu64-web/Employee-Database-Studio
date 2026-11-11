import {
  DirectoryEmployee,
  EmployeeDocument,
  EmployeeFilterOptions,
  OnboardingChecklistStatus
} from '../types/employeeDirectory';

/**
 * Mask sensitive numbers for UI display
 */
export function maskAadhaar(val?: string): string {
  if (!val) return '—';
  const clean = val.replace(/\s+/g, '');
  if (clean.length < 4) return '••••';
  const last4 = clean.slice(-4);
  return `•••• •••• ${last4}`;
}

export function maskPan(val?: string): string {
  if (!val) return '—';
  const clean = val.trim();
  if (clean.length < 4) return '••••';
  return `••••••${clean.slice(-4).toUpperCase()}`;
}

export function maskBankAccount(val?: string): string {
  if (!val) return '—';
  const clean = val.trim();
  if (clean.length < 4) return '••••';
  return `••••••••${clean.slice(-4)}`;
}

export function maskUan(val?: string): string {
  if (!val) return '—';
  const clean = val.trim();
  if (clean.length < 4) return '••••';
  return `••••••••${clean.slice(-4)}`;
}

/**
 * Validate document file type and size
 */
export const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType: string;
}

export function validateUploadedFile(fileName: string, fileSizeBytes: number, detectedMimeType?: string): FileValidationResult {
  const extMatch = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  const ext = extMatch ? extMatch[0] : '';

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file type "${ext}". Supported formats are: PDF, JPG, JPEG, PNG, DOC, DOCX, XLS, XLSX.`,
      mimeType: detectedMimeType || 'application/octet-stream'
    };
  }

  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (fileSizeBytes / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds maximum allowed limit of 15 MB.`,
      mimeType: detectedMimeType || 'application/octet-stream'
    };
  }

  let mime = detectedMimeType || '';
  if (!mime || mime === 'application/octet-stream') {
    if (ext === '.pdf') mime = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
    else if (ext === '.png') mime = 'image/png';
    else if (ext === '.doc') mime = 'application/msword';
    else if (ext === '.docx') mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === '.xls') mime = 'application/vnd.ms-excel';
    else if (ext === '.xlsx') mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  return { valid: true, mimeType: mime };
}

/**
 * Compute Onboarding Checklist Status for an employee based on their uploaded documents
 */
export function calculateOnboardingChecklist(documents: EmployeeDocument[]): OnboardingChecklistStatus {
  const verifiedOrUploaded = (cat: string) =>
    documents.some(d => d.category === cat && d.verificationStatus !== 'Rejected');

  const hasIdentityProof = verifiedOrUploaded('Identity Proof');
  const hasAddressProof = verifiedOrUploaded('Address Proof');
  const hasPanProof = documents.some(
    d => (d.category === 'Statutory / Tax' || d.title.toLowerCase().includes('pan')) && d.verificationStatus !== 'Rejected'
  );
  const hasBankProof = verifiedOrUploaded('Bank Document');
  const hasEducationProof = verifiedOrUploaded('Educational Certificate');

  const items = [hasIdentityProof, hasAddressProof, hasPanProof, hasBankProof, hasEducationProof];
  const totalCompleted = items.filter(Boolean).length;

  return {
    hasIdentityProof,
    hasAddressProof,
    hasPanProof,
    hasBankProof,
    hasEducationProof,
    totalRequired: 5,
    totalCompleted,
    isComplete: totalCompleted === 5
  };
}

/**
 * Perform multi-field search and filtering across employee directory
 */
export function filterAndSearchEmployees(
  employees: DirectoryEmployee[],
  documents: EmployeeDocument[],
  filters: EmployeeFilterOptions
): DirectoryEmployee[] {
  const query = filters.searchQuery.trim().toLowerCase();

  return employees.filter(emp => {
    // 1. Department filter
    if (filters.department && filters.department !== 'All') {
      if (emp.department.toLowerCase() !== filters.department.toLowerCase()) return false;
    }

    // 2. Employment status filter
    if (filters.employmentStatus && filters.employmentStatus !== 'All') {
      if (emp.employmentStatus.toLowerCase() !== filters.employmentStatus.toLowerCase()) return false;
    }

    // 3. Document verification status filter
    if (filters.verificationStatus && filters.verificationStatus !== 'All') {
      const empDocs = documents.filter(d => d.employeeId === emp.employeeId);
      if (filters.verificationStatus === 'Missing Documents') {
        const checklist = calculateOnboardingChecklist(empDocs);
        if (checklist.isComplete) return false;
      } else if (filters.verificationStatus === 'Pending') {
        const hasPending = empDocs.some(d => d.verificationStatus === 'Pending');
        if (!hasPending) return false;
      } else if (filters.verificationStatus === 'All Verified') {
        if (empDocs.length === 0) return false;
        const allVerified = empDocs.every(d => d.verificationStatus === 'Verified');
        if (!allVerified) return false;
      }
    }

    // 4. Text query matching across multiple fields
    if (!query) return true;

    // Direct personal / employment fields
    if (emp.employeeId.toLowerCase().includes(query)) return true;
    if (emp.legalName.toLowerCase().includes(query)) return true;
    if (emp.preferredName && emp.preferredName.toLowerCase().includes(query)) return true;
    if (emp.department.toLowerCase().includes(query)) return true;
    if (emp.designation.toLowerCase().includes(query)) return true;
    if (emp.workEmail.toLowerCase().includes(query)) return true;
    if (emp.personalEmail && emp.personalEmail.toLowerCase().includes(query)) return true;
    if (emp.primaryPhone.includes(query)) return true;
    if (emp.workLocation && emp.workLocation.toLowerCase().includes(query)) return true;

    // Qualifications matching
    if (emp.qualifications && emp.qualifications.some(q =>
      q.qualificationName.toLowerCase().includes(query) ||
      q.institution.toLowerCase().includes(query) ||
      q.specialization.toLowerCase().includes(query)
    )) {
      return true;
    }

    // Associated document titles or categories matching
    const empDocs = documents.filter(d => d.employeeId === emp.employeeId);
    if (empDocs.some(d =>
      d.title.toLowerCase().includes(query) ||
      d.category.toLowerCase().includes(query) ||
      d.originalFilename.toLowerCase().includes(query)
    )) {
      return true;
    }

    return false;
  });
}

/**
 * Default verified dummy employees for the employee database
 */
export const SEED_DIRECTORY_EMPLOYEES: DirectoryEmployee[] = [
  {
    id: 'dir_emp_001',
    employeeId: 'EMP001',
    createdAt: '2026-01-15T09:00:00.000Z',
    updatedAt: '2026-06-10T11:30:00.000Z',
    legalName: 'Arun Kumar',
    preferredName: 'Arun',
    dateOfBirth: '1992-05-14',
    gender: 'Male',
    bloodGroup: 'O+',
    personalEmail: 'arunkumar.tech@gmail.com',
    workEmail: 'arun.kumar@apexenterprise.com',
    primaryPhone: '+91 98765 43210',
    alternatePhone: '+91 98765 43211',
    currentAddress: '42 Orchid Residency, 3rd Cross, Indiranagar, Bengaluru 560038',
    permanentAddress: '15 South Car Street, Madurai, Tamil Nadu 625001',
    emergencyContactName: 'Kavitha Kumar',
    emergencyContactRelationship: 'Spouse',
    emergencyContactPhone: '+91 98765 43299',
    joiningDate: '2023-01-15',
    employmentType: 'Full-Time',
    employmentStatus: 'Active',
    department: 'Engineering',
    designation: 'Senior Software Engineer',
    jobLevel: 'L4',
    reportingManager: 'Venkatesh Raman',
    workLocation: 'Bengaluru Tech Park (Hybrid)',
    probationStatus: 'Confirmed',
    confirmationDate: '2023-07-15',
    previousExperienceYears: 6.5,
    previousEmployer: 'Infosys Ltd',
    hrNotes: 'High-performing lead on billing and core platform. ISO-9001 certified.',
    qualifications: [
      {
        id: 'qual_001',
        qualificationName: 'Bachelor of Engineering (B.E.)',
        institution: 'PSG College of Technology, Coimbatore',
        completionYear: 2014,
        specialization: 'Computer Science and Engineering'
      }
    ],
    aadhaarNumber: '548291038472',
    panNumber: 'ABCDE1234F',
    uanNumber: '100928374651',
    esicNumber: '3100098273618',
    accountHolderName: 'Arun Kumar',
    bankName: 'HDFC Bank Ltd',
    accountNumber: '50100293847162',
    ifscCode: 'HDFC0000240',
    branchName: 'Indiranagar Branch',
    accountType: 'Salary',
    paymentMode: 'Bank Transfer',
    standardBasic: 45000,
    standardHra: 18000,
    standardAllowances: 9850
  },
  {
    id: 'dir_emp_002',
    employeeId: 'EMP002',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-07-12T14:15:00.000Z',
    legalName: 'Deepa Rajan',
    preferredName: 'Deepa',
    dateOfBirth: '1995-08-22',
    gender: 'Female',
    bloodGroup: 'B+',
    personalEmail: 'deepa.rajan95@outlook.com',
    workEmail: 'deepa.rajan@apexenterprise.com',
    primaryPhone: '+91 98401 23456',
    currentAddress: 'Flat 304, Green Meadows, Velachery, Chennai 600042',
    permanentAddress: 'Flat 304, Green Meadows, Velachery, Chennai 600042',
    emergencyContactName: 'Rajan Sundaram',
    emergencyContactRelationship: 'Father',
    emergencyContactPhone: '+91 98401 99999',
    joiningDate: '2023-03-01',
    employmentType: 'Full-Time',
    employmentStatus: 'Active',
    department: 'Quality Assurance',
    designation: 'Lead QA Automation Engineer',
    jobLevel: 'L3',
    reportingManager: 'Arun Kumar',
    workLocation: 'Chennai OMR Office',
    probationStatus: 'Confirmed',
    confirmationDate: '2023-09-01',
    previousExperienceYears: 4.0,
    previousEmployer: 'Cognizant Technology Solutions',
    hrNotes: 'ISTQB Certified Tester. Spearheaded automated regression suite.',
    qualifications: [
      {
        id: 'qual_002',
        qualificationName: 'Master of Computer Applications (MCA)',
        institution: 'College of Engineering, Guindy, Anna University',
        completionYear: 2017,
        specialization: 'Software Engineering'
      }
    ],
    aadhaarNumber: '782190345612',
    panNumber: 'BGKPR9821L',
    uanNumber: '101294857201',
    esicNumber: '3100084729184',
    accountHolderName: 'Deepa Rajan',
    bankName: 'State Bank of India',
    accountNumber: '38291048271',
    ifscCode: 'SBIN0001827',
    branchName: 'Velachery Branch',
    accountType: 'Salary',
    paymentMode: 'Bank Transfer',
    standardBasic: 40000,
    standardHra: 16000,
    standardAllowances: 8500
  },
  {
    id: 'dir_emp_003',
    employeeId: 'EMP003',
    createdAt: '2026-03-10T11:00:00.000Z',
    updatedAt: '2026-08-01T16:00:00.000Z',
    legalName: 'Karthik Subramanian',
    preferredName: 'Karthik',
    dateOfBirth: '1989-11-03',
    gender: 'Male',
    bloodGroup: 'A+',
    personalEmail: 'karthik.subramanian@gmail.com',
    workEmail: 'karthik.s@apexenterprise.com',
    primaryPhone: '+91 97910 88776',
    currentAddress: 'No. 8, Anna Salai, T. Nagar, Chennai 600017',
    permanentAddress: 'No. 8, Anna Salai, T. Nagar, Chennai 600017',
    emergencyContactName: 'Meenakshi Karthik',
    emergencyContactRelationship: 'Spouse',
    emergencyContactPhone: '+91 97910 11223',
    joiningDate: '2022-08-15',
    employmentType: 'Full-Time',
    employmentStatus: 'Active',
    department: 'Human Resources',
    designation: 'Senior HR Operations Specialist',
    jobLevel: 'L4',
    reportingManager: 'Eleanor Vance',
    workLocation: 'Chennai Headquarters',
    probationStatus: 'Confirmed',
    confirmationDate: '2023-02-15',
    previousExperienceYears: 8.0,
    previousEmployer: 'Tata Consultancy Services',
    hrNotes: 'Oversees payroll compliance, statutory filings and employee benefits.',
    qualifications: [
      {
        id: 'qual_003',
        qualificationName: 'MBA in Human Resource Management',
        institution: 'Loyola Institute of Business Administration (LIBA)',
        completionYear: 2012,
        specialization: 'Human Resources'
      }
    ],
    aadhaarNumber: '394857201934',
    panNumber: 'CYZPS4829K',
    uanNumber: '100482910492',
    esicNumber: '3100072819482',
    accountHolderName: 'Karthik Subramanian',
    bankName: 'ICICI Bank Ltd',
    accountNumber: '001801594837',
    ifscCode: 'ICIC0000018',
    branchName: 'T. Nagar Branch',
    accountType: 'Salary',
    paymentMode: 'Bank Transfer',
    standardBasic: 50000,
    standardHra: 20000,
    standardAllowances: 12000
  }
];

export const SEED_EMPLOYEE_DOCUMENTS: EmployeeDocument[] = [
  {
    id: 'doc_seed_001',
    employeeId: 'EMP001',
    title: 'Aadhaar Card Copy',
    category: 'Identity Proof',
    originalFilename: 'Arun_Kumar_Aadhaar_Card.pdf',
    storedFilename: 'doc_emp001_aadhaar_54829103.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 245800,
    uploadDate: '2026-01-16T10:30:00.000Z',
    verificationStatus: 'Verified',
    verifiedBy: 'Karthik Subramanian',
    verifiedAt: '2026-01-18T14:00:00.000Z',
    verificationNotes: 'UIDAI QR code matched and verified against official ID.',
    lastModified: '2026-01-18T14:00:00.000Z'
  },
  {
    id: 'doc_seed_002',
    employeeId: 'EMP001',
    title: 'PAN Card Copy',
    category: 'Statutory / Tax',
    originalFilename: 'Arun_Kumar_PAN.jpg',
    storedFilename: 'doc_emp001_pan_abcde1234.jpg',
    mimeType: 'image/jpeg',
    fileSizeBytes: 182400,
    uploadDate: '2026-01-16T10:35:00.000Z',
    verificationStatus: 'Verified',
    verifiedBy: 'Karthik Subramanian',
    verifiedAt: '2026-01-18T14:05:00.000Z',
    verificationNotes: 'PAN details verified on NSDL portal.',
    lastModified: '2026-01-18T14:05:00.000Z'
  },
  {
    id: 'doc_seed_003',
    employeeId: 'EMP001',
    title: 'Cancelled Cheque - HDFC Bank',
    category: 'Bank Document',
    originalFilename: 'Arun_HDFC_Cancelled_Cheque.pdf',
    storedFilename: 'doc_emp001_cheque_hdfc.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 312000,
    uploadDate: '2026-01-16T10:40:00.000Z',
    verificationStatus: 'Verified',
    verifiedBy: 'Karthik Subramanian',
    verifiedAt: '2026-01-18T14:10:00.000Z',
    verificationNotes: 'Account number and IFSC code HDFC0000240 verified.',
    lastModified: '2026-01-18T14:10:00.000Z'
  },
  {
    id: 'doc_seed_004',
    employeeId: 'EMP002',
    title: 'Passport Copy (Address & Identity Proof)',
    category: 'Identity Proof',
    originalFilename: 'Deepa_Rajan_Passport.pdf',
    storedFilename: 'doc_emp002_passport.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 420100,
    uploadDate: '2026-03-02T11:20:00.000Z',
    verificationStatus: 'Verified',
    verifiedBy: 'Karthik Subramanian',
    verifiedAt: '2026-03-05T09:30:00.000Z',
    verificationNotes: 'Valid through 2031.',
    lastModified: '2026-03-05T09:30:00.000Z'
  },
  {
    id: 'doc_seed_005',
    employeeId: 'EMP002',
    title: 'MCA Degree Certificate',
    category: 'Educational Certificate',
    originalFilename: 'Anna_University_MCA_Degree.pdf',
    storedFilename: 'doc_emp002_mca_degree.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 540300,
    uploadDate: '2026-03-02T11:25:00.000Z',
    verificationStatus: 'Verified',
    verifiedBy: 'Karthik Subramanian',
    verifiedAt: '2026-03-05T09:40:00.000Z',
    verificationNotes: 'First class with distinction degree verified.',
    lastModified: '2026-03-05T09:40:00.000Z'
  }
];
