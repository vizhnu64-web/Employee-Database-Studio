import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  RotateCcw,
  CheckCircle2,
  Eye,
  Shield,
  User,
  DollarSign,
  FileText,
  CreditCard,
  Calendar,
  Sparkles
} from 'lucide-react';
import { CompanySettings, EmployeeRecord, PayslipLayoutSettings, DEFAULT_LAYOUT_SETTINGS, CustomFieldDefinition, PayslipCustomFieldLayout } from '../types/payroll';
import { useTheme } from '../context/ThemeContext';
import { localDB } from '../utils/dbStorage';

interface LayoutEditorViewProps {
  layoutSettings: PayslipLayoutSettings;
  onSaveLayout: (settings: PayslipLayoutSettings) => void;
  settings: CompanySettings;
  sampleEmployee: EmployeeRecord;
}

export const LayoutEditorView: React.FC<LayoutEditorViewProps> = ({
  layoutSettings,
  onSaveLayout,
  settings,
  sampleEmployee
}) => {
  const { isDark } = useTheme();
  const [formData, setFormData] = useState<PayslipLayoutSettings>({
    ...DEFAULT_LAYOUT_SETTINGS,
    ...(layoutSettings || {})
  });
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadCustomFields() {
      try {
        const list = await localDB.getCustomFields();
        setCustomFields(list);
      } catch (err) {
        console.warn('Error loading custom fields for layout editor:', err);
      }
    }
    loadCustomFields();
  }, []);

  const handleToggle = (field: keyof PayslipLayoutSettings) => {
    setFormData(prev => ({
      ...prev,
      [field]: typeof prev[field] === 'boolean' ? !prev[field] : prev[field]
    }));
  };

  const handleLabelChange = (field: keyof PayslipLayoutSettings, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelect = (field: keyof PayslipLayoutSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCustomFieldToggle = (fieldKey: string, currentLabel: string) => {
    setFormData(prev => {
      const layouts = [...(prev.customFieldLayouts || [])];
      const existingIdx = layouts.findIndex(l => l.key === fieldKey);
      if (existingIdx >= 0) {
        layouts[existingIdx] = {
          ...layouts[existingIdx],
          showInPdf: !layouts[existingIdx].showInPdf
        };
      } else {
        layouts.push({
          key: fieldKey,
          label: currentLabel,
          showInPdf: true
        });
      }
      return { ...prev, customFieldLayouts: layouts };
    });
  };

  const handleCustomFieldLabelChange = (fieldKey: string, newLabel: string) => {
    setFormData(prev => {
      const layouts = [...(prev.customFieldLayouts || [])];
      const existingIdx = layouts.findIndex(l => l.key === fieldKey);
      if (existingIdx >= 0) {
        layouts[existingIdx] = { ...layouts[existingIdx], label: newLabel };
      } else {
        layouts.push({ key: fieldKey, label: newLabel, showInPdf: true });
      }
      return { ...prev, customFieldLayouts: layouts };
    });
  };

  const handleSave = () => {
    onSaveLayout(formData);
    setToastMessage('Payslip layout configuration and custom labels saved successfully.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleReset = () => {
    setFormData({ ...DEFAULT_LAYOUT_SETTINGS });
    onSaveLayout({ ...DEFAULT_LAYOUT_SETTINGS });
    setToastMessage('Layout reset to professional default template.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper: check if custom field is enabled in layout
  const isCustomFieldActive = (key: string): boolean => {
    const item = formData.customFieldLayouts?.find(c => c.key === key);
    return item ? (item.showInPdf !== undefined ? item.showInPdf : (item.isVisible !== undefined ? item.isVisible : true)) : true;
  };

  const getCustomFieldLabel = (key: string, fallback: string): string => {
    const item = formData.customFieldLayouts?.find(c => c.key === key);
    return item ? item.label : fallback;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div
        className={`border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#CB1417] uppercase tracking-wider mb-1">
            <Sliders className="w-4 h-4 text-[#CB1417]" />
            <span>Document Layout & Custom Label Engine</span>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
            Payslip Layout Customizer
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Customize field visibility, re-label standard and custom fields independently, and ensure exact visual alignment across live preview and PDF.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleReset}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
              isDark
                ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]'
                : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 px-4 py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md shadow-[#CB1417]/25 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Layout</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className={`p-3.5 rounded-xl flex items-center space-x-3 text-xs border ${
          isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
        }`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Grid: Controls vs Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Customization Panel */}
        <div
          className={`border rounded-xl p-6 space-y-6 text-xs transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          {/* Section 1: Header & Branding */}
          <div className="space-y-3">
            <h3 className={`text-sm font-bold flex items-center space-x-2 border-b pb-2.5 ${isDark ? 'text-white border-[#222222]' : 'text-black border-[#E4E4E7]'}`}>
              <Shield className="w-4 h-4 text-[#CB1417]" />
              <span>Header & Branding Settings</span>
            </h3>

            <div className="grid grid-cols-1 gap-2.5">
              <label className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <span className="font-medium">Show Company Logo in Header</span>
                <input
                  type="checkbox"
                  checked={formData.showLogo}
                  onChange={() => handleToggle('showLogo')}
                  className="w-4 h-4 accent-[#CB1417] rounded cursor-pointer"
                />
              </label>

              <label className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <span className="font-medium">Show Tax ID / Registration Number</span>
                <input
                  type="checkbox"
                  checked={formData.showTaxId}
                  onChange={() => handleToggle('showTaxId')}
                  className="w-4 h-4 accent-[#CB1417] rounded cursor-pointer"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block font-semibold mb-1">Header Alignment</label>
                <select
                  value={formData.alignHeader}
                  onChange={(e) => handleSelect('alignHeader', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${
                    isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                  }`}
                >
                  <option value="left">Left Aligned</option>
                  <option value="center">Center Aligned</option>
                  <option value="right">Right Aligned</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Primary Accent Color</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => handleSelect('primaryColor', e.target.value)}
                    className="w-9 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono font-semibold">{formData.primaryColor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Employee Information & Identification Fields */}
          <div className="space-y-3 pt-4 border-t border-dashed">
            <h3 className={`text-sm font-bold flex items-center space-x-2 border-b pb-2.5 ${isDark ? 'text-white border-[#222222]' : 'text-black border-[#E4E4E7]'}`}>
              <User className="w-4 h-4 text-[#CB1417]" />
              <span>Employee Information & Identification Fields</span>
            </h3>

            <div className="space-y-2.5">
              {[
                { showKey: 'showEmployeeId' as keyof PayslipLayoutSettings, labelKey: 'labelEmployeeId' as keyof PayslipLayoutSettings, defaultLabel: 'Employee ID' },
                { showKey: 'showName' as keyof PayslipLayoutSettings, labelKey: 'labelName' as keyof PayslipLayoutSettings, defaultLabel: 'Employee Name' },
                { showKey: 'showDepartment' as keyof PayslipLayoutSettings, labelKey: 'labelDepartment' as keyof PayslipLayoutSettings, defaultLabel: 'Department' },
                { showKey: 'showDesignation' as keyof PayslipLayoutSettings, labelKey: 'labelDesignation' as keyof PayslipLayoutSettings, defaultLabel: 'Designation' },
                { showKey: 'showJoiningDate' as keyof PayslipLayoutSettings, labelKey: 'labelJoiningDate' as keyof PayslipLayoutSettings, defaultLabel: 'Joining Date' },
                { showKey: 'showCtc' as keyof PayslipLayoutSettings, labelKey: 'labelCtc' as keyof PayslipLayoutSettings, defaultLabel: 'Cost to Company (CTC)' },
                { showKey: 'showEmployerPf' as keyof PayslipLayoutSettings, labelKey: 'labelEmployerPf' as keyof PayslipLayoutSettings, defaultLabel: 'Employer PF' },
                { showKey: 'showEmployerEsi' as keyof PayslipLayoutSettings, labelKey: 'labelEmployerEsi' as keyof PayslipLayoutSettings, defaultLabel: 'Employer ESI' },
                { showKey: 'showPan' as keyof PayslipLayoutSettings, labelKey: 'labelPan' as keyof PayslipLayoutSettings, defaultLabel: 'PAN' },
                { showKey: 'showUan' as keyof PayslipLayoutSettings, labelKey: 'labelUan' as keyof PayslipLayoutSettings, defaultLabel: 'UAN' },
                { showKey: 'showEsiNumber' as keyof PayslipLayoutSettings, labelKey: 'labelEsiNumber' as keyof PayslipLayoutSettings, defaultLabel: 'ESI Number' },
                { showKey: 'showPfNumber' as keyof PayslipLayoutSettings, labelKey: 'labelPfNumber' as keyof PayslipLayoutSettings, defaultLabel: 'PF Number' },
                { showKey: 'showAadhaar' as keyof PayslipLayoutSettings, labelKey: 'labelAadhaar' as keyof PayslipLayoutSettings, defaultLabel: 'Aadhaar Number' },
              ].map(item => (
                <div key={String(item.showKey)} className={`flex items-center justify-between p-2 rounded-lg border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <div className="flex items-center space-x-2.5 flex-1 pr-3">
                    <input
                      type="checkbox"
                      checked={!!formData[item.showKey]}
                      onChange={() => handleToggle(item.showKey)}
                      className="w-4 h-4 accent-[#CB1417] rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={String(formData[item.labelKey] || item.defaultLabel)}
                      onChange={(e) => handleLabelChange(item.labelKey, e.target.value)}
                      className={`w-full px-2 py-1 rounded border text-xs outline-none ${
                        isDark ? 'bg-[#1C1C1F] border-[#2C2C30] text-white' : 'bg-white border-[#D4D4D8] text-black'
                      }`}
                      placeholder={item.defaultLabel}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">Toggle & Label</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Bank Details Fields */}
          <div className="space-y-3 pt-4 border-t border-dashed">
            <h3 className={`text-sm font-bold flex items-center space-x-2 border-b pb-2.5 ${isDark ? 'text-white border-[#222222]' : 'text-black border-[#E4E4E7]'}`}>
              <CreditCard className="w-4 h-4 text-[#CB1417]" />
              <span>Banking & Disbursement Fields</span>
            </h3>

            <div className="space-y-2.5">
              {[
                { showKey: 'showBankName' as keyof PayslipLayoutSettings, labelKey: 'labelBankName' as keyof PayslipLayoutSettings, defaultLabel: 'Bank Name' },
                { showKey: 'showBankAccount' as keyof PayslipLayoutSettings, labelKey: 'labelBankAccount' as keyof PayslipLayoutSettings, defaultLabel: 'Bank Account No' },
                { showKey: 'showIfscCode' as keyof PayslipLayoutSettings, labelKey: 'labelIfscCode' as keyof PayslipLayoutSettings, defaultLabel: 'IFSC Code' },
                { showKey: 'showBranchName' as keyof PayslipLayoutSettings, labelKey: 'labelBranchName' as keyof PayslipLayoutSettings, defaultLabel: 'Branch Name' },
                { showKey: 'showAccountHolderName' as keyof PayslipLayoutSettings, labelKey: 'labelAccountHolderName' as keyof PayslipLayoutSettings, defaultLabel: 'Account Holder Name' },
              ].map(item => (
                <div key={String(item.showKey)} className={`flex items-center justify-between p-2 rounded-lg border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <div className="flex items-center space-x-2.5 flex-1 pr-3">
                    <input
                      type="checkbox"
                      checked={!!formData[item.showKey]}
                      onChange={() => handleToggle(item.showKey)}
                      className="w-4 h-4 accent-[#CB1417] rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={String(formData[item.labelKey] || item.defaultLabel)}
                      onChange={(e) => handleLabelChange(item.labelKey, e.target.value)}
                      className={`w-full px-2 py-1 rounded border text-xs outline-none ${
                        isDark ? 'bg-[#1C1C1F] border-[#2C2C30] text-white' : 'bg-white border-[#D4D4D8] text-black'
                      }`}
                      placeholder={item.defaultLabel}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">Toggle & Label</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Attendance & Loss of Pay (LOP) */}
          <div className="space-y-3 pt-4 border-t border-dashed">
            <h3 className={`text-sm font-bold flex items-center space-x-2 border-b pb-2.5 ${isDark ? 'text-white border-[#222222]' : 'text-black border-[#E4E4E7]'}`}>
              <Calendar className="w-4 h-4 text-[#CB1417]" />
              <span>Attendance & Loss of Pay (LOP) Controls</span>
            </h3>

            <div className="space-y-2.5">
              {[
                { showKey: 'showTotalWorkingDays' as keyof PayslipLayoutSettings, labelKey: 'labelTotalWorkingDays' as keyof PayslipLayoutSettings, defaultLabel: 'Total Working Days' },
                { showKey: 'showPaidDays' as keyof PayslipLayoutSettings, labelKey: 'labelPaidDays' as keyof PayslipLayoutSettings, defaultLabel: 'Paid Days' },
                { showKey: 'showLopDays' as keyof PayslipLayoutSettings, labelKey: 'labelLopDays' as keyof PayslipLayoutSettings, defaultLabel: 'LOP Days' },
                { showKey: 'showUnpaidDays' as keyof PayslipLayoutSettings, labelKey: 'labelUnpaidDays' as keyof PayslipLayoutSettings, defaultLabel: 'Loss of Pay (LOP)' },
                { showKey: 'showLopAmount' as keyof PayslipLayoutSettings, labelKey: 'labelLopAmount' as keyof PayslipLayoutSettings, defaultLabel: 'LOP Deduction' },
              ].map(item => (
                <div key={String(item.showKey)} className={`flex items-center justify-between p-2 rounded-lg border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <div className="flex items-center space-x-2.5 flex-1 pr-3">
                    <input
                      type="checkbox"
                      checked={!!formData[item.showKey]}
                      onChange={() => handleToggle(item.showKey)}
                      className="w-4 h-4 accent-[#CB1417] rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={String(formData[item.labelKey] || item.defaultLabel)}
                      onChange={(e) => handleLabelChange(item.labelKey, e.target.value)}
                      className={`w-full px-2 py-1 rounded border text-xs outline-none ${
                        isDark ? 'bg-[#1C1C1F] border-[#2C2C30] text-white' : 'bg-white border-[#D4D4D8] text-black'
                      }`}
                      placeholder={item.defaultLabel}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">Toggle & Label</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Dynamic Custom Fields in Payslip */}
          {customFields.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-dashed">
              <h3 className={`text-sm font-bold flex items-center space-x-2 border-b pb-2.5 ${isDark ? 'text-white border-[#222222]' : 'text-black border-[#E4E4E7]'}`}>
                <Sparkles className="w-4 h-4 text-[#CB1417]" />
                <span>Custom Excel Fields (Include in Payslip)</span>
              </h3>

              <div className="space-y-2.5">
                {customFields.map(cf => {
                  const isActive = isCustomFieldActive(cf.key);
                  const label = getCustomFieldLabel(cf.key, cf.label);

                  return (
                    <div key={cf.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                      <div className="flex items-center space-x-2.5 flex-1 pr-3">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => handleCustomFieldToggle(cf.key, cf.label)}
                          className="w-4 h-4 accent-[#CB1417] rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={label}
                          onChange={(e) => handleCustomFieldLabelChange(cf.key, e.target.value)}
                          className={`w-full px-2 py-1 rounded border text-xs outline-none ${
                            isDark ? 'bg-[#1C1C1F] border-[#2C2C30] text-white' : 'bg-white border-[#D4D4D8] text-black'
                          }`}
                          placeholder={cf.label}
                        />
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono uppercase text-zinc-500">
                        {cf.dataType}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 6: Earnings & Deductions Customization */}
          <div className="space-y-3 pt-4 border-t border-dashed">
            <h3 className={`text-sm font-bold flex items-center space-x-2 border-b pb-2.5 ${isDark ? 'text-white border-[#222222]' : 'text-black border-[#E4E4E7]'}`}>
              <DollarSign className="w-4 h-4 text-[#CB1417]" />
              <span>Earnings & Deductions Section Titles & Rows</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Earnings Section Title</label>
                <input
                  type="text"
                  value={formData.labelEarnings}
                  onChange={(e) => handleLabelChange('labelEarnings', e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded border text-xs ${isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'}`}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Deductions Section Title</label>
                <input
                  type="text"
                  value={formData.labelDeductions}
                  onChange={(e) => handleLabelChange('labelDeductions', e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded border text-xs ${isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'}`}
                />
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              {[
                { showKey: 'showBasic' as keyof PayslipLayoutSettings, labelKey: 'labelBasic' as keyof PayslipLayoutSettings, defaultLabel: 'Basic Salary' },
                { showKey: 'showHra' as keyof PayslipLayoutSettings, labelKey: 'labelHra' as keyof PayslipLayoutSettings, defaultLabel: 'HRA' },
                { showKey: 'showSpecialAllowance' as keyof PayslipLayoutSettings, labelKey: 'labelSpecialAllowance' as keyof PayslipLayoutSettings, defaultLabel: 'Special Allowance' },
                { showKey: 'showOtherAllowances' as keyof PayslipLayoutSettings, labelKey: 'labelOtherAllowances' as keyof PayslipLayoutSettings, defaultLabel: 'Other Allowances' },
                { showKey: 'showPf' as keyof PayslipLayoutSettings, labelKey: 'labelPf' as keyof PayslipLayoutSettings, defaultLabel: 'Provident Fund (EPF/PF)' },
                { showKey: 'showEsi' as keyof PayslipLayoutSettings, labelKey: 'labelEsi' as keyof PayslipLayoutSettings, defaultLabel: 'ESI' },
                { showKey: 'showProfessionalTax' as keyof PayslipLayoutSettings, labelKey: 'labelProfessionalTax' as keyof PayslipLayoutSettings, defaultLabel: 'Professional Tax' },
                { showKey: 'showTds' as keyof PayslipLayoutSettings, labelKey: 'labelTds' as keyof PayslipLayoutSettings, defaultLabel: 'TDS / Income Tax' },
                { showKey: 'showLoan' as keyof PayslipLayoutSettings, labelKey: 'labelLoan' as keyof PayslipLayoutSettings, defaultLabel: 'Staff Loan / Advance' },
                { showKey: 'showLateDeduction' as keyof PayslipLayoutSettings, labelKey: 'labelLateDeduction' as keyof PayslipLayoutSettings, defaultLabel: 'Late Deduction' },
                { showKey: 'showLopAmount' as keyof PayslipLayoutSettings, labelKey: 'labelLopAmount' as keyof PayslipLayoutSettings, defaultLabel: 'LOP Deduction' },
                { showKey: 'showOtherDeductions' as keyof PayslipLayoutSettings, labelKey: 'labelOtherDeductions' as keyof PayslipLayoutSettings, defaultLabel: 'Other Deductions' },
              ].map(item => (
                <div key={String(item.showKey)} className={`flex items-center justify-between p-2 rounded-lg border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <div className="flex items-center space-x-2.5 flex-1 pr-3">
                    <input
                      type="checkbox"
                      checked={!!formData[item.showKey]}
                      onChange={() => handleToggle(item.showKey)}
                      className="w-4 h-4 accent-[#CB1417] rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={String(formData[item.labelKey] || item.defaultLabel)}
                      onChange={(e) => handleLabelChange(item.labelKey, e.target.value)}
                      className={`w-full px-2 py-1 rounded border text-xs outline-none ${
                        isDark ? 'bg-[#1C1C1F] border-[#2C2C30] text-white' : 'bg-white border-[#D4D4D8] text-black'
                      }`}
                      placeholder={item.defaultLabel}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 7: Totals & Footer */}
          <div className="space-y-3 pt-4 border-t border-dashed">
            <h3 className={`text-sm font-bold flex items-center space-x-2 border-b pb-2.5 ${isDark ? 'text-white border-[#222222]' : 'text-black border-[#E4E4E7]'}`}>
              <FileText className="w-4 h-4 text-[#CB1417]" />
              <span>Totals, Signatures & Footer Note</span>
            </h3>

            <div>
              <label className="block font-semibold mb-1">Net Salary Highlight Label</label>
              <input
                type="text"
                value={formData.labelNetSalary}
                onChange={(e) => handleLabelChange('labelNetSalary', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <label className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <span className="font-medium">Show Signatures</span>
                <input
                  type="checkbox"
                  checked={formData.showSignatures}
                  onChange={() => handleToggle('showSignatures')}
                  className="w-4 h-4 accent-[#CB1417] rounded cursor-pointer"
                />
              </label>

              <label className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <span className="font-medium">Show Footer Note</span>
                <input
                  type="checkbox"
                  checked={formData.showFooterNote}
                  onChange={() => handleToggle('showFooterNote')}
                  className="w-4 h-4 accent-[#CB1417] rounded cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right: Real-Time Live Preview Card */}
        <div
          className={`border rounded-xl p-6 flex flex-col transition ${
            isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b mb-4">
            <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <Eye className="w-4 h-4 text-[#CB1417]" />
              <span>Real-Time Layout Preview</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              A4 Portrait Live Model
            </span>
          </div>

          {/* Mini A4 Preview Card */}
          <div className="flex-1 bg-white text-black rounded-lg p-5 shadow-inner border border-zinc-300 font-sans text-[11px] space-y-3 relative overflow-hidden select-none">
            {/* Header */}
            <div className={`flex items-center justify-between border-b pb-2 ${formData.alignHeader === 'center' ? 'text-center flex-col' : formData.alignHeader === 'right' ? 'text-right flex-col items-end' : ''}`}>
              <div className="flex items-center space-x-2">
                {formData.showLogo && (
                  <div className="w-8 h-8 rounded bg-zinc-200 flex items-center justify-center font-bold text-zinc-700 text-xs">
                    TBT
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-xs">{settings.companyName}</h4>
                  <p className="text-[9px] text-zinc-500">{settings.cityStateZip}</p>
                </div>
              </div>
              {formData.showTaxId && (
                <div className="text-[9px] text-zinc-500">Tax ID: {settings.taxRegistrationNumber}</div>
              )}
            </div>

            {/* Banner */}
            <div className="py-1 px-2 text-center text-white font-bold text-[10px] rounded" style={{ backgroundColor: formData.primaryColor }}>
              PAYSLIP FOR THE PERIOD: OCTOBER 2026
            </div>

            {/* Employee Details Grid */}
            <div className="bg-zinc-50 p-2.5 rounded border border-zinc-200 grid grid-cols-2 gap-2 text-[10px]">
              {formData.showEmployeeId && <div><strong>{formData.labelEmployeeId}:</strong> {sampleEmployee.employeeId}</div>}
              {formData.showName && <div><strong>{formData.labelName}:</strong> {sampleEmployee.name}</div>}
              {formData.showDepartment && <div><strong>{formData.labelDepartment}:</strong> {sampleEmployee.department}</div>}
              {formData.showDesignation && <div><strong>{formData.labelDesignation}:</strong> {sampleEmployee.designation}</div>}
              {formData.showJoiningDate && <div><strong>{formData.labelJoiningDate}:</strong> {sampleEmployee.joiningDate}</div>}
              {formData.showPaidDays && <div><strong>{formData.labelPaidDays}:</strong> {sampleEmployee.paidDays ?? 30} Days</div>}
              {formData.showLopDays && (sampleEmployee.lopDays !== undefined || sampleEmployee.unpaidDays !== undefined) && (
                <div><strong>{formData.labelLopDays}:</strong> {sampleEmployee.lopDays ?? sampleEmployee.unpaidDays ?? 0} Days</div>
              )}
              {formData.showBankName && sampleEmployee.bankName && (
                <div><strong>{formData.labelBankName}:</strong> {sampleEmployee.bankName}</div>
              )}
              {formData.showBankAccount && (
                <div><strong>{formData.labelBankAccount}:</strong> {sampleEmployee.bankAccount || '••••••••1234'}</div>
              )}
              {formData.showIfscCode && (
                <div><strong>{formData.labelIfscCode}:</strong> {sampleEmployee.ifscCode || 'HDFC0000240'}</div>
              )}
              {formData.showBranchName && sampleEmployee.branchName && (
                <div><strong>{formData.labelBranchName}:</strong> {sampleEmployee.branchName}</div>
              )}
              {formData.showPan && <div><strong>{formData.labelPan}:</strong> {sampleEmployee.pan || 'ABCDE1234F'}</div>}
              {formData.showUan && <div><strong>{formData.labelUan}:</strong> {sampleEmployee.uan || '100928374651'}</div>}
              {formData.showEsiNumber && <div><strong>{formData.labelEsiNumber}:</strong> {sampleEmployee.esiNumber || '3100098273618'}</div>}

              {/* Custom fields in preview */}
              {sampleEmployee.customFields && Object.entries(sampleEmployee.customFields).map(([k, v]) => {
                if (!isCustomFieldActive(k)) return null;
                const label = getCustomFieldLabel(k, k.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
                return (
                  <div key={k}>
                    <strong>{label}:</strong> {String(v)}
                  </div>
                );
              })}
            </div>

            {/* Earnings & Deductions Table Preview */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="border rounded p-1.5 bg-zinc-50">
                <div className="font-bold border-b pb-1 text-zinc-700">{formData.labelEarnings}</div>
                {formData.showBasic && <div className="flex justify-between py-0.5"><span>{formData.labelBasic}</span><span>$ {sampleEmployee.basic.toLocaleString()}</span></div>}
                {formData.showHra && <div className="flex justify-between py-0.5"><span>{formData.labelHra}</span><span>$ {sampleEmployee.hra.toLocaleString()}</span></div>}
                {formData.showSpecialAllowance && (sampleEmployee.specialAllowance || 0) > 0 && (
                  <div className="flex justify-between py-0.5"><span>{formData.labelSpecialAllowance}</span><span>$ {(sampleEmployee.specialAllowance || 0).toLocaleString()}</span></div>
                )}
                {formData.showOtherAllowances && (sampleEmployee.otherAllowances || 0) > 0 && (
                  <div className="flex justify-between py-0.5"><span>{formData.labelOtherAllowances}</span><span>$ {(sampleEmployee.otherAllowances || 0).toLocaleString()}</span></div>
                )}
              </div>
              <div className="border rounded p-1.5 bg-zinc-50">
                <div className="font-bold border-b pb-1 text-zinc-700">{formData.labelDeductions}</div>
                {formData.showPf && <div className="flex justify-between py-0.5"><span>{formData.labelPf}</span><span>$ {sampleEmployee.pf.toLocaleString()}</span></div>}
                {formData.showEsi && (sampleEmployee.esi || 0) > 0 && <div className="flex justify-between py-0.5"><span>{formData.labelEsi}</span><span>$ {(sampleEmployee.esi || 0).toLocaleString()}</span></div>}
                {formData.showProfessionalTax && <div className="flex justify-between py-0.5"><span>{formData.labelProfessionalTax}</span><span>$ {sampleEmployee.professionalTax.toLocaleString()}</span></div>}
                {formData.showTds && <div className="flex justify-between py-0.5"><span>{formData.labelTds}</span><span>$ {sampleEmployee.tds.toLocaleString()}</span></div>}
                {formData.showLoan !== false && (sampleEmployee.loan || 0) > 0 && (
                  <div className="flex justify-between py-0.5"><span>{formData.labelLoan || 'Staff Loan / Advance'}</span><span>$ {(sampleEmployee.loan || 0).toLocaleString()}</span></div>
                )}
                {formData.showLateDeduction !== false && (sampleEmployee.lateDeduction || 0) > 0 && (
                  <div className="flex justify-between py-0.5"><span>{formData.labelLateDeduction || 'Late Deduction'}</span><span>$ {(sampleEmployee.lateDeduction || 0).toLocaleString()}</span></div>
                )}
                {formData.showLopAmount && (sampleEmployee.lopAmount || 0) > 0 && (
                  <div className="flex justify-between py-0.5 text-red-600 font-semibold"><span>{formData.labelLopAmount}</span><span>$ {(sampleEmployee.lopAmount || 0).toLocaleString()}</span></div>
                )}
                {formData.showOtherDeductions !== false && (
                  <div className="flex justify-between py-0.5"><span>{formData.labelOtherDeductions || 'Other Deductions'}</span><span>$ {(sampleEmployee.otherDeductions || 0).toLocaleString()}</span></div>
                )}
              </div>
            </div>

            {/* Net Salary Payable */}
            <div className="p-2.5 rounded border flex justify-between items-center bg-zinc-50" style={{ borderColor: formData.primaryColor }}>
              <span className="font-bold text-[10px]">{formData.labelNetSalary}:</span>
              <span className="font-bold text-xs" style={{ color: formData.primaryColor }}>
                $ {sampleEmployee.calculatedNet.toLocaleString()}
              </span>
            </div>

            {/* Signatures */}
            {formData.showSignatures && (
              <div className="pt-4 flex justify-between text-[9px] text-zinc-500 border-t border-dashed">
                <div>------------------------<br/>Employee Signature</div>
                <div>------------------------<br/>Authorized Signatory</div>
              </div>
            )}

            {/* Footer */}
            {formData.showFooterNote && (
              <div className="text-[8px] text-center text-zinc-400 pt-1">
                Computer-generated secure payslip. No signature required.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
