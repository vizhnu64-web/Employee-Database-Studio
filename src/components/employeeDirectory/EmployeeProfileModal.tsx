import React, { useState } from 'react';
import {
  X,
  Edit,
  Trash2,
  UserX,
  UserCheck,
  Eye,
  EyeOff,
  User,
  Briefcase,
  GraduationCap,
  Shield,
  CreditCard,
  FileText,
  Clock,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building,
  CheckCircle2,
  ExternalLink,
  PlusCircle
} from 'lucide-react';
import {
  DirectoryEmployee,
  EmployeeDocument
} from '../../types/employeeDirectory';
import {
  maskAadhaar,
  maskPan,
  maskBankAccount,
  maskUan
} from '../../utils/employeeDb';
import { useTheme } from '../../context/ThemeContext';
import { EmployeeDocumentsSection } from './EmployeeDocumentsSection';
import { EmployeePayrollDataTab } from './EmployeePayrollDataTab';
import { EmployeeAttendanceTab } from './EmployeeAttendanceTab';
import { EmployeePayslipHistoryTab } from './EmployeePayslipHistoryTab';

interface EmployeeProfileModalProps {
  employee: DirectoryEmployee;
  documents: EmployeeDocument[];
  onEdit: (employee: DirectoryEmployee) => void;
  onDeleteRequest: (employee: DirectoryEmployee) => void;
  onToggleStatus: (employee: DirectoryEmployee) => void;
  onAddToPayroll?: (employee: DirectoryEmployee) => void;
  onSaveDocument: (doc: EmployeeDocument) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  onClose: () => void;
  onPreviewPayslip?: (record: any) => void;
}

type ProfileTab = 'personal' | 'employment' | 'attendance' | 'payroll' | 'documents' | 'payslips';

export const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({
  employee,
  documents,
  onEdit,
  onDeleteRequest,
  onToggleStatus,
  onAddToPayroll,
  onSaveDocument,
  onDeleteDocument,
  onClose,
  onPreviewPayslip
}) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
  const [revealedSensitives, setRevealedSensitives] = useState<{ [key: string]: boolean }>({});

  const toggleReveal = (key: string) => {
    setRevealedSensitives(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isInactive = employee.employmentStatus === 'Inactive' || employee.employmentStatus === 'Resigned' || employee.employmentStatus === 'Terminated';

  const tabs = [
    { id: 'personal' as ProfileTab, label: 'Personal Information', icon: User },
    { id: 'employment' as ProfileTab, label: 'Employment Details', icon: Briefcase },
    { id: 'attendance' as ProfileTab, label: 'Attendance', icon: Calendar },
    { id: 'payroll' as ProfileTab, label: 'Payroll Data', icon: CreditCard },
    { id: 'documents' as ProfileTab, label: `Documents (${documents.filter(d => d.employeeId === employee.employeeId).length})`, icon: FileText },
    { id: 'payslips' as ProfileTab, label: 'Payslip History', icon: Clock }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-colors ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        {/* Top Header Card */}
        <div className={`p-6 border-b ${isDark ? 'border-[#222222] bg-[#141416]' : 'border-[#E4E4E7] bg-[#FAFAFC]'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#CB1417] flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-[#CB1417]/25 shrink-0 border">
                {employee.photoDataUrl ? (
                  <img src={employee.photoDataUrl} alt={employee.legalName} className="w-full h-full object-cover" />
                ) : (
                  employee.legalName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2.5">
                  <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
                    {employee.legalName}
                  </h2>
                  {employee.preferredName && employee.preferredName !== employee.legalName && (
                    <span className="text-xs px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                      &quot;{employee.preferredName}&quot;
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    employee.employmentStatus === 'Active'
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : employee.employmentStatus === 'Probation'
                      ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      : employee.employmentStatus === 'Notice Period'
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                  }`}>
                    {employee.employmentStatus}
                  </span>
                </div>
                <div className={`flex flex-wrap items-center gap-3 mt-1 text-xs ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                  <span className="font-mono font-bold text-[#CB1417]">{employee.employeeId}</span>
                  <span>•</span>
                  <span>{employee.designation}</span>
                  <span>•</span>
                  <span>{employee.department}</span>
                  <span>•</span>
                  <span>Joined {employee.joiningDate}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              {onAddToPayroll && (
                <button
                  onClick={() => onAddToPayroll(employee)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#CB1417] hover:bg-[#ED1F24] text-white shadow-sm transition cursor-pointer"
                  title="Add this employee into active payroll batch"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add to Payroll</span>
                </button>
              )}
              <button
                onClick={() => onEdit(employee)}
                className={`p-2 rounded-lg border text-xs font-medium transition cursor-pointer ${
                  isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
                }`}
                title="Edit Employee Profile"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => onToggleStatus(employee)}
                className={`p-2 rounded-lg border text-xs font-medium transition cursor-pointer ${
                  isInactive
                    ? 'text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10'
                    : 'text-amber-500 border-amber-500/30 hover:bg-amber-500/10'
                }`}
                title={isInactive ? 'Reactivate Employee' : 'Deactivate Employee'}
              >
                {isInactive ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onDeleteRequest(employee)}
                className="p-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-medium transition cursor-pointer"
                title="Delete Employee"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition cursor-pointer ${
                  isDark ? 'hover:bg-[#222226] text-[#A1A1AA]' : 'hover:bg-[#E4E4E7] text-[#71717A]'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={`flex border-b overflow-x-auto ${isDark ? 'border-[#222222] bg-[#101012]' : 'border-[#E4E4E7] bg-[#F8F9FA]'}`}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
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

        {/* Tab Content Viewport */}
        <div className="flex-1 overflow-y-auto p-6 text-xs">
          {/* TAB 1: PERSONAL & CONTACT */}
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact Information */}
                <div className={`p-5 rounded-xl border space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                    <Mail className="w-3.5 h-3.5 text-[#CB1417]" />
                    <span>Contact Information</span>
                  </h4>
                  <div className="space-y-2.5 divide-y dark:divide-zinc-800 divide-zinc-200">
                    <div className="pt-1 flex justify-between">
                      <span className="text-zinc-500">Work Email</span>
                      <span className="font-semibold text-right">{employee.workEmail}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-zinc-500">Personal Email</span>
                      <span className="font-semibold text-right">{employee.personalEmail || '—'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-zinc-500">Primary Phone</span>
                      <span className="font-semibold text-right">{employee.primaryPhone}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-zinc-500">Alternate Phone</span>
                      <span className="font-semibold text-right">{employee.alternatePhone || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Personal Attributes */}
                <div className={`p-5 rounded-xl border space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                    <User className="w-3.5 h-3.5 text-[#CB1417]" />
                    <span>Personal Profile</span>
                  </h4>
                  <div className="space-y-2.5 divide-y dark:divide-zinc-800 divide-zinc-200">
                    <div className="pt-1 flex justify-between">
                      <span className="text-zinc-500">Date of Birth</span>
                      <span className="font-semibold text-right">{employee.dateOfBirth || '—'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-zinc-500">Gender</span>
                      <span className="font-semibold text-right">{employee.gender || '—'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-zinc-500">Blood Group</span>
                      <span className="font-semibold text-right font-mono">{employee.bloodGroup || '—'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-zinc-500">Preferred Name</span>
                      <span className="font-semibold text-right">{employee.preferredName || employee.legalName}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-5 rounded-xl border space-y-2 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                    <MapPin className="w-3.5 h-3.5 text-[#CB1417]" />
                    <span>Current Residential Address</span>
                  </h4>
                  <p className="text-zinc-600 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                    {employee.currentAddress || 'No current address recorded.'}
                  </p>
                </div>

                <div className={`p-5 rounded-xl border space-y-2 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                    <MapPin className="w-3.5 h-3.5 text-[#CB1417]" />
                    <span>Permanent Address</span>
                  </h4>
                  <p className="text-zinc-600 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                    {employee.permanentAddress || employee.currentAddress || 'Same as current address.'}
                  </p>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className={`p-5 rounded-xl border space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                  <Phone className="w-3.5 h-3.5 text-[#CB1417]" />
                  <span>Emergency Contact Person</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Contact Name</span>
                    <span className="font-semibold text-xs">{employee.emergencyContactName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Relationship</span>
                    <span className="font-semibold text-xs">{employee.emergencyContactRelationship || '—'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Phone Number</span>
                    <span className="font-semibold text-xs">{employee.emergencyContactPhone || '—'}</span>
                  </div>
                </div>
              </div>
              {/* Statutory IDs & Bank Details Card inside Personal Information */}
              <div className="space-y-4 pt-2">
                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500 text-xs flex items-center space-x-2">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>Sensitive statutory and financial identifiers are masked by default. Click the eye icon to unmask.</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Government IDs */}
                  <div className={`p-5 rounded-xl border space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                    <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                      <Shield className="w-3.5 h-3.5 text-[#CB1417]" />
                      <span>Government Identifiers</span>
                    </h4>
                    <div className="space-y-3 divide-y dark:divide-zinc-800 divide-zinc-200">
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-zinc-500">Aadhaar Number</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-semibold">
                            {revealedSensitives.aadhaar ? employee.aadhaarNumber || '—' : maskAadhaar(employee.aadhaarNumber)}
                          </span>
                          {employee.aadhaarNumber && (
                            <button
                              type="button"
                              onClick={() => toggleReveal('aadhaar')}
                              className="text-zinc-400 hover:text-zinc-200 p-0.5 cursor-pointer"
                              title={revealedSensitives.aadhaar ? 'Hide' : 'Reveal'}
                            >
                              {revealedSensitives.aadhaar ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-zinc-500">PAN</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-semibold">
                            {revealedSensitives.pan ? employee.panNumber || '—' : maskPan(employee.panNumber)}
                          </span>
                          {employee.panNumber && (
                            <button
                              type="button"
                              onClick={() => toggleReveal('pan')}
                              className="text-zinc-400 hover:text-zinc-200 p-0.5 cursor-pointer"
                              title={revealedSensitives.pan ? 'Hide' : 'Reveal'}
                            >
                              {revealedSensitives.pan ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-zinc-500">UAN (PF)</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-semibold">
                            {revealedSensitives.uan ? employee.uanNumber || '—' : maskUan(employee.uanNumber)}
                          </span>
                          {employee.uanNumber && (
                            <button
                              type="button"
                              onClick={() => toggleReveal('uan')}
                              className="text-zinc-400 hover:text-zinc-200 p-0.5 cursor-pointer"
                              title={revealedSensitives.uan ? 'Hide' : 'Reveal'}
                            >
                              {revealedSensitives.uan ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-zinc-500">ESI / ESIC Number</span>
                        <span className="font-mono font-semibold">{employee.esiNumber || employee.esicNumber || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bank Account */}
                  <div className={`p-5 rounded-xl border space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                    <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                      <CreditCard className="w-3.5 h-3.5 text-[#CB1417]" />
                      <span>Bank & Disbursement</span>
                    </h4>
                    <div className="space-y-3 divide-y dark:divide-zinc-800 divide-zinc-200">
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-zinc-500">Account Holder</span>
                        <span className="font-semibold">{employee.accountHolderName || employee.legalName}</span>
                      </div>
                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-zinc-500">Bank Name</span>
                        <span className="font-semibold">{employee.bankName || '—'}</span>
                      </div>
                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-zinc-500">Account Number</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-semibold">
                            {revealedSensitives.bank ? employee.accountNumber || '—' : maskBankAccount(employee.accountNumber)}
                          </span>
                          {employee.accountNumber && (
                            <button
                              type="button"
                              onClick={() => toggleReveal('bank')}
                              className="text-zinc-400 hover:text-zinc-200 p-0.5 cursor-pointer"
                              title={revealedSensitives.bank ? 'Hide' : 'Reveal'}
                            >
                              {revealedSensitives.bank ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-zinc-500">IFSC Code</span>
                        <span className="font-mono font-semibold">{employee.ifscCode || '—'}</span>
                      </div>
                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-zinc-500">Branch Name</span>
                        <span className="font-semibold">{employee.branchName || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EMPLOYMENT DETAILS */}
          {activeTab === 'employment' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Organization & Hierarchy */}
                <div className={`p-5 rounded-xl border space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                    <Building className="w-3.5 h-3.5 text-[#CB1417]" />
                    <span>Organizational Role & Schedule</span>
                  </h4>
                  <div className="space-y-2.5 divide-y dark:divide-zinc-800 divide-zinc-200">
                    <div className="pt-1 flex justify-between">
                      <span className="text-zinc-500">Department</span>
                      <span className="font-semibold text-right">{employee.department}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-zinc-500">Designation / Title</span>
                      <span className="font-semibold text-right">{employee.designation}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-zinc-500">Job Level / Grade</span>
                      <span className="font-semibold text-right font-mono">{employee.jobLevel || '—'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-zinc-500">Reporting Manager</span>
                      <span className="font-semibold text-right">{employee.reportingManager || '—'}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-zinc-500">Work Location</span>
                      <span className="font-semibold text-right">{employee.workLocation}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-zinc-500">Assigned Shift</span>
                      <span className="font-semibold text-right text-emerald-500">General Shift (09:30 AM – 06:30 PM)</span>
                    </div>
                  </div>
                </div>

                {/* Tenure & Probation */}
                <div className={`p-5 rounded-xl border space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                    <Calendar className="w-3.5 h-3.5 text-[#CB1417]" />
                    <span>Tenure & Status</span>
                  </h4>
                  <div className="space-y-2.5 divide-y dark:divide-zinc-800 divide-zinc-200">
                    <div className="pt-1 flex justify-between">
                      <span className="text-zinc-500">Joining Date</span>
                      <span className="font-semibold text-right">{employee.joiningDate}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-zinc-500">Employment Type</span>
                      <span className="font-semibold text-right">{employee.employmentType}</span>
                    </div>
                    <div className="pt-2 flex justify-between">
                      <span className="text-zinc-500">Probation Status</span>
                      <span className="font-semibold text-right">{employee.probationStatus}</span>
                    </div>
                    {employee.confirmationDate && (
                      <div className="pt-2 flex justify-between">
                        <span className="text-zinc-500">Confirmation Date</span>
                        <span className="font-semibold text-right">{employee.confirmationDate}</span>
                      </div>
                    )}
                    {employee.employmentEndDate && (
                      <div className="pt-2 flex justify-between">
                        <span className="text-zinc-500">Resignation / Exit Date</span>
                        <span className="font-semibold text-right text-amber-500">{employee.employmentEndDate}</span>
                      </div>
                    )}
                    {employee.previousEmployer && (
                      <div className="pt-2 flex justify-between">
                        <span className="text-zinc-500">Previous Employer</span>
                        <span className="font-semibold text-right">{employee.previousEmployer}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Education & Qualifications */}
              {employee.qualifications && employee.qualifications.length > 0 && (
                <div className={`p-5 rounded-xl border space-y-3 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
                    <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
                    <span>Qualifications</span>
                  </h4>
                  <div className="space-y-2">
                    {employee.qualifications.map((q, idx) => (
                      <div key={q.id || idx} className="flex items-center justify-between py-1 border-b dark:border-zinc-800 border-zinc-200">
                        <div>
                          <span className="font-semibold">{q.qualificationName}</span>
                          <span className="text-zinc-500 text-[11px] block">{q.institution} • {q.specialization}</span>
                        </div>
                        <span className="font-mono text-xs">{q.completionYear}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {employee.hrNotes && (
                <div className={`p-5 rounded-xl border space-y-2 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-black'}`}>
                    HR Notes & Internal Record
                  </h4>
                  <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                    {employee.hrNotes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <EmployeeAttendanceTab employee={employee} />
          )}

          {/* TAB 4: PAYROLL DATA */}
          {activeTab === 'payroll' && (
            <EmployeePayrollDataTab
              employee={employee}
              onSalaryUpdated={onEdit}
            />
          )}

          {/* TAB 5: DOCUMENTS */}
          {activeTab === 'documents' && (
            <EmployeeDocumentsSection
              employee={employee}
              documents={documents}
              onSaveDocument={onSaveDocument}
              onDeleteDocument={onDeleteDocument}
            />
          )}

          {/* TAB 6: PAYSLIP HISTORY */}
          {activeTab === 'payslips' && (
            <EmployeePayslipHistoryTab
              employee={employee}
              onPreviewPayslip={onPreviewPayslip}
            />
          )}
        </div>
      </div>
    </div>
  );
};
