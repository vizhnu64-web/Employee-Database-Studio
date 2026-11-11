import React, { useState } from 'react';
import {
  X,
  Save,
  User,
  Briefcase,
  GraduationCap,
  Shield,
  CreditCard,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import {
  DirectoryEmployee,
  EmploymentType,
  EmploymentStatus,
  ProbationStatus,
  QualificationRecord
} from '../../types/employeeDirectory';
import { useTheme } from '../../context/ThemeContext';

interface EmployeeFormModalProps {
  initialEmployee?: DirectoryEmployee | null;
  existingEmployees: DirectoryEmployee[];
  onSave: (employee: DirectoryEmployee) => Promise<void>;
  onClose: () => void;
}

type FormTab = 'personal' | 'employment' | 'education' | 'statutory' | 'bank';

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  initialEmployee,
  existingEmployees,
  onSave,
  onClose
}) => {
  const { isDark } = useTheme();
  const isEditing = Boolean(initialEmployee);
  const [activeTab, setActiveTab] = useState<FormTab>('personal');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [employeeId, setEmployeeId] = useState(initialEmployee?.employeeId || '');
  const [legalName, setLegalName] = useState(initialEmployee?.legalName || '');
  const [preferredName, setPreferredName] = useState(initialEmployee?.preferredName || '');
  const [dateOfBirth, setDateOfBirth] = useState(initialEmployee?.dateOfBirth || '');
  const [gender, setGender] = useState<DirectoryEmployee['gender']>(initialEmployee?.gender || 'Prefer not to say');
  const [bloodGroup, setBloodGroup] = useState(initialEmployee?.bloodGroup || '');
  const [personalEmail, setPersonalEmail] = useState(initialEmployee?.personalEmail || '');
  const [workEmail, setWorkEmail] = useState(initialEmployee?.workEmail || '');
  const [primaryPhone, setPrimaryPhone] = useState(initialEmployee?.primaryPhone || '');
  const [alternatePhone, setAlternatePhone] = useState(initialEmployee?.alternatePhone || '');
  const [currentAddress, setCurrentAddress] = useState(initialEmployee?.currentAddress || '');
  const [permanentAddress, setPermanentAddress] = useState(initialEmployee?.permanentAddress || '');
  const [emergencyContactName, setEmergencyContactName] = useState(initialEmployee?.emergencyContactName || '');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState(initialEmployee?.emergencyContactRelationship || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(initialEmployee?.emergencyContactPhone || '');

  // Employment Details
  const [joiningDate, setJoiningDate] = useState(initialEmployee?.joiningDate || new Date().toISOString().split('T')[0]);
  const [employmentType, setEmploymentType] = useState<EmploymentType>(initialEmployee?.employmentType || 'Full-Time');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>(initialEmployee?.employmentStatus || 'Active');
  const [department, setDepartment] = useState(initialEmployee?.department || 'Engineering');
  const [designation, setDesignation] = useState(initialEmployee?.designation || '');
  const [jobLevel, setJobLevel] = useState(initialEmployee?.jobLevel || 'L2');
  const [reportingManager, setReportingManager] = useState(initialEmployee?.reportingManager || '');
  const [workLocation, setWorkLocation] = useState(initialEmployee?.workLocation || 'Main Office');
  const [probationStatus, setProbationStatus] = useState<ProbationStatus>(initialEmployee?.probationStatus || 'In Probation');
  const [probationEndDate, setProbationEndDate] = useState(initialEmployee?.probationEndDate || '');
  const [confirmationDate, setConfirmationDate] = useState(initialEmployee?.confirmationDate || '');
  const [employmentEndDate, setEmploymentEndDate] = useState(initialEmployee?.employmentEndDate || '');
  const [exitReason, setExitReason] = useState(initialEmployee?.exitReason || '');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(initialEmployee?.photoDataUrl);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [previousExperienceYears, setPreviousExperienceYears] = useState<number | undefined>(initialEmployee?.previousExperienceYears);
  const [previousEmployer, setPreviousEmployer] = useState(initialEmployee?.previousEmployer || '');
  const [hrNotes, setHrNotes] = useState(initialEmployee?.hrNotes || '');

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setPhotoError('Only JPG, JPEG, and PNG image formats are supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Photo size exceeds maximum allowed limit of 5 MB.');
      return;
    }
    setPhotoError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoDataUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Qualifications
  const [qualifications, setQualifications] = useState<QualificationRecord[]>(
    initialEmployee?.qualifications || [
      {
        id: 'q_1',
        qualificationName: '',
        institution: '',
        completionYear: new Date().getFullYear(),
        specialization: ''
      }
    ]
  );

  // Statutory
  const [aadhaarNumber, setAadhaarNumber] = useState(initialEmployee?.aadhaarNumber || '');
  const [panNumber, setPanNumber] = useState(initialEmployee?.panNumber || '');
  const [uanNumber, setUanNumber] = useState(initialEmployee?.uanNumber || '');
  const [esicNumber, setEsicNumber] = useState(initialEmployee?.esicNumber || '');
  const [otherStatutoryId, setOtherStatutoryId] = useState(initialEmployee?.otherStatutoryId || '');

  // Bank
  const [accountHolderName, setAccountHolderName] = useState(initialEmployee?.accountHolderName || '');
  const [bankName, setBankName] = useState(initialEmployee?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(initialEmployee?.accountNumber || '');
  const [ifscCode, setIfscCode] = useState(initialEmployee?.ifscCode || '');
  const [branchName, setBranchName] = useState(initialEmployee?.branchName || '');
  const [accountType, setAccountType] = useState<'Savings' | 'Current' | 'Salary'>(initialEmployee?.accountType || 'Salary');
  const [paymentMode, setPaymentMode] = useState<'Bank Transfer' | 'Cheque' | 'Cash'>(initialEmployee?.paymentMode || 'Bank Transfer');
  const [standardBasic, setStandardBasic] = useState<number>(initialEmployee?.standardBasic || 35000);
  const [standardHra, setStandardHra] = useState<number>(initialEmployee?.standardHra || 14000);
  const [standardAllowances, setStandardAllowances] = useState<number>(initialEmployee?.standardAllowances || 6000);

  const handleAddQualification = () => {
    setQualifications([
      ...qualifications,
      {
        id: `q_${Date.now()}`,
        qualificationName: '',
        institution: '',
        completionYear: new Date().getFullYear(),
        specialization: ''
      }
    ]);
  };

  const handleRemoveQualification = (id: string) => {
    setQualifications(qualifications.filter(q => q.id !== id));
  };

  const handleUpdateQualification = (id: string, field: keyof QualificationRecord, val: any) => {
    setQualifications(qualifications.map(q => q.id === id ? { ...q, [field]: val } : q));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    const cleanEmpId = employeeId.trim().toUpperCase();
    if (!cleanEmpId) {
      setFormError('Employee ID is required.');
      setActiveTab('personal');
      return;
    }

    if (!legalName.trim()) {
      setFormError('Legal Full Name is required.');
      setActiveTab('personal');
      return;
    }

    if (!workEmail.trim()) {
      setFormError('Work Email is required.');
      setActiveTab('personal');
      return;
    }

    // Check unique employeeId
    const duplicate = existingEmployees.find(e =>
      e.employeeId.toUpperCase() === cleanEmpId &&
      (!initialEmployee || e.id !== initialEmployee.id)
    );
    if (duplicate) {
      setFormError(`Employee ID "${cleanEmpId}" is already used by ${duplicate.legalName}. Must be unique.`);
      setActiveTab('personal');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const updatedEmployee: DirectoryEmployee = {
        id: initialEmployee ? initialEmployee.id : `dir_emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        employeeId: cleanEmpId,
        createdAt: initialEmployee ? initialEmployee.createdAt : now,
        updatedAt: now,
        legalName: legalName.trim(),
        preferredName: preferredName.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        gender,
        bloodGroup: bloodGroup.trim() || undefined,
        personalEmail: personalEmail.trim() || undefined,
        workEmail: workEmail.trim(),
        primaryPhone: primaryPhone.trim(),
        alternatePhone: alternatePhone.trim() || undefined,
        currentAddress: currentAddress.trim(),
        permanentAddress: permanentAddress.trim() || currentAddress.trim(),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactRelationship: emergencyContactRelationship.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        photoDataUrl,

        joiningDate: joiningDate || now.split('T')[0],
        employmentType,
        employmentStatus,
        department: department.trim(),
        designation: designation.trim(),
        jobLevel: jobLevel.trim() || undefined,
        reportingManager: reportingManager.trim() || undefined,
        workLocation: workLocation.trim(),
        probationStatus,
        probationEndDate: probationEndDate || undefined,
        confirmationDate: confirmationDate || undefined,
        employmentEndDate: employmentEndDate || undefined,
        exitReason: exitReason.trim() || undefined,
        previousExperienceYears: previousExperienceYears ? Number(previousExperienceYears) : undefined,
        previousEmployer: previousEmployer.trim() || undefined,
        hrNotes: hrNotes.trim() || undefined,

        qualifications: qualifications.filter(q => q.qualificationName.trim().length > 0),

        aadhaarNumber: aadhaarNumber.replace(/\s+/g, '') || undefined,
        panNumber: panNumber.trim().toUpperCase() || undefined,
        uanNumber: uanNumber.trim() || undefined,
        esicNumber: esicNumber.trim() || undefined,
        otherStatutoryId: otherStatutoryId.trim() || undefined,

        accountHolderName: accountHolderName.trim() || legalName.trim(),
        bankName: bankName.trim() || undefined,
        accountNumber: accountNumber.trim() || undefined,
        ifscCode: ifscCode.trim().toUpperCase() || undefined,
        branchName: branchName.trim() || undefined,
        accountType,
        paymentMode,

        standardBasic: Number(standardBasic) || 0,
        standardHra: Number(standardHra) || 0,
        standardAllowances: Number(standardAllowances) || 0
      };

      await onSave(updatedEmployee);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Error saving employee record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'personal' as FormTab, label: '1. Personal Info', icon: User },
    { id: 'employment' as FormTab, label: '2. Employment & Role', icon: Briefcase },
    { id: 'education' as FormTab, label: '3. Education', icon: GraduationCap },
    { id: 'statutory' as FormTab, label: '4. Govt IDs & Statutory', icon: Shield },
    { id: 'bank' as FormTab, label: '5. Bank & Payroll', icon: CreditCard }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-[#222222] bg-[#141416]' : 'border-[#E4E4E7] bg-[#FAFAFC]'}`}>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#CB1417]/10 border border-[#CB1417]/30 flex items-center justify-center text-[#CB1417]">
              {isEditing ? <Briefcase className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                {isEditing ? `Edit Employee Profile — ${initialEmployee?.legalName}` : 'Add New Employee Record'}
              </h3>
              <p className={`text-[11px] ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                {isEditing ? `ID: ${initialEmployee?.employeeId} • Modify HR details securely` : 'HR Master Database Registration'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isDark ? 'hover:bg-[#222226] text-[#A1A1AA]' : 'hover:bg-[#E4E4E7] text-[#71717A]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Navigation Tabs */}
        <div className={`flex border-b overflow-x-auto ${isDark ? 'border-[#222222] bg-[#101012]' : 'border-[#E4E4E7] bg-[#F8F9FA]'}`}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-[#CB1417] text-[#CB1417] bg-[#CB1417]/5'
                    : `border-transparent ${isDark ? 'text-[#A1A1AA] hover:text-white' : 'text-[#71717A] hover:text-black'}`
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {formError && (
            <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* TAB 1: PERSONAL INFORMATION */}
          {activeTab === 'personal' && (
            <div className="space-y-4 text-xs">
              {/* Employee Photo Upload */}
              <div className={`p-4 rounded-xl border flex items-center space-x-4 ${isDark ? 'bg-[#141416] border-[#27272A]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 border flex items-center justify-center shrink-0">
                  {photoDataUrl ? (
                    <img src={photoDataUrl} alt="Employee Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-zinc-400 opacity-60" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <label className={`block font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                    Employee Passport Photo (Optional)
                  </label>
                  <p className="text-[11px] text-zinc-500">Supports JPG, JPEG, PNG up to 5 MB.</p>
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={handlePhotoChange}
                      className="text-xs text-zinc-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#CB1417] file:text-white hover:file:bg-[#ED1F24] cursor-pointer"
                    />
                    {photoDataUrl && (
                      <button
                        type="button"
                        onClick={() => setPhotoDataUrl(undefined)}
                        className="text-xs text-red-500 hover:underline cursor-pointer"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                  {photoError && <p className="text-red-500 text-[11px]">{photoError}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Employee ID *
                  </label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="e.g. EMP001"
                    className={`w-full px-3 py-2 rounded-lg border font-mono uppercase ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Legal Full Name *
                  </label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="e.g. Arun Kumar"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Preferred / Display Name
                  </label>
                  <input
                    type="text"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    placeholder="e.g. Arun"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  >
                    <option value="Prefer not to say">Prefer not to say</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Blood Group
                  </label>
                  <input
                    type="text"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    placeholder="e.g. O+, A+, B+"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Work Email Address *
                  </label>
                  <input
                    type="email"
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    placeholder="e.g. arun.kumar@company.com"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Personal Email Address
                  </label>
                  <input
                    type="email"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    placeholder="e.g. arun.personal@gmail.com"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Primary Contact Phone *
                  </label>
                  <input
                    type="text"
                    value={primaryPhone}
                    onChange={(e) => setPrimaryPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Alternate Phone
                  </label>
                  <input
                    type="text"
                    value={alternatePhone}
                    onChange={(e) => setAlternatePhone(e.target.value)}
                    placeholder="e.g. +91 98765 43211"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Current Residential Address
                  </label>
                  <textarea
                    rows={2}
                    value={currentAddress}
                    onChange={(e) => setCurrentAddress(e.target.value)}
                    placeholder="Current street, city, state, postal code"
                    className={`w-full px-3 py-2 rounded-lg border resize-none ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Permanent Address
                  </label>
                  <textarea
                    rows={2}
                    value={permanentAddress}
                    onChange={(e) => setPermanentAddress(e.target.value)}
                    placeholder="Leave blank if same as current address"
                    className={`w-full px-3 py-2 rounded-lg border resize-none ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-black'}`}>
                  Emergency Contact Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Contact Name</label>
                    <input
                      type="text"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      placeholder="e.g. Kavitha Kumar"
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Relationship</label>
                    <input
                      type="text"
                      value={emergencyContactRelationship}
                      onChange={(e) => setEmergencyContactRelationship(e.target.value)}
                      placeholder="e.g. Spouse / Parent"
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Emergency Phone</label>
                    <input
                      type="text"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43299"
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EMPLOYMENT & WORK DETAILS */}
          {activeTab === 'employment' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Joining Date *
                  </label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Employment Type
                  </label>
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  >
                    <option value="Full-Time">Full-Time (Permanent)</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                    <option value="Consultant">Consultant</option>
                  </select>
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Employment Status
                  </label>
                  <select
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value as EmploymentStatus)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  >
                    <option value="Active">Active</option>
                    <option value="Probation">Probation</option>
                    <option value="Notice Period">Notice Period</option>
                    <option value="Inactive">Inactive (On Leave / Suspended)</option>
                    <option value="Resigned">Resigned</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Department *
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Engineering, Sales, HR"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Designation / Title *
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Job Level / Grade
                  </label>
                  <input
                    type="text"
                    value={jobLevel}
                    onChange={(e) => setJobLevel(e.target.value)}
                    placeholder="e.g. L3, Lead, Senior"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Reporting Manager
                  </label>
                  <input
                    type="text"
                    value={reportingManager}
                    onChange={(e) => setReportingManager(e.target.value)}
                    placeholder="e.g. Venkatesh Raman"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Work Location
                  </label>
                  <input
                    type="text"
                    value={workLocation}
                    onChange={(e) => setWorkLocation(e.target.value)}
                    placeholder="e.g. Head Office / Remote"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Probation Status
                  </label>
                  <select
                    value={probationStatus}
                    onChange={(e) => setProbationStatus(e.target.value as ProbationStatus)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="In Probation">In Probation</option>
                    <option value="Extended">Extended</option>
                    <option value="Not Applicable">Not Applicable</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Previous Total Experience (Years)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={previousExperienceYears ?? ''}
                    onChange={(e) => setPreviousExperienceYears(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="e.g. 5.5"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Previous Employer
                  </label>
                  <input
                    type="text"
                    value={previousEmployer}
                    onChange={(e) => setPreviousEmployer(e.target.value)}
                    placeholder="e.g. Infosys Ltd"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Confirmation Date
                  </label>
                  <input
                    type="date"
                    value={confirmationDate}
                    onChange={(e) => setConfirmationDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Resignation / Exit Date
                  </label>
                  <input
                    type="date"
                    value={employmentEndDate}
                    onChange={(e) => setEmploymentEndDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                  Resignation Reason / Exit Remarks
                </label>
                <textarea
                  rows={2}
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                  placeholder="Reason for resignation or termination (Leave blank if currently employed)"
                  className={`w-full px-3 py-2 rounded-lg border resize-none ${
                    isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                  }`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                  Internal HR Notes & Remarks
                </label>
                <textarea
                  rows={3}
                  value={hrNotes}
                  onChange={(e) => setHrNotes(e.target.value)}
                  placeholder="Official HR notes, achievements, certifications, or performance milestones."
                  className={`w-full px-3 py-2 rounded-lg border resize-none ${
                    isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                  }`}
                />
              </div>
            </div>
          )}

          {/* TAB 3: EDUCATION & QUALIFICATIONS */}
          {activeTab === 'education' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b">
                <span className={`font-semibold ${isDark ? 'text-white' : 'text-black'}`}>
                  Academic Qualifications & Degrees ({qualifications.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddQualification}
                  className="flex items-center space-x-1.5 px-3 py-1 bg-[#CB1417] text-white rounded-lg text-xs font-semibold hover:bg-[#ED1F24] transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Degree</span>
                </button>
              </div>

              {qualifications.map((q, idx) => (
                <div
                  key={q.id}
                  className={`p-4 rounded-xl border space-y-3 relative ${
                    isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#CB1417]">Qualification #{idx + 1}</span>
                    {qualifications.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveQualification(q.id)}
                        className="text-red-500 hover:text-red-600 transition p-1 cursor-pointer"
                        title="Remove Qualification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                        Degree / Qualification Title *
                      </label>
                      <input
                        type="text"
                        value={q.qualificationName}
                        onChange={(e) => handleUpdateQualification(q.id, 'qualificationName', e.target.value)}
                        placeholder="e.g. B.Tech Computer Science"
                        className={`w-full px-3 py-2 rounded-lg border ${
                          isDark ? 'bg-[#18181B] border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                        Institution / University *
                      </label>
                      <input
                        type="text"
                        value={q.institution}
                        onChange={(e) => handleUpdateQualification(q.id, 'institution', e.target.value)}
                        placeholder="e.g. Anna University, Guindy"
                        className={`w-full px-3 py-2 rounded-lg border ${
                          isDark ? 'bg-[#18181B] border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                        Completion Year
                      </label>
                      <input
                        type="number"
                        value={q.completionYear}
                        onChange={(e) => handleUpdateQualification(q.id, 'completionYear', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border ${
                          isDark ? 'bg-[#18181B] border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                        Specialization / Major
                      </label>
                      <input
                        type="text"
                        value={q.specialization}
                        onChange={(e) => handleUpdateQualification(q.id, 'specialization', e.target.value)}
                        placeholder="e.g. Information Technology"
                        className={`w-full px-3 py-2 rounded-lg border ${
                          isDark ? 'bg-[#18181B] border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: GOVERNMENT IDS & STATUTORY */}
          {activeTab === 'statutory' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-500 text-[11px] flex items-center space-x-2">
                <Shield className="w-4 h-4 shrink-0" />
                <span>Government IDs are masked across standard views and revealed only upon authorized click.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Aadhaar Number (12 Digits)
                  </label>
                  <input
                    type="text"
                    value={aadhaarNumber}
                    onChange={(e) => setAadhaarNumber(e.target.value)}
                    placeholder="e.g. 5482 9103 8472"
                    maxLength={14}
                    className={`w-full px-3 py-2 rounded-lg border font-mono ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    PAN (Permanent Account Number)
                  </label>
                  <input
                    type="text"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value)}
                    placeholder="e.g. ABCDE1234F"
                    maxLength={10}
                    className={`w-full px-3 py-2 rounded-lg border font-mono uppercase ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    UAN (Universal Account Number - PF)
                  </label>
                  <input
                    type="text"
                    value={uanNumber}
                    onChange={(e) => setUanNumber(e.target.value)}
                    placeholder="e.g. 100928374651"
                    className={`w-full px-3 py-2 rounded-lg border font-mono ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    ESIC Number (IP Insurance)
                  </label>
                  <input
                    type="text"
                    value={esicNumber}
                    onChange={(e) => setEsicNumber(e.target.value)}
                    placeholder="e.g. 3100098273618"
                    className={`w-full px-3 py-2 rounded-lg border font-mono ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                  Other Statutory Identification (Optional)
                </label>
                <input
                  type="text"
                  value={otherStatutoryId}
                  onChange={(e) => setOtherStatutoryId(e.target.value)}
                  placeholder="e.g. State Labor Welfare Fund ID or Driving License"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                  }`}
                />
              </div>
            </div>
          )}

          {/* TAB 5: BANK & PAYROLL PREFILL */}
          {activeTab === 'bank' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    placeholder="As registered with bank"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank, SBI, ICICI"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Bank Account Number
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 50100293847162"
                    className={`w-full px-3 py-2 rounded-lg border font-mono ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    placeholder="e.g. HDFC0000240"
                    maxLength={11}
                    className={`w-full px-3 py-2 rounded-lg border font-mono uppercase ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white focus:border-[#CB1417]' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black focus:border-[#CB1417]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. Indiranagar Branch"
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Account Type
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  >
                    <option value="Salary">Salary Account</option>
                    <option value="Savings">Savings Account</option>
                    <option value="Current">Current Account</option>
                  </select>
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
                    Disbursement Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                    }`}
                  >
                    <option value="Bank Transfer">Direct Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="Cheque">Corporate Cheque</option>
                    <option value="Cash">Cash Voucher</option>
                  </select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className={`font-bold mb-1.5 ${isDark ? 'text-white' : 'text-black'}`}>
                  Standard Monthly Salary Baseline (Optional for Payroll Prefill)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Basic Salary</label>
                    <input
                      type="number"
                      value={standardBasic}
                      onChange={(e) => setStandardBasic(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>HRA</label>
                    <input
                      type="number"
                      value={standardHra}
                      onChange={(e) => setStandardHra(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block font-semibold mb-1 ${isDark ? 'text-white' : 'text-black'}`}>Special Allowances</label>
                    <input
                      type="number"
                      value={standardAllowances}
                      onChange={(e) => setStandardAllowances(Number(e.target.value))}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <span className={`text-[11px] ${isDark ? 'text-[#71717A]' : 'text-[#A1A1AA]'}`}>
              * Required fields. All records stored locally in encrypted offline database.
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  isDark ? 'bg-[#141416] text-[#A1A1AA] border-[#27272A]' : 'bg-[#F4F4F6] text-[#52525B] border-[#E4E4E7]'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-[#CB1417] text-white hover:bg-[#ED1F24] disabled:opacity-50 transition cursor-pointer shadow-md shadow-[#CB1417]/25 flex items-center space-x-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving...' : isEditing ? 'Update Employee' : 'Create Employee Record'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
