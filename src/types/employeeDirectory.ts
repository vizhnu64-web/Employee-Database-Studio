/**
 * Types and interfaces for the Employee Database and Document Management Module.
 */

export type EmploymentType = 'Full-Time' | 'Part-Time' | 'Contract' | 'Intern' | 'Consultant';

export type EmploymentStatus = 'Active' | 'Probation' | 'Notice Period' | 'Inactive' | 'Resigned' | 'Terminated';

export type ProbationStatus = 'In Probation' | 'Confirmed' | 'Extended' | 'Not Applicable';

export type DocumentCategory =
  | 'Identity Proof'
  | 'Address Proof'
  | 'Educational Certificate'
  | 'Employment Record'
  | 'Bank Document'
  | 'Statutory / Tax'
  | 'Other HR Record';

export type VerificationStatus = 'Pending' | 'Verified' | 'Rejected' | 'Not Required';

export interface QualificationRecord {
  id: string;
  qualificationName: string;
  institution: string;
  completionYear: number | string;
  specialization: string;
  certificateRef?: string;
  attachedDocId?: string;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  title: string;
  category: DocumentCategory;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadDate: string; // ISO String
  issueDate?: string;
  expiryDate?: string;
  verificationStatus: VerificationStatus;
  verificationNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  lastModified: string;
  // Base64 data for browser preview/storage or memory caching
  fileDataBase64?: string;
  // Local filesystem path if running in Electron
  storagePath?: string;
}

export interface DirectoryEmployee {
  // Identity & System
  id: string; // Internal stable UUID/CUID
  employeeId: string; // HR Staff ID (e.g. EMP001, preserved string)
  createdAt: string;
  updatedAt: string;

  // A. Basic Personal Information
  legalName: string;
  preferredName?: string;
  dateOfBirth?: string;
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  bloodGroup?: string;
  personalEmail?: string;
  workEmail: string;
  primaryPhone: string;
  alternatePhone?: string;
  currentAddress: string;
  permanentAddress: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  photoDataUrl?: string;

  // B. Employment and Work Details
  joiningDate: string;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  department: string;
  designation: string;
  jobLevel?: string;
  reportingManager?: string;
  workLocation: string;
  probationStatus: ProbationStatus;
  probationEndDate?: string;
  confirmationDate?: string;
  employmentEndDate?: string;
  exitReason?: string;
  previousExperienceYears?: number;
  previousEmployer?: string;
  hrNotes?: string;

  // C. Education & Qualifications
  qualifications: QualificationRecord[];

  // D. Government IDs & Statutory Details
  aadhaarNumber?: string; // 12 digits
  panNumber?: string; // 10 alphanumeric
  uanNumber?: string; // 12 digits
    esicNumber?: string;
  esiNumber?: string;
  otherStatutoryId?: string;

  // E. Bank & Financial Information
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  accountType?: 'Savings' | 'Current' | 'Salary';
  paymentMode?: 'Bank Transfer' | 'Cheque' | 'Cash';
  bankProofDocId?: string;

  // F. Salary Reference (Optional standard base salary for payroll prefill)
  standardCtc?: number;
  standardEmployerEsi?: number;
  standardBasic?: number;
  standardHra?: number;
  standardAllowances?: number;

  // G. Dynamic Custom Fields
  customFields?: Record<string, any>;
}

export interface EmployeeFilterOptions {
  searchQuery: string;
  department: string;
  employmentStatus: string;
  verificationStatus: string;
}

export interface OnboardingChecklistStatus {
  hasIdentityProof: boolean;
  hasAddressProof: boolean;
  hasPanProof: boolean;
  hasBankProof: boolean;
  hasEducationProof: boolean;
  totalRequired: number;
  totalCompleted: number;
  isComplete: boolean;
}


