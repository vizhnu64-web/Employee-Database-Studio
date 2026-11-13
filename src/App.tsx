/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ImportView } from './components/ImportView';
import { EmployeesView } from './components/EmployeesView';
import { ValidationView } from './components/ValidationView';
import { GeneratorView } from './components/GeneratorView';
import { ExportCenterView } from './components/ExportCenterView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { LayoutEditorView } from './components/LayoutEditorView';
import { EmailDeliveryView } from './components/EmailDeliveryView';
import { EmployeeDirectoryView } from './components/employeeDirectory/EmployeeDirectoryView';
import { AttendanceView } from './components/AttendanceView';
import { ServerAdminView } from './components/ServerAdminView';
import { ClientConnectionView } from './components/ClientConnectionView';
import { UserManagementView } from './components/UserManagementView';
import { BackupRestoreView } from './components/BackupRestoreView';
import { LicenseManagementView } from './components/LicenseManagementView';
import { PayslipPreviewModal } from './components/PayslipPreviewModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { LoginView } from './components/LoginView';
import { CompanySettings, EmployeeRecord, GeneratedPayslipRecord, PayslipLayoutSettings, DEFAULT_LAYOUT_SETTINGS, EmailSettings, DEFAULT_EMAIL_SETTINGS } from './types/payroll';
import { DirectoryEmployee, EmployeeDocument } from './types/employeeDirectory';
import { DEFAULT_COMPANY_SETTINGS, localDB } from './utils/dbStorage';
import { createSampleWorkbookBuffer, mapRowsToEmployeeRecords, parseExcelFile } from './utils/excelParser';
import { autoDetectColumnMapping } from './utils/columnDetector';
import { apiClient, AuthUser } from './utils/apiClient';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Trash2, RefreshCw } from 'lucide-react';

function AppContent() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [history, setHistory] = useState<GeneratedPayslipRecord[]>([]);
  const [directoryEmployees, setDirectoryEmployees] = useState<DirectoryEmployee[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [layoutSettings, setLayoutSettings] = useState<PayslipLayoutSettings>(DEFAULT_LAYOUT_SETTINGS);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [selectedMonth, setSelectedMonth] = useState<string>('October');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [previewEmployee, setPreviewEmployee] = useState<EmployeeRecord | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => (
    apiClient.getToken() ? apiClient.getCurrentUser() : null
  ));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Verify existing auth token and listen for 401 session expiration
  useEffect(() => {
    let active = true;
    const unsubscribe = apiClient.onUnauthorized(() => {
      if (active) {
        setCurrentUser(null);
        setToastNotification('Session expired or authentication required. Please sign in.');
      }
    });

    async function validateSession() {
      const token = apiClient.getToken();
      if (!token) {
        if (active) setCurrentUser(null);
        return;
      }
      try {
        const res = await apiClient.verifyToken();
        if (active && res.success && res.user) {
          setCurrentUser(res.user);
        }
      } catch {
        if (active) setCurrentUser(null);
      }
    }

    validateSession();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Initialize data from local SQLite / IndexedDB
  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) setIsInitializing(false);
    }, 300);

    async function loadInitialData() {
      try {
        const loadedSettings = await localDB.getSettings();
        const loadedEmployees = await localDB.getEmployees();
        const loadedHistory = await localDB.getHistory();
        const loadedLayout = await localDB.getLayoutSettings();
        const loadedEmail = await localDB.getEmailSettings();
        const loadedDirectory = await localDB.getDirectoryEmployees();
        const loadedDocs = await localDB.getEmployeeDocuments();

        if (isMounted) {
          setSettings(loadedSettings);
          setEmployees(loadedEmployees);
          setHistory(loadedHistory);
          setLayoutSettings(loadedLayout);
          setEmailSettings(loadedEmail);
          setDirectoryEmployees(loadedDirectory);
          setDocuments(loadedDocs);
        }
      } catch (err) {
        console.error('Error initializing local database:', err);
      } finally {
        if (isMounted) {
          clearTimeout(safetyTimer);
          setIsInitializing(false);
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastNotification(msg);
    setTimeout(() => setToastNotification(null), 3500);
  };

  // Handler for loaded data from Excel/CSV import
  const handleDataLoaded = async (records: EmployeeRecord[], fileName: string) => {
    setEmployees(records);
    await localDB.saveEmployees(records);
    setActiveTab('records');
    showToast(`Loaded ${records.length} employee records from "${fileName}".`);
  };

  // Handler for loading demo corporate dataset
  const handleLoadDemoData = async () => {
    try {
      const buffer = createSampleWorkbookBuffer();
      const parsed = parseExcelFile(buffer, 'Acme_Payroll_Sample.xlsx');
      const mapping = autoDetectColumnMapping(parsed.headers);
      const records = mapRowsToEmployeeRecords(
        parsed.rows,
        mapping,
        selectedMonth,
        selectedYear
      );

      setEmployees(records);
      await localDB.saveEmployees(records);
      showToast('Loaded 10-staff verified demo payroll dataset into local storage.');
      setActiveTab('dashboard');
    } catch (err: any) {
      alert(`Error loading sample data: ${err.message}`);
    }
  };

  // Handler for downloading sample template
  const handleDownloadTemplate = () => {
    const buffer = createSampleWorkbookBuffer();
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Payroll_Template_${selectedMonth}_${selectedYear}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded sample Excel template (.xlsx).');
  };

  // Handler for clearing imported employees
  const handleClearData = () => {
    setShowClearConfirmModal(true);
  };

  const executeClearData = async () => {
    setIsClearingData(true);
    try {
      setEmployees([]);
      await localDB.clearEmployees();
      showToast('Imported employee payroll dataset cleared from local database.');
      setShowClearConfirmModal(false);
    } catch (err: any) {
      alert(`Failed to clear data: ${err.message || 'Unknown error'}`);
    } finally {
      setIsClearingData(false);
    }
  };

  // Handler for updating a single employee record
  const handleUpdateEmployee = async (updated: EmployeeRecord) => {
    const newEmployees = employees.map(e => e.id === updated.id ? updated : e);
    setEmployees(newEmployees);
    await localDB.saveEmployees(newEmployees);
    showToast(`Updated and re-verified record for ${updated.name}.`);
  };

  // Handler for updating all employees in batch
  const handleBatchUpdated = async (updated: EmployeeRecord[]) => {
    setEmployees(updated);
    await localDB.saveEmployees(updated);
  };

  // Handler for saving company settings
  const handleSaveSettings = async (newSettings: CompanySettings) => {
    setSettings(newSettings);
    await localDB.saveSettings(newSettings);
  };

  const handleSaveLayout = async (layout: PayslipLayoutSettings) => {
    setLayoutSettings(layout);
    await localDB.saveLayoutSettings(layout);
    showToast('Payslip layout configuration saved locally.');
  };

  const handleSaveEmailSettings = async (emailCfg: EmailSettings) => {
    setEmailSettings(emailCfg);
    await localDB.saveEmailSettings(emailCfg);
    showToast('SMTP email settings saved securely.');
  };

  // Handler when a payslip is generated
  const handleRecordGenerated = (record: GeneratedPayslipRecord) => {
    setHistory(prev => {
      const filtered = prev.filter(h => h.id !== record.id);
      return [record, ...filtered];
    });
  };

  const handleHistoryCleared = () => {
    setHistory([]);
    showToast('Generation history cleared.');
  };

  const handleSaveDirectoryEmployee = async (emp: DirectoryEmployee) => {
    const existing = directoryEmployees.some(e => e.id === emp.id || e.employeeId === emp.employeeId);
    let updated: DirectoryEmployee[];
    if (existing) {
      updated = directoryEmployees.map(e => (e.id === emp.id || e.employeeId === emp.employeeId) ? emp : e);
    } else {
      updated = [emp, ...directoryEmployees];
    }
    setDirectoryEmployees(updated);
    await localDB.saveDirectoryEmployee(emp);
    showToast(`Saved employee record for ${emp.legalName}.`);
  };

  const handleSaveDirectoryEmployeesBatch = async (importedList: DirectoryEmployee[]) => {
    let current = [...directoryEmployees];
    for (const emp of importedList) {
      const existingIdx = current.findIndex(e => e.id === emp.id || e.employeeId.toUpperCase() === emp.employeeId.toUpperCase());
      if (existingIdx >= 0) {
        current[existingIdx] = emp;
      } else {
        current = [emp, ...current];
      }
      await localDB.saveDirectoryEmployee(emp);
    }
    setDirectoryEmployees(current);
    showToast(`Successfully imported ${importedList.length} employee records.`);
  };

  const handleDeleteDirectoryEmployee = async (id: string) => {
    const emp = directoryEmployees.find(e => e.id === id);
    const updated = directoryEmployees.filter(e => e.id !== id);
    setDirectoryEmployees(updated);
    if (emp) {
      setDocuments(prev => prev.filter(d => d.employeeId !== emp.employeeId));
    }
    await localDB.deleteDirectoryEmployee(id);
    showToast('Deleted employee record from database.');
  };

  const handleSaveDocument = async (doc: EmployeeDocument) => {
    const existing = documents.some(d => d.id === doc.id);
    let updated: EmployeeDocument[];
    if (existing) {
      updated = documents.map(d => d.id === doc.id ? doc : d);
    } else {
      updated = [doc, ...documents];
    }
    setDocuments(updated);
    await localDB.saveEmployeeDocument(doc);
    showToast(`Saved document "${doc.title}".`);
  };

  const handleDeleteDocument = async (docId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
    await localDB.deleteEmployeeDocument(docId);
    showToast('Document deleted.');
  };

  const handleSyncToPayrollBatch = async (dirList: DirectoryEmployee[]) => {
    const newRecords: EmployeeRecord[] = dirList.map(dir => {
      const basic = dir.standardBasic || 35000;
      const hra = dir.standardHra || 14000;
      const allowances = dir.standardAllowances || 6000;
      const gross = basic + hra + allowances;
      const pf = Math.min(Math.round(basic * 0.12), 1800);
      const pt = 200;
      const deductions = pf + pt;
      const net = gross - deductions;

      return {
        id: `batch_${dir.employeeId}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        employeeId: dir.employeeId,
        name: dir.legalName,
        email: dir.workEmail,
        department: dir.department,
        designation: dir.designation,
        joiningDate: dir.joiningDate,
        bankAccount: dir.accountNumber,
        bankName: dir.bankName,
        ifscCode: dir.ifscCode,
        branchName: dir.branchName,
        accountHolderName: dir.accountHolderName,
        pan: dir.panNumber,
        uan: dir.uanNumber,
        esiNumber: dir.esiNumber || dir.esicNumber,
        customFields: dir.customFields,
        basic,
        hra,
        otherAllowances: allowances,
        calculatedGross: gross,
        pf,
        esi: 0,
        professionalTax: pt,
        tds: 0,
        otherDeductions: 0,
        calculatedDeductions: deductions,
        calculatedNet: net,
        paidDays: 31,
        unpaidDays: 0,
        isValid: true,
        issues: []
      };
    });

    const merged = [...employees];
    newRecords.forEach(rec => {
      const idx = merged.findIndex(e => e.employeeId === rec.employeeId);
      if (idx >= 0) {
        merged[idx] = rec;
      } else {
        merged.push(rec);
      }
    });

    setEmployees(merged);
    await localDB.saveEmployees(merged);
    setActiveTab('records');
  };

  const handleDatabaseRestored = async () => {
    const loadedSettings = await localDB.getSettings();
    const loadedEmployees = await localDB.getEmployees();
    const loadedHistory = await localDB.getHistory();
    const loadedDirectory = await localDB.getDirectoryEmployees();
    const loadedDocs = await localDB.getEmployeeDocuments();
    setSettings(loadedSettings);
    setEmployees(loadedEmployees);
    setHistory(loadedHistory);
    setDirectoryEmployees(loadedDirectory);
    setDocuments(loadedDocs);
    showToast('Database successfully restored from backup.');
  };

  const invalidCount = employees.filter(e => !e.isValid || e.issues.length > 0).length;

  const handleLogout = () => {
    apiClient.logout();
    setCurrentUser(null);
    setActiveTab('dashboard');
    showToast('Logged out of session.');
  };

  if (isInitializing) {
    return (
      <div className={`h-screen w-screen flex flex-col items-center justify-center font-sans ${isDark ? 'bg-[#000000] text-white' : 'bg-[#FFFFFF] text-black'}`}>
        <div className="w-12 h-12 rounded-xl bg-[#CB1417] flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-lg shadow-red-900/40 animate-pulse mb-3">
          EDS
        </div>
        <p className="text-xs font-semibold tracking-wide">Initializing Employee Database Studio...</p>
        <p className="text-[11px] opacity-60 mt-1">Enterprise Cloud Edition</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginView
        companySettings={settings}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setActiveTab('dashboard');
          showToast(`Signed in as ${user.fullName}.`);
        }}
      />
    );
  }

  return (
    <div className={`h-screen w-screen flex flex-col ${isDark ? 'bg-[#000000] text-white' : 'bg-[#FFFFFF] text-black'} overflow-hidden font-sans transition-colors duration-200`}>
      {/* Title Bar */}
      <TitleBar
        onLoadDemoData={handleLoadDemoData}
        onDownloadTemplate={handleDownloadTemplate}
        totalEmployees={employees.length}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        companySettings={settings}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenChangePassword={() => setShowChangePasswordModal(true)}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
      />

      {/* Main Workspace: Sidebar + Content View */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          totalEmployees={employees.length}
          invalidCount={invalidCount}
          historyCount={history.length}
          directoryCount={directoryEmployees.length}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenChangePassword={() => setShowChangePasswordModal(true)}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Viewport Content Area */}
        <main className={`flex-1 overflow-y-auto p-6 ${isDark ? 'bg-[#000000]' : 'bg-[#FAFAFA]'} transition-colors duration-200`}>
          <div className="max-w-6xl mx-auto pb-10">
            {activeTab === 'dashboard' && (
              <DashboardView
                employees={employees}
                history={history}
                settings={settings}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onNavigate={setActiveTab}
                onTriggerImport={() => setActiveTab('import')}
                onLoadDemoData={handleLoadDemoData}
                onDownloadTemplate={handleDownloadTemplate}
                onClearData={handleClearData}
              />
            )}

            {activeTab === 'directory' && (
              <EmployeeDirectoryView
                directoryEmployees={directoryEmployees}
                documents={documents}
                onSaveEmployee={handleSaveDirectoryEmployee}
                onSaveBatchEmployees={handleSaveDirectoryEmployeesBatch}
                onDeleteEmployee={handleDeleteDirectoryEmployee}
                onSaveDocument={handleSaveDocument}
                onDeleteDocument={handleDeleteDocument}
                onSyncToPayrollBatch={handleSyncToPayrollBatch}
                payrollHistoryCountForEmployee={(empId) => history.filter(h => h.employeeId === empId).length}
              />
            )}

            {activeTab === 'import' && (
              <ImportView
                onDataLoaded={handleDataLoaded}
                onLoadDemoData={handleLoadDemoData}
                onDownloadTemplate={handleDownloadTemplate}
                currentEmployeeCount={employees.length}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />
            )}

            {activeTab === 'records' && (
              <EmployeesView
                employees={employees}
                onUpdateEmployee={handleUpdateEmployee}
                onPreviewPayslip={(emp) => setPreviewEmployee(emp)}
                onClearData={handleClearData}
                settings={settings}
              />
            )}

            {activeTab === 'validation' && (
              <ValidationView
                employees={employees}
                onBatchUpdated={handleBatchUpdated}
                onNavigateToGenerator={() => setActiveTab('generator')}
                settings={settings}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />
            )}

            {activeTab === 'generator' && (
              <GeneratorView
                employees={employees}
                settings={settings}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onPreviewEmployee={(emp) => setPreviewEmployee(emp)}
                onRecordGenerated={handleRecordGenerated}
                history={history}
                layoutSettings={layoutSettings}
              />
            )}

            {activeTab === 'export' && (
              <ExportCenterView
                employees={employees}
                history={history}
                settings={settings}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                layoutSettings={layoutSettings}
              />
            )}

            {activeTab === 'history' && (
              <HistoryView
                history={history}
                onHistoryCleared={handleHistoryCleared}
                onPreviewEmployee={(emp) => setPreviewEmployee(emp)}
                employees={employees}
                settings={settings}
              />
            )}

            {activeTab === 'layout' && (
              <LayoutEditorView
                layoutSettings={layoutSettings}
                onSaveLayout={handleSaveLayout}
                settings={settings}
                sampleEmployee={employees[0] || {
                  employeeId: 'EMP001',
                  name: 'Arun Kumar',
                  department: 'Engineering',
                  designation: 'Senior Developer',
                  basic: 45000,
                  hra: 18000,
                  conveyance: 1600,
                  medicalAllowance: 1250,
                  specialAllowance: 5000,
                  otherEarnings: 2000,
                  grossEarnings: 72850,
                  pf: 1800,
                  esi: 0,
                  professionalTax: 200,
                  tds: 3500,
                  otherDeductions: 500,
                  totalDeductions: 6000,
                  calculatedNet: 66850,
                  bankAccount: '123456789012',
                  pan: 'ABCDE1234F',
                  joiningDate: '15-Jan-2023',
                  email: 'arun.kumar@company.com',
                  paidDays: 31,
                  workingDays: 31,
                  leaveDays: 0,
                  isValid: true,
                  issues: []
                }}
              />
            )}

            {activeTab === 'email' && (
              <EmailDeliveryView
                emailSettings={emailSettings}
                onSaveEmailSettings={handleSaveEmailSettings}
                employees={employees}
                settings={settings}
                layoutSettings={layoutSettings}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onNavigateToSettings={() => setActiveTab('settings')}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                settings={settings}
                onSaveSettings={handleSaveSettings}
                onDatabaseRestored={handleDatabaseRestored}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceView />
            )}

            {activeTab === 'server_admin' && (
              <ServerAdminView settings={settings} />
            )}

            {activeTab === 'client_connection' && (
              <ClientConnectionView />
            )}

            {activeTab === 'users' && (
              <UserManagementView />
            )}

            {activeTab === 'backup' && (
              <BackupRestoreView />
            )}

            {activeTab === 'license' && (
              <LicenseManagementView />
            )}
          </div>
        </main>
      </div>

      {/* Global Payslip Preview Modal */}
      {previewEmployee && (
        <PayslipPreviewModal
          employee={previewEmployee}
          settings={settings}
          month={selectedMonth}
          year={selectedYear}
          onClose={() => setPreviewEmployee(null)}
          onSavedToHistory={handleRecordGenerated}
          layoutSettings={layoutSettings}
        />
      )}

      {/* Clear Data Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden p-6 space-y-5 ${
            isDark ? 'bg-[#0D0D0E] border-[#2A2A2E] text-white' : 'bg-white border-[#E4E4E7] text-black'
          }`}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight">Clear Imported Payroll Dataset?</h3>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
              isDark ? 'bg-[#141416] border-[#222226] text-zinc-300' : 'bg-[#FAFAFC] border-[#E4E4E7] text-zinc-700'
            }`}>
              <p className="font-semibold">What will be cleared:</p>
              <ul className="list-disc list-inside space-y-1 text-zinc-500 dark:text-zinc-400">
                <li>All active imported employee payroll records ({employees.length} records).</li>
              </ul>
              <p className="font-semibold pt-1 text-emerald-600 dark:text-emerald-400">What will be preserved safely:</p>
              <ul className="list-disc list-inside space-y-1 text-emerald-600/80 dark:text-emerald-400/80">
                <li>Master Employee Database & Documents</li>
                <li>Payslip Generation History</li>
                <li>Company, SMTP & Payslip Layout Settings</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2 border-t dark:border-zinc-800 border-zinc-200">
              <button
                type="button"
                disabled={isClearingData}
                onClick={() => setShowClearConfirmModal(false)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-zinc-300 border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-zinc-700 border-[#E4E4E7]'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingData}
                onClick={executeClearData}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/30 transition cursor-pointer disabled:opacity-50 flex items-center space-x-2"
              >
                {isClearingData && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isClearingData ? 'Clearing Dataset...' : 'Confirm & Clear Dataset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        onSuccess={() => {
          setShowChangePasswordModal(false);
          showToast('Password updated successfully.');
        }}
      />

      {/* Toast Notification */}
      {toastNotification && (
        <div className={`fixed bottom-5 right-5 ${isDark ? 'bg-[#111113] border-[#2A2A2E] text-white shadow-2xl' : 'bg-white border-neutral-200 text-black shadow-xl'} border text-xs px-4 py-2.5 rounded-xl z-50 flex items-center space-x-2.5 animate-in slide-in-from-bottom-2`}>
          <span className="w-2 h-2 rounded-full bg-[#CB1417] shadow-sm shadow-red-500/50" />
          <span className="font-medium">{toastNotification}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
