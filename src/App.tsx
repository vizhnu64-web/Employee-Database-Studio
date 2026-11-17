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
import { GeneratorView } from './components/GeneratorView';
import { LayoutEditorView } from './components/LayoutEditorView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { EmailDeliveryView } from './components/EmailDeliveryView';
import { EmployeeDirectoryView } from './components/employeeDirectory/EmployeeDirectoryView';
import { ManualPayslipView } from './components/ManualPayslipView';
import { PayslipPreviewModal } from './components/PayslipPreviewModal';
import {
  CompanySettings,
  EmployeeRecord,
  GeneratedPayslipRecord,
  PayslipLayoutSettings,
  DEFAULT_LAYOUT_SETTINGS,
  EmailSettings,
  DEFAULT_EMAIL_SETTINGS,
} from './types/payroll';
import { DirectoryEmployee, EmployeeDocument } from './types/employeeDirectory';
import { DEFAULT_COMPANY_SETTINGS, localDB } from './utils/dbStorage';
import { createSampleWorkbookBuffer, mapRowsToEmployeeRecords, parseExcelFile } from './utils/excelParser';
import { autoDetectColumnMapping } from './utils/columnDetector';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { apiClient, WorkspaceUser } from './utils/apiClient';
import {
  getGoogleSession,
  getWorkspaceLinks,
  subscribeGoogleSession,
  subscribeWorkspaceLinks,
  GoogleSessionState,
  WorkspaceLinks,
} from './utils/googleAuthClient';
import { applyGlobalBrandColors, extractBrandColorsFromSettings } from './utils/brandColors';
import { Trash2, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

const LAYOUT_PREVIEW_FALLBACK: EmployeeRecord = {
  id: 'layout_preview_sample',
  employeeId: 'EMP0001',
  name: 'Alex Morgan',
  email: 'alex.morgan@apexenterprise.com',
  phone: '+91 98765 43210',
  department: 'Engineering',
  designation: 'Senior Software Engineer',
  joiningDate: '2023-03-15',
  paymentDate: '2026-10-31',
  ctc: 70000,
  employerPf: 3600,
  employerEsi: 0,
  basic: 36000,
  hra: 18000,
  specialAllowance: 8400,
  otherAllowances: 7600,
  calculatedGross: 66400,
  pf: 3600,
  employeePf: 3600,
  esi: 0,
  professionalTax: 200,
  tds: 4200,
  loan: 0,
  lateDeduction: 0,
  lopDays: 0,
  lopAmount: 0,
  lopDeduction: 0,
  otherDeductions: 0,
  calculatedDeductions: 8000,
  calculatedNet: 58400,
  paidDays: 31,
  unpaidDays: 0,
  totalWorkingDays: 22,
  pfNumber: 'MH/BAN/0012345/000/0001234',
  esiNumber: '31-00-123456-000-0001',
  pan: 'ABCDE1234F',
  uan: '100928374651',
  bankName: 'First National Bank',
  bankAccount: '987654324821',
  ifscCode: 'FNBK0000412',
  branchName: 'MG Road Corporate Branch',
  accountHolderName: 'Alex Morgan',
  isValid: true,
  issues: [],
};

function AppContent() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [settingsSectionTarget, setSettingsSectionTarget] = useState<'info' | 'branding' | 'payslip' | 'email' | 'google' | 'signatory' | 'database' | undefined>(undefined);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [history, setHistory] = useState<GeneratedPayslipRecord[]>([]);
  const [directoryEmployees, setDirectoryEmployees] = useState<DirectoryEmployee[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [layoutSettings, setLayoutSettings] = useState<PayslipLayoutSettings>(DEFAULT_LAYOUT_SETTINGS);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [selectedMonth, setSelectedMonth] = useState<string>('October');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [previewState, setPreviewState] = useState<{ employee: EmployeeRecord; method: 'Bulk Payroll' | 'Manual Entry' } | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [googleSession, setGoogleSession] = useState<GoogleSessionState>(() => getGoogleSession());
  const [workspaceLinks, setWorkspaceLinksState] = useState<WorkspaceLinks>(() => getWorkspaceLinks());
  const [workspaceUser] = useState<WorkspaceUser>({
    id: 1,
    companyId: 1,
    username: 'hr_manager',
    fullName: 'HR Manager',
    role: 'admin',
    email: 'hr@company.com',
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Subscribe cleanly to in-memory GIS auth & non-secret resource links
  useEffect(() => {
    const unsubSession = subscribeGoogleSession(setGoogleSession);
    const unsubLinks = subscribeWorkspaceLinks(setWorkspaceLinksState);
    return () => {
      unsubSession();
      unsubLinks();
    };
  }, []);

  // Apply brand color CSS variables whenever settings or theme change
  useEffect(() => {
    applyGlobalBrandColors(extractBrandColorsFromSettings(settings));
  }, [settings, isDark]);

  // Initialize local draft workspace immediately (zero blocking auth walls)
  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) setIsInitializing(false);
    }, 350);

    async function loadInitialData() {
      try {
        const [
          loadedSettings,
          loadedEmployees,
          loadedHistory,
          loadedLayout,
          loadedEmail,
          loadedDirectory,
          loadedDocs,
        ] = await Promise.all([
          localDB.getSettings(),
          localDB.getEmployees(),
          localDB.getHistory(),
          localDB.getLayoutSettings(),
          localDB.getEmailSettings(),
          localDB.getDirectoryEmployees(),
          localDB.getEmployeeDocuments(),
        ]);

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
        console.error('Error initializing workspace:', err);
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

  const openGoogleConnectionTab = () => {
    setSettingsSectionTarget('google');
    setActiveTab('settings');
  };

  const handleDataLoaded = async (records: EmployeeRecord[], fileName: string) => {
    setEmployees(records);
    await localDB.saveEmployees(records);
    setActiveTab('records');
    showToast(`Loaded ${records.length} employee records from "${fileName}".`);
  };

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
      showToast('Loaded 10-staff verified demo payroll dataset.');
      setActiveTab('dashboard');
    } catch (err: any) {
      showToast(`Error loading sample data: ${err.message}`);
    }
  };

  const handleDownloadTemplate = () => {
    const buffer = createSampleWorkbookBuffer();
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Payroll_Template_${selectedMonth}_${selectedYear}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded sample Excel template.');
  };

  const handleClearData = () => {
    setShowClearConfirmModal(true);
  };

  const executeClearData = async () => {
    setIsClearingData(true);
    try {
      setEmployees([]);
      await localDB.clearEmployees();
      showToast('Imported employee payroll dataset cleared.');
      setShowClearConfirmModal(false);
    } catch (err: any) {
      showToast(`Failed to clear data: ${err.message}`);
    } finally {
      setIsClearingData(false);
    }
  };

  const handleUpdateEmployee = async (updated: EmployeeRecord) => {
    const newEmployees = employees.map((e) => (e.id === updated.id ? updated : e));
    setEmployees(newEmployees);
    await localDB.saveEmployees(newEmployees);
    showToast(`Updated record for ${updated.name}.`);
  };

  const handleSaveSettings = async (newSettings: CompanySettings): Promise<{ cloudSaved: boolean }> => {
    setSettings(newSettings);
    await localDB.saveSettings(newSettings);
    if (googleSession.isConnected && workspaceLinks.spreadsheetId) {
      await apiClient.saveSettings(newSettings);
      return { cloudSaved: true };
    }
    return { cloudSaved: false };
  };

  const handleSaveLayoutSettings = async (newLayout: PayslipLayoutSettings) => {
    setLayoutSettings(newLayout);
    await localDB.saveLayoutSettings(newLayout);
    if (googleSession.isConnected && workspaceLinks.spreadsheetId) {
      try {
        await apiClient.saveLayoutSettings(newLayout);
      } catch (err: any) {
        showToast(`Layout saved locally; Google Sheets sync failed: ${err.message}`);
      }
    }
  };

  const handleSaveEmailSettings = async (emailCfg: EmailSettings) => {
    setEmailSettings(emailCfg);
    await localDB.saveEmailSettings(emailCfg);
    showToast('Email template settings saved.');
  };

  const handleRecordGenerated = (record: GeneratedPayslipRecord) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.id !== record.id);
      return [record, ...filtered];
    });
  };

  const handleHistoryCleared = () => {
    setHistory([]);
    showToast('Generation history cleared.');
  };

  const handleSaveDirectoryEmployee = async (emp: DirectoryEmployee) => {
    const existing = directoryEmployees.some((e) => e.id === emp.id || e.employeeId === emp.employeeId);
    let updated: DirectoryEmployee[];
    if (existing) {
      updated = directoryEmployees.map((e) => (e.id === emp.id || e.employeeId === emp.employeeId ? emp : e));
    } else {
      updated = [emp, ...directoryEmployees];
    }
    setDirectoryEmployees(updated);
    await localDB.saveDirectoryEmployee(emp);

    if (googleSession.isConnected && workspaceLinks.spreadsheetId) {
      try {
        await apiClient.saveEmployee({
          employeeId: emp.employeeId,
          legalName: emp.legalName,
          workEmail: emp.workEmail,
          primaryPhone: emp.primaryPhone,
          designation: emp.designation,
          department: emp.department,
          joiningDate: emp.joiningDate,
          employmentStatus: emp.employmentStatus,
          accountNumber: emp.accountNumber,
          bankName: emp.bankName,
          ifscCode: emp.ifscCode,
          panNumber: emp.panNumber,
          uanNumber: emp.uanNumber,
          esiNumber: emp.esiNumber,
          standardBasic: emp.standardBasic,
          standardHra: emp.standardHra,
          standardAllowances: emp.standardAllowances,
          standardCtc: emp.standardCtc,
          standardEmployerEsi: emp.standardEmployerEsi,
        });
        showToast(`Saved ${emp.legalName} to Google Sheets & local drafts.`);
        return;
      } catch (err: any) {
        showToast(`Saved ${emp.legalName} locally (Google Sheets sync deferred: ${err.message}).`);
        return;
      }
    }
    showToast(`Saved ${emp.legalName} to local drafts (connect Google Sheets to sync permanently).`);
  };

  const handleSaveDirectoryEmployeesBatch = async (importedList: DirectoryEmployee[]) => {
    let current = [...directoryEmployees];
    for (const emp of importedList) {
      const existingIdx = current.findIndex((e) => e.id === emp.id || e.employeeId.toUpperCase() === emp.employeeId.toUpperCase());
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
    const emp = directoryEmployees.find((e) => e.id === id);
    const updated = directoryEmployees.filter((e) => e.id !== id);
    setDirectoryEmployees(updated);
    if (emp) {
      setDocuments((prev) => prev.filter((d) => d.employeeId !== emp.employeeId));
    }
    await localDB.deleteDirectoryEmployee(id);
    if (emp && googleSession.isConnected && workspaceLinks.spreadsheetId) {
      await apiClient.deleteEmployee(emp.employeeId).catch(() => null);
    }
    showToast('Deleted employee record.');
  };

  const handleSaveDocument = async (doc: EmployeeDocument) => {
    const existing = documents.some((d) => d.id === doc.id);
    let updated: EmployeeDocument[];
    if (existing) {
      updated = documents.map((d) => (d.id === doc.id ? doc : d));
    } else {
      updated = [doc, ...documents];
    }
    setDocuments(updated);
    await localDB.saveEmployeeDocument(doc);
    showToast(`Saved document "${doc.title}".`);
  };

  const handleDeleteDocument = async (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    await localDB.deleteEmployeeDocument(docId);
    showToast('Document deleted.');
  };

  const handleSyncToPayrollBatch = async (dirList: DirectoryEmployee[]) => {
    const newRecords: EmployeeRecord[] = dirList.map((dir) => {
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
        issues: [],
      };
    });

    const merged = [...employees];
    newRecords.forEach((rec) => {
      const idx = merged.findIndex((e) => e.employeeId === rec.employeeId);
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
    const loadedLayout = await localDB.getLayoutSettings();
    const loadedDirectory = await localDB.getDirectoryEmployees();
    const loadedDocs = await localDB.getEmployeeDocuments();
    setSettings(loadedSettings);
    setEmployees(loadedEmployees);
    setHistory(loadedHistory);
    setLayoutSettings(loadedLayout);
    setDirectoryEmployees(loadedDirectory);
    setDocuments(loadedDocs);
    showToast('Database successfully restored.');
  };

  const invalidCount = employees.filter((e) => !e.isValid || e.issues.length > 0).length;

  if (isInitializing) {
    return (
      <div className={`h-screen w-screen flex flex-col items-center justify-center font-sans ${isDark ? 'bg-[#000000] text-white' : 'bg-[#FFFFFF] text-black'}`}>
        <div className="w-12 h-12 rounded-xl bg-[#CB1417] flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-lg shadow-[#CB1417]/30 mb-3">
          EDS
        </div>
        <p className="text-xs font-semibold tracking-wide">Loading Employee Database Studio...</p>
      </div>
    );
  }

  const layoutSampleEmployee = employees[0] || LAYOUT_PREVIEW_FALLBACK;

  return (
    <div className={`h-screen w-screen flex flex-col ${isDark ? 'bg-[#000000] text-white' : 'bg-[#FFFFFF] text-black'} overflow-hidden font-sans transition-colors duration-200`}>
      {/* Title Bar */}
      <TitleBar
        onDownloadTemplate={handleDownloadTemplate}
        totalEmployees={employees.length}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        companySettings={settings}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        googleSession={googleSession}
        workspaceLinks={workspaceLinks}
        onOpenGoogleSettings={openGoogleConnectionTab}
      />

      {/* Main Workspace: Sidebar + Content View */}
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab !== 'settings') setSettingsSectionTarget(undefined);
            setActiveTab(tab);
          }}
          totalEmployees={employees.length}
          invalidCount={invalidCount}
          historyCount={history.length}
          directoryCount={directoryEmployees.length}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${isDark ? 'bg-[#000000]' : 'bg-[#FAFAFA]'} transition-colors duration-200`}>
          <div className="max-w-7xl mx-auto pb-10 space-y-4">
            {/* Non-blocking Session Expiry Reconnect Prompt (preserves unsaved form edits & local drafts) */}
            {googleSession.expired && (
              <div
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                  isDark ? 'bg-[#2E0B0D] border-[#57151A] text-[#FCA5A5]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                }`}
              >
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-[#ED1F24] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Google OAuth Session Expired</span>
                    <span className="text-[11px] opacity-90">
                      Your unsaved form edits and temporary local drafts are intact. Reconnect your Google account to resume saving permanently to Google Sheets &amp; Drive.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openGoogleConnectionTab}
                  className="px-3.5 py-1.5 rounded-lg bg-[#CB1417] hover:bg-[#ED1F24] text-white font-bold whitespace-nowrap shrink-0 cursor-pointer flex items-center space-x-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Reconnect Google</span>
                </button>
              </div>
            )}

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
                payrollHistoryCountForEmployee={(empId) => history.filter((h) => h.employeeId === empId).length}
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
                onPreviewPayslip={(emp) => setPreviewState({ employee: emp, method: 'Bulk Payroll' })}
                onClearData={handleClearData}
                settings={settings}
              />
            )}

            {activeTab === 'manual_payslip' && (
              <ManualPayslipView
                settings={settings}
                layoutSettings={layoutSettings}
                directoryEmployees={directoryEmployees}
                onAddDirectoryEmployee={handleSaveDirectoryEmployee}
                onPreviewPayslip={(emp) => setPreviewState({ employee: emp, method: 'Manual Entry' })}
                onRecordGenerated={handleRecordGenerated}
                showToast={showToast}
              />
            )}

            {activeTab === 'generator' && (
              <GeneratorView
                employees={employees}
                settings={settings}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onPreviewEmployee={(emp) => setPreviewState({ employee: emp, method: 'Bulk Payroll' })}
                onRecordGenerated={handleRecordGenerated}
                history={history}
                layoutSettings={layoutSettings}
              />
            )}

            {activeTab === 'layout' && (
              <LayoutEditorView
                layoutSettings={layoutSettings}
                onSaveLayout={handleSaveLayoutSettings}
                settings={settings}
                sampleEmployee={layoutSampleEmployee}
                allEmployees={employees}
                onNavigateToEmployeeData={() => setActiveTab(employees.length > 0 ? 'records' : 'directory')}
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
                onNavigateToSettings={openGoogleConnectionTab}
              />
            )}

            {activeTab === 'history' && (
              <HistoryView
                history={history}
                onHistoryCleared={handleHistoryCleared}
                onPreviewEmployee={(emp) => setPreviewState({ employee: emp, method: 'Bulk Payroll' })}
                employees={employees}
                settings={settings}
                layoutSettings={layoutSettings}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                settings={settings}
                onSaveSettings={handleSaveSettings}
                onDatabaseRestored={handleDatabaseRestored}
                currentUser={workspaceUser}
                initialSection={settingsSectionTarget}
              />
            )}
          </div>
        </main>
      </div>

      {/* Global Payslip Preview Modal */}
      {previewState && (
        <PayslipPreviewModal
          employee={previewState.employee}
          settings={settings}
          month={selectedMonth}
          year={selectedYear}
          generationMethod={previewState.method}
          onClose={() => setPreviewState(null)}
          onSavedToHistory={handleRecordGenerated}
          layoutSettings={layoutSettings}
        />
      )}

      {/* Clear Data Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden p-6 space-y-5 ${
              isDark ? 'bg-[#0D0D0E] border-[#2A2A2E] text-white' : 'bg-white border-[#E4E4E7] text-black'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight">Clear Payroll Dataset?</h3>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  This clears only the active imported payroll batch. Your Employee Directory and Generation History remain intact.
                </p>
              </div>
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
                className="px-4 py-2 rounded-lg text-xs font-bold bg-[#CB1417] hover:bg-[#ED1F24] text-white shadow-md shadow-[#CB1417]/25 transition cursor-pointer disabled:opacity-50 flex items-center space-x-2"
              >
                {isClearingData && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isClearingData ? 'Clearing Dataset...' : 'Confirm & Clear Dataset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastNotification && (
        <div
          className={`fixed bottom-5 right-5 ${
            isDark ? 'bg-[#111113] border-[#2A2A2E] text-white shadow-2xl' : 'bg-white border-neutral-200 text-black shadow-xl'
          } border text-xs px-4 py-2.5 rounded-xl z-50 flex items-center space-x-2.5 animate-in slide-in-from-bottom-2`}
        >
          <span className="w-2 h-2 rounded-full bg-[#CB1417] shrink-0" />
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
