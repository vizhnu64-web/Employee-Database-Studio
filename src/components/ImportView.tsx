import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Download,
  Layers,
  ArrowRight,
  ArrowLeft,
  Sliders,
  FileCheck,
  Info,
  Calendar,
  Save,
  FolderOpen,
  Filter,
  Search,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  HelpCircle,
  ShieldAlert,
  Building,
  CreditCard,
  User,
  Clock,
  DollarSign
} from 'lucide-react';
import {
  ColumnMapping,
  EmployeeRecord,
  ColumnImportControl,
  CustomFieldDefinition,
  SavedImportConfig,
  ImportHistoryRecord
} from '../types/payroll';
import { DirectoryEmployee } from '../types/employeeDirectory';
import {
  ParsedWorkbook,
  AdvancedMapOptions,
  parseExcelFile,
  parseSpecificSheet,
  mapRowsToEmployeeRecords,
  createSampleWorkbookBuffer
} from '../utils/excelParser';
import {
  detectAllColumns,
  autoDetectColumnMapping,
  STANDARD_FIELD_LABELS
} from '../utils/columnDetector';
import { localDB } from '../utils/dbStorage';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../utils/apiClient';

interface ImportViewProps {
  onDataLoaded: (records: EmployeeRecord[], fileName: string) => void;
  onLoadDemoData: () => void;
  onDownloadTemplate: () => void;
  currentEmployeeCount: number;
  selectedMonth: string;
  selectedYear: number;
}

export type ImportStep = 'upload' | 'field_control' | 'custom_fields' | 'precedence' | 'preview' | 'summary';

export const ImportView: React.FC<ImportViewProps> = ({
  onDataLoaded,
  onLoadDemoData,
  onDownloadTemplate,
  currentEmployeeCount,
  selectedMonth,
  selectedYear
}) => {
  const { isDark } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stepper State
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');

  // File & Raw Data State
  const [fileName, setFileName] = useState<string>('');
  const [rawWorkbookData, setRawWorkbookData] = useState<ArrayBuffer | Uint8Array | null>(null);
  const [parsedWb, setParsedWb] = useState<ParsedWorkbook | null>(null);
  const [selectedHeaderRow, setSelectedHeaderRow] = useState<number>(0);

  // Column Detection & Mapping State
  const [columnControls, setColumnControls] = useState<ColumnImportControl[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    employeeId: '',
    name: '',
    email: '',
    department: '',
    designation: '',
    joiningDate: '',
    paidDays: '',
    unpaidDays: '',
    bankAccount: '',
    pan: '',
    uan: '',
    esiNumber: '',
    bankName: '',
    ifscCode: '',
    branchName: '',
    accountHolderName: '',
    lopDays: '',
    lopAmount: '',
    totalWorkingDays: '',
    basic: '',
    hra: '',
    specialAllowance: '',
    otherAllowances: '',
    providedGross: '',
    pf: '',
    esi: '',
    professionalTax: '',
    tds: '',
    otherDeductions: '',
    providedDeductions: '',
    providedNet: '',
    payrollMonth: '',
    payrollYear: ''
  });

  // Additional / Custom Fields State
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [existingStoredCustomFields, setExistingStoredCustomFields] = useState<CustomFieldDefinition[]>([]);

  // Precedence & Rules State
  const [duplicateStrategy, setDuplicateStrategy] = useState<'update' | 'skip'>('update');
  const [overwriteEmptyCells, setOverwriteEmptyCells] = useState<boolean>(false);
  const [lopSourcePrecedence, setLopSourcePrecedence] = useState<'excel' | 'attendance' | 'manual'>('excel');
  const [ambiguousLopChoice, setAmbiguousLopChoice] = useState<'days' | 'amount' | 'ignore'>('days');

  // Preview State
  const [previewRecords, setPreviewRecords] = useState<EmployeeRecord[]>([]);
  const [excludedRowIndices, setExcludedRowIndices] = useState<Set<number>>(new Set());
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; field: string } | null>(null);

  // Field Control Filters
  const [controlSearch, setControlSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedColumnNames, setSelectedColumnNames] = useState<Set<string>>(new Set());

  // Saved Configurations State
  const [savedConfigs, setSavedConfigs] = useState<SavedImportConfig[]>([]);
  const [showSaveConfigModal, setShowSaveConfigModal] = useState(false);
  const [showLoadConfigModal, setShowLoadConfigModal] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');
  const [newConfigDesc, setNewConfigDesc] = useState('');

  // UI Processing & Error State
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Summary State after commit
  const [importSummaryResult, setImportSummaryResult] = useState<{
    totalProcessed: number;
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
    ignoredColumns: string[];
    customFieldsSaved: number;
  } | null>(null);

  // Load existing custom field definitions and saved configurations on mount
  useEffect(() => {
    async function loadStoredMeta() {
      try {
        const storedDefs = await localDB.getCustomFields();
        setExistingStoredCustomFields(storedDefs || []);
        const configs = await localDB.getSavedImportConfigs();
        setSavedConfigs(configs || []);
      } catch (err) {
        console.warn('Could not load custom fields or configs:', err);
      }
    }
    loadStoredMeta();
  }, []);

  // Process File Buffer
  const processFileBuffer = async (buffer: ArrayBuffer | Uint8Array, name: string, headerRowIndex: number = 0) => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      setRawWorkbookData(buffer);
      setFileName(name);
      setSelectedHeaderRow(headerRowIndex);

      // Upload file to import-files bucket via backend storage API
      try {
        const fileObj = new File([new Uint8Array(buffer)], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const token = apiClient.getToken();
        const formData = new FormData();
        formData.append('file', fileObj);
        formData.append('year', String(new Date().getFullYear()));
        formData.append('month', new Date().toLocaleString('default', { month: 'long' }));

        await fetch('/api/storage/upload/import-files', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData
        });
      } catch (uploadErr) {
        console.warn('[Storage] Import file cloud upload skipped or offline:', uploadErr);
      }

      const parsed = parseExcelFile(buffer, name, headerRowIndex);
      setParsedWb(parsed);

      // Detect all columns and generate controls
      const detected = detectAllColumns(parsed.headers, parsed.rows);
      setColumnControls(detected.controls);
      setMapping(detected.mapping);

      // Pre-populate custom field definitions from detected extra columns
      const extraDefs: CustomFieldDefinition[] = [];
      detected.controls.forEach(ctrl => {
        if (!ctrl.isStandard) {
          const existing = existingStoredCustomFields.find(f => f.key === ctrl.suggestedField || (f.name && f.name.toLowerCase() === ctrl.excelColumn.toLowerCase()));
          if (existing) {
            extraDefs.push(existing);
          } else {
            extraDefs.push({
              id: `cf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: ctrl.excelColumn,
              key: ctrl.suggestedField || ctrl.excelColumn.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
              label: ctrl.excelColumn,
              dataType: ctrl.dataType || 'text',
              destination: ctrl.destination || 'both',
              isVisible: true,
              availableInPayslip: true,
              description: `Imported column from ${name}`,
              createdAt: new Date().toISOString()
            });
          }
        }
      });
      setCustomFieldDefs(extraDefs);

      // Select all fetchable columns by default
      const defaultSelected = new Set<string>();
      detected.controls.forEach(c => {
        if (c.fetch) defaultSelected.add(c.excelColumn);
      });
      setSelectedColumnNames(defaultSelected);

      setCurrentStep('field_control');
    } catch (err: any) {
      console.error('File parse error:', err);
      setErrorMessage(`Failed to parse file "${name}": ${err.message || 'Unknown format error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    await processFileBuffer(buffer, file.name, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (currentEmployeeCount > 0 && !showReplaceConfirm) {
        setShowReplaceConfirm(true);
        return;
      }
      const buffer = await file.arrayBuffer();
      await processFileBuffer(buffer, file.name, 0);
    }
  };

  const handleTriggerBrowse = () => {
    if (currentEmployeeCount > 0 && !showReplaceConfirm) {
      setShowReplaceConfirm(true);
      return;
    }
    setShowReplaceConfirm(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleSheetChange = (sheetName: string) => {
    if (!rawWorkbookData) return;
    try {
      const parsed = parseSpecificSheet(rawWorkbookData, sheetName, fileName, selectedHeaderRow);
      setParsedWb(parsed);

      const detected = detectAllColumns(parsed.headers, parsed.rows);
      setColumnControls(detected.controls);
      setMapping(detected.mapping);
    } catch (err: any) {
      setErrorMessage(`Failed to switch sheet "${sheetName}": ${err.message}`);
    }
  };

  const handleHeaderRowChange = (rowIndex: number) => {
    if (!rawWorkbookData) return;
    processFileBuffer(rawWorkbookData, fileName, rowIndex);
  };

  const handleLoadSampleIntoWizard = async () => {
    try {
      setIsProcessing(true);
      const buf = createSampleWorkbookBuffer();
      await processFileBuffer(buf, 'Sample_Payroll_October_2026.xlsx', 0);
    } catch (err: any) {
      setErrorMessage(`Failed to load sample into wizard: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle Fetch for a specific column
  const toggleColumnFetch = (excelCol: string) => {
    setColumnControls(prev =>
      prev.map(c => (c.excelColumn === excelCol ? { ...c, fetch: !c.fetch } : c))
    );
  };

  // Change mapping destination for a column
  const updateColumnMapping = (excelCol: string, targetField: string) => {
    setColumnControls(prev =>
      prev.map(c => {
        if (c.excelColumn !== excelCol) return c;
        const isStandard = Boolean(STANDARD_FIELD_LABELS[targetField]);
        return {
          ...c,
          suggestedField: targetField,
          isStandard,
          fetch: targetField !== '' && targetField !== 'ignore'
        };
      })
    );

    // Sync to mapping state
    setMapping(prev => {
      const updated = { ...prev };
      // Remove old key pointing to this excel column
      Object.keys(updated).forEach(k => {
        if ((updated as any)[k] === excelCol) {
          (updated as any)[k] = '';
        }
      });
      if (targetField && targetField !== 'ignore' && STANDARD_FIELD_LABELS[targetField]) {
        (updated as any)[targetField] = excelCol;
      }
      return updated;
    });
  };

  // Bulk Field Control Actions
  const handleSelectAll = () => {
    setColumnControls(prev => prev.map(c => ({ ...c, fetch: true })));
  };

  const handleDeselectAll = () => {
    setColumnControls(prev => prev.map(c => ({ ...c, fetch: false })));
  };

  const handleSelectRecommended = () => {
    setColumnControls(prev =>
      prev.map(c => ({
        ...c,
        fetch: c.isStandard && c.suggestedField !== '' && c.suggestedField !== 'ignore'
      }))
    );
  };

  const handleFetchSelected = () => {
    setColumnControls(prev =>
      prev.map(c => (selectedColumnNames.has(c.excelColumn) ? { ...c, fetch: true } : c))
    );
  };

  const handleIgnoreSelected = () => {
    setColumnControls(prev =>
      prev.map(c => (selectedColumnNames.has(c.excelColumn) ? { ...c, fetch: false } : c))
    );
  };

  // Save Configuration
  const handleSaveConfiguration = async () => {
    if (!newConfigName.trim()) return;
    const config: SavedImportConfig = {
      id: `cfg_${Date.now()}`,
      name: newConfigName.trim(),
      description: newConfigDesc.trim(),
      mapping,
      columnControls,
      customFieldDefinitions: customFieldDefs,
      duplicateStrategy,
      overwriteEmptyCells,
      lopSourcePrecedence,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await localDB.saveImportConfig(config);
      setSavedConfigs(prev => [config, ...prev]);
      setShowSaveConfigModal(false);
      setNewConfigName('');
      setNewConfigDesc('');
    } catch (err) {
      console.error('Error saving config:', err);
    }
  };

  // Load Configuration
  const handleApplySavedConfig = (cfg: SavedImportConfig) => {
    if (cfg.mapping) setMapping(cfg.mapping);
    if (cfg.duplicateStrategy) setDuplicateStrategy(cfg.duplicateStrategy);
    if (cfg.overwriteEmptyCells !== undefined) setOverwriteEmptyCells(cfg.overwriteEmptyCells);
    if (cfg.lopSourcePrecedence) setLopSourcePrecedence(cfg.lopSourcePrecedence);

    if (cfg.customFieldDefinitions) {
      setCustomFieldDefs(cfg.customFieldDefinitions);
    }

    if (cfg.columnControls && parsedWb) {
      const savedControls = cfg.columnControls;
      // Re-align with current file headers
      const matchedControls = parsedWb.headers.map(h => {
        const saved = savedControls.find(c => c.excelColumn.toLowerCase() === h.toLowerCase());
        if (saved) {
          return { ...saved, excelColumn: h, excelHeader: h };
        }
        const existing = columnControls.find(c => c.excelColumn === h);
        return existing || {
          excelColumn: h,
          excelHeader: h,
          suggestedField: '',
          mappedField: '',
          fetch: false,
          shouldFetch: false,
          isStandard: false,
          destination: 'payroll' as const,
          dataType: 'text' as const,
        };
      });
      setColumnControls(matchedControls);
    }

    setShowLoadConfigModal(false);
  };

  // Custom Field Manager handlers
  const updateCustomFieldDef = (key: string, updates: Partial<CustomFieldDefinition>) => {
    setCustomFieldDefs(prev =>
      prev.map(f => (f.key === key ? { ...f, ...updates } : f))
    );
  };

  // Generate Preview Records
  const generatePreview = () => {
    if (!parsedWb) return;

    // Check minimum required
    const effectiveEmployeeIdCol = mapping.employeeId || columnControls.find(c => c.suggestedField === 'employeeId' && c.fetch)?.excelColumn;
    const effectiveNameCol = mapping.name || columnControls.find(c => c.suggestedField === 'name' && c.fetch)?.excelColumn;

    if (!effectiveEmployeeIdCol && !effectiveNameCol) {
      setErrorMessage('Please map and enable at least "Employee ID" or "Employee Name" to generate preview.');
      return;
    }

    setErrorMessage(null);

    const advancedOpts: AdvancedMapOptions = {
      columnControls,
      customFieldDefinitions: customFieldDefs,
      duplicateStrategy,
      overwriteEmptyCells,
      lopSourcePrecedence,
      ambiguousLopInterpretation: ambiguousLopChoice
    };

    try {
      const records = mapRowsToEmployeeRecords(
        parsedWb.rows,
        mapping,
        selectedMonth,
        selectedYear,
        advancedOpts
      );
      setPreviewRecords(records);
      setExcludedRowIndices(new Set());
      setCurrentStep('preview');
    } catch (err: any) {
      setErrorMessage(`Error building preview: ${err.message}`);
    }
  };

  // Commit Import
  const handleCommitImport = async () => {
    if (!previewRecords.length) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Filter out excluded rows
      const recordsToCommit = previewRecords.filter((_, idx) => !excludedRowIndices.has(idx));

      if (recordsToCommit.length === 0) {
        setErrorMessage('All records were excluded. Nothing to import.');
        setIsProcessing(false);
        return;
      }

      // 1. Save all active Custom Field Definitions to database
      const activeCustomFieldsToSave = customFieldDefs.filter(f =>
        columnControls.some(c => c.suggestedField === f.key && c.fetch)
      );
      for (const def of activeCustomFieldsToSave) {
        await localDB.saveCustomField(def);
      }

      // 2. Sync to Master Employee Directory with bank, ESI, and custom fields preserved
      const existingDirectory = await localDB.getDirectoryEmployees();
      const now = new Date().toISOString();
      let updatedDirCount = 0;
      let newDirCount = 0;

      for (const rec of recordsToCommit) {
        const existingIdx = existingDirectory.findIndex(
          d => d.employeeId.toUpperCase() === rec.employeeId.toUpperCase()
        );

        const cleanBank = rec.bankAccount ? String(rec.bankAccount).trim() : undefined;
        const cleanEsi = rec.esiNumber ? String(rec.esiNumber).trim() : undefined;

        if (existingIdx >= 0) {
          // Update existing directory entry
          const prevDir = existingDirectory[existingIdx];
          const mergedCustom = { ...(prevDir.customFields || {}), ...(rec.customFields || {}) };

          const updatedEntry: DirectoryEmployee = {
            ...prevDir,
            legalName: rec.name || prevDir.legalName,
            department: rec.department || prevDir.department,
            designation: rec.designation || prevDir.designation,
            joiningDate: rec.joiningDate || prevDir.joiningDate,
            workEmail: rec.email || prevDir.workEmail,
            panNumber: rec.pan || prevDir.panNumber,
            uanNumber: rec.uan || prevDir.uanNumber,
            esiNumber: cleanEsi || prevDir.esiNumber,
            esicNumber: cleanEsi || prevDir.esicNumber,
            accountNumber: cleanBank || prevDir.accountNumber,
            bankName: rec.bankName || prevDir.bankName,
            ifscCode: rec.ifscCode || prevDir.ifscCode,
            branchName: rec.branchName || prevDir.branchName,
            accountHolderName: rec.accountHolderName || prevDir.accountHolderName,
            standardCtc: rec.ctc !== undefined ? rec.ctc : prevDir.standardCtc,
            standardEmployerEsi: rec.employerEsi !== undefined ? rec.employerEsi : prevDir.standardEmployerEsi,
            standardBasic: rec.basic || prevDir.standardBasic,
            standardHra: rec.hra || prevDir.standardHra,
            standardAllowances: rec.otherAllowances || prevDir.standardAllowances,
            customFields: mergedCustom,
            updatedAt: now
          };
          await localDB.saveDirectoryEmployee(updatedEntry);
          updatedDirCount++;
        } else {
          // Create new directory entry
          const newEntry: DirectoryEmployee = {
            id: `dir_${rec.employeeId}_${Date.now()}`,
            employeeId: rec.employeeId,
            createdAt: now,
            updatedAt: now,
            legalName: rec.name,
            workEmail: rec.email || `${rec.employeeId.toLowerCase()}@company.com`,
            primaryPhone: '9999999999',
            currentAddress: 'Corporate Headquarters',
            permanentAddress: 'Corporate Headquarters',
            emergencyContactName: 'HR Admin',
            emergencyContactRelationship: 'HR',
            emergencyContactPhone: '9999999999',
            joiningDate: rec.joiningDate || now.split('T')[0],
            employmentType: 'Full-Time',
            employmentStatus: 'Active',
            department: rec.department || 'General',
            designation: rec.designation || 'Staff',
            workLocation: 'Corporate HQ',
            probationStatus: 'Confirmed',
            panNumber: rec.pan,
            uanNumber: rec.uan,
            esiNumber: cleanEsi,
            esicNumber: cleanEsi,
            accountNumber: cleanBank,
            bankName: rec.bankName,
            ifscCode: rec.ifscCode,
            branchName: rec.branchName,
            accountHolderName: rec.accountHolderName,
            standardCtc: rec.ctc,
            standardEmployerEsi: rec.employerEsi,
            standardBasic: rec.basic,
            standardHra: rec.hra,
            standardAllowances: rec.otherAllowances,
            customFields: rec.customFields || {},
            qualifications: []
          };
          await localDB.saveDirectoryEmployee(newEntry);
          newDirCount++;
        }
      }

      // 3. Record Import History Record
      const ignoredCols = columnControls.filter(c => !c.fetch).map(c => c.excelColumn);
      const historyItem: ImportHistoryRecord = {
        id: `imp_${Date.now()}`,
        fileName,
        timestamp: now,
        totalRows: parsedWb ? parsedWb.totalRawRows : recordsToCommit.length,
        importedCount: newDirCount,
        updatedCount: updatedDirCount,
        skippedCount: excludedRowIndices.size,
        ignoredColumns: ignoredCols,
        customFieldsImported: activeCustomFieldsToSave.map(f => f.key),
        summaryNotes: `Imported ${recordsToCommit.length} records. (${newDirCount} new, ${updatedDirCount} updated). ${ignoredCols.length} columns ignored.`
      };
      await localDB.saveImportHistoryRecord(historyItem);

      // 4. Set summary state and call parent onDataLoaded
      setImportSummaryResult({
        totalProcessed: parsedWb ? parsedWb.totalRawRows : recordsToCommit.length,
        importedCount: newDirCount,
        updatedCount: updatedDirCount,
        skippedCount: excludedRowIndices.size,
        ignoredColumns: ignoredCols,
        customFieldsSaved: activeCustomFieldsToSave.length
      });

      setCurrentStep('summary');

      // Update parent active payroll workspace
      onDataLoaded(recordsToCommit, fileName);
    } catch (err: any) {
      console.error('Import commit error:', err);
      setErrorMessage(`Commit failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered column controls for Field Control tab
  const filteredColumnControls = useMemo(() => {
    return columnControls.filter(ctrl => {
      const matchesSearch =
        ctrl.excelColumn.toLowerCase().includes(controlSearch.toLowerCase()) ||
        (ctrl.suggestedField && ctrl.suggestedField.toLowerCase().includes(controlSearch.toLowerCase())) ||
        (ctrl.sampleValue !== undefined && String(ctrl.sampleValue).toLowerCase().includes(controlSearch.toLowerCase()));

      if (!matchesSearch) return false;

      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'master') {
        return ['employeeId', 'name', 'email', 'department', 'designation', 'joiningDate', 'pan', 'uan', 'esiNumber'].includes(ctrl.suggestedField);
      }
      if (categoryFilter === 'bank') {
        return ['bankAccount', 'bankName', 'ifscCode', 'branchName', 'accountHolderName'].includes(ctrl.suggestedField);
      }
      if (categoryFilter === 'salary') {
        return ['ctc', 'employerPf', 'employerEsi', 'basic', 'hra', 'specialAllowance', 'otherAllowances', 'providedGross', 'pf', 'esi', 'professionalTax', 'tds', 'loan', 'lateDeduction', 'otherDeductions', 'providedDeductions', 'providedNet'].includes(ctrl.suggestedField);
      }
      if (categoryFilter === 'attendance') {
        return ['paidDays', 'unpaidDays', 'totalWorkingDays', 'lopDays', 'lopAmount'].includes(ctrl.suggestedField);
      }
      if (categoryFilter === 'custom') {
        return !ctrl.isStandard;
      }
      return true;
    });
  }, [columnControls, controlSearch, categoryFilter]);

  // Detected non-standard columns for Step 3
  const detectedExtraColumns = useMemo(() => {
    return columnControls.filter(ctrl => !ctrl.isStandard);
  }, [columnControls]);

  // Check if ambiguous LOP column exists in file
  const hasAmbiguousLop = useMemo(() => {
    if (!parsedWb) return false;
    return parsedWb.headers.some(h => {
      const clean = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return clean === 'lop' || clean === 'lossofpay';
    });
  }, [parsedWb]);

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx,.xls,.csv"
        className="hidden"
      />

      {/* Confirmation Modal if Replacing Existing Dataset */}
      {showReplaceConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div
            className={`border rounded-xl max-w-md w-full p-6 shadow-2xl transition ${
              isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
            }`}
          >
            <h3 className={`text-base font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <AlertCircle className="w-5 h-5 text-[#CB1417]" />
              <span>Replace Current Dataset?</span>
            </h3>
            <p className={`text-xs mt-2 ${isDark ? 'text-[#D4D4D8]' : 'text-[#52525B]'}`}>
              You currently have <strong className={isDark ? 'text-white' : 'text-black tabular-nums'}>{currentEmployeeCount} employee records</strong> loaded. Importing a new file will update your working dataset.
            </p>
            <div className="mt-5 flex justify-end space-x-3">
              <button
                onClick={() => setShowReplaceConfirm(false)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  isDark
                    ? 'text-[#A1A1AA] hover:text-white bg-[#141416] border-[#27272A]'
                    : 'text-[#52525B] hover:text-black bg-[#F4F4F6] border-[#E4E4E7]'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowReplaceConfirm(false);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                    fileInputRef.current.click();
                  }
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#CB1417] hover:bg-[#ED1F24] transition cursor-pointer"
              >
                Proceed & Select File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Configuration Modal */}
      {showSaveConfigModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className={`border rounded-xl max-w-md w-full p-6 shadow-2xl transition ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'}`}>
            <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <Save className="w-4 h-4 text-[#CB1417]" />
              <span>Save Import Configuration</span>
            </h3>
            <p className={`text-xs mt-1 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Save this mapping and fetch preference so future imports can be configured in 1-click.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400">Configuration Name *</label>
                <input
                  type="text"
                  value={newConfigName}
                  onChange={e => setNewConfigName(e.target.value)}
                  placeholder="e.g. Monthly Standard Payroll Format"
                  className={`w-full mt-1 px-3 py-1.5 rounded-lg text-xs border ${
                    isDark ? 'bg-black border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                  }`}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-zinc-400">Description (Optional)</label>
                <input
                  type="text"
                  value={newConfigDesc}
                  onChange={e => setNewConfigDesc(e.target.value)}
                  placeholder="e.g. Includes bank details, LOP amount, and Cost Centre"
                  className={`w-full mt-1 px-3 py-1.5 rounded-lg text-xs border ${
                    isDark ? 'bg-black border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                  }`}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end space-x-2">
              <button
                onClick={() => setShowSaveConfigModal(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  isDark ? 'bg-[#18181B] text-zinc-300 border-[#27272A]' : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfiguration}
                disabled={!newConfigName.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#CB1417] hover:bg-[#ED1F24] text-white disabled:opacity-50"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Configuration Modal */}
      {showLoadConfigModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className={`border rounded-xl max-w-lg w-full p-6 shadow-2xl transition ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'}`}>
            <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <FolderOpen className="w-4 h-4 text-[#CB1417]" />
              <span>Load Previous Import Configuration</span>
            </h3>
            <p className={`text-xs mt-1 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              Select a previously saved mapping profile to apply rules immediately.
            </p>

            <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
              {savedConfigs.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500 border rounded-lg">
                  No saved import configurations found. Save one to reuse it here.
                </div>
              ) : (
                savedConfigs.map(cfg => (
                  <div
                    key={cfg.id}
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      isDark ? 'bg-[#141416] border-[#27272A]' : 'bg-[#FAFAFC] border-[#E4E4E7]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs text-white">{cfg.name}</div>
                      {cfg.description && <div className="text-[11px] text-zinc-400 mt-0.5">{cfg.description}</div>}
                      <div className="text-[10px] text-zinc-500 mt-1">Saved on {new Date(cfg.createdAt).toLocaleDateString()}</div>
                    </div>
                    <button
                      onClick={() => handleApplySavedConfig(cfg)}
                      className="px-3 py-1.5 rounded bg-[#CB1417] hover:bg-[#ED1F24] text-white text-xs font-bold"
                    >
                      Apply
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowLoadConfigModal(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  isDark ? 'bg-[#18181B] text-zinc-300 border-[#27272A]' : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workflow Container */}
      <div className={`border rounded-xl p-6 transition ${isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'}`}>
        {/* Header & Demo/Template Actions */}
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b ${isDark ? 'border-[#222222]' : 'border-[#E4E4E7]'}`}>
          <div>
            <h2 className={`text-lg font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
              <FileSpreadsheet className="w-5 h-5 text-[#CB1417]" />
              <span>Advanced Excel Import & Field Control</span>
            </h2>
            <p className={`text-xs mt-1 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
              HR-controlled column fetching, dynamic custom fields, lossless bank/ESI details, and intelligent LOP mapping.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleLoadSampleIntoWizard}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#ED1F24]" />
              <span>Load Sample Payroll (10 Staff)</span>
            </button>
            <button
              onClick={onDownloadTemplate}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-[#CB1417]" />
              <span>Download 33-Col Template</span>
            </button>
          </div>
        </div>

        {/* Stepper Navigation */}
        {parsedWb && currentStep !== 'summary' && (
          <div className={`mt-6 p-2 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
            isDark ? 'bg-[#070708] border-[#1C1C20]' : 'bg-[#FAFAFC] border-[#E4E4E7]'
          }`}>
            <div className="flex items-center space-x-1 overflow-x-auto w-full md:w-auto">
              <button
                onClick={() => setCurrentStep('upload')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                  currentStep === 'upload'
                    ? 'bg-[#CB1417] text-white'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
                }`}
              >
                <span>1. Upload & Sheets</span>
              </button>
              <span className="text-zinc-600 text-xs">/</span>

              <button
                onClick={() => setCurrentStep('field_control')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                  currentStep === 'field_control'
                    ? 'bg-[#CB1417] text-white'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
                }`}
              >
                <span>2. Import Field Control</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white">
                  {columnControls.filter(c => c.fetch).length}
                </span>
              </button>
              <span className="text-zinc-600 text-xs">/</span>

              <button
                onClick={() => setCurrentStep('custom_fields')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                  currentStep === 'custom_fields'
                    ? 'bg-[#CB1417] text-white'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
                }`}
              >
                <span>3. Additional Fields</span>
                {detectedExtraColumns.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400">
                    {detectedExtraColumns.length}
                  </span>
                )}
              </button>
              <span className="text-zinc-600 text-xs">/</span>

              <button
                onClick={() => setCurrentStep('precedence')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                  currentStep === 'precedence'
                    ? 'bg-[#CB1417] text-white'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
                }`}
              >
                <span>4. Precedence & LOP</span>
              </button>
              <span className="text-zinc-600 text-xs">/</span>

              <button
                onClick={generatePreview}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                  currentStep === 'preview'
                    ? 'bg-[#CB1417] text-white'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
                }`}
              >
                <span>5. Preview & Commit</span>
              </button>
            </div>

            {/* Quick Config Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSaveConfigModal(true)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-medium border ${
                  isDark ? 'bg-[#141416] text-zinc-300 border-[#27272A]' : 'bg-white text-zinc-700 border-zinc-300'
                }`}
                title="Save current column preferences"
              >
                <Save className="w-3 h-3 text-[#CB1417]" />
                <span>Save Config</span>
              </button>
              <button
                onClick={() => setShowLoadConfigModal(true)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-medium border ${
                  isDark ? 'bg-[#141416] text-zinc-300 border-[#27272A]' : 'bg-white text-zinc-700 border-zinc-300'
                }`}
                title="Load a saved import config"
              >
                <FolderOpen className="w-3 h-3 text-[#CB1417]" />
                <span>Load Config</span>
              </button>
            </div>
          </div>
        )}

        {/* Global Error Message */}
        {errorMessage && (
          <div className={`mt-4 p-3.5 rounded-lg flex items-center space-x-3 text-xs border ${
            isDark ? 'bg-[#2E0B0D] border-[#57151A] text-[#FCA5A5]' : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
          }`}>
            <AlertCircle className="w-4 h-4 text-[#ED1F24] shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 1: UPLOAD & WORKSHEET INSPECTION */}
        {/* ========================================================= */}
        {currentStep === 'upload' && (
          <div className="mt-6 space-y-6">
            {/* Dropzone & Browse Box */}
            <div
              onClick={handleTriggerBrowse}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition group ${
                isDragOver
                  ? 'border-[#CB1417] bg-[#CB1417]/10 scale-[1.01]'
                  : isDark
                  ? 'border-[#27272A] hover:border-[#CB1417] bg-[#070708] hover:bg-[#0E0E10]'
                  : 'border-[#D4D4D8] hover:border-[#CB1417] bg-[#FAFAFC] hover:bg-[#F4F4F6]'
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#CB1417]/10 border border-[#CB1417]/25 group-hover:scale-110 flex items-center justify-center mx-auto text-[#CB1417] transition">
                <Upload className="w-7 h-7" />
              </div>
              <h3 className={`text-sm font-semibold mt-4 ${isDark ? 'text-white' : 'text-black'}`}>
                {isProcessing ? 'Processing spreadsheet...' : fileName ? `Current File: ${fileName}` : 'Click to Browse Payroll Spreadsheet'}
              </h3>
              <p className={`text-xs mt-1 max-w-md mx-auto ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
                Upload .xlsx, .xls, or .csv. Does not modify your local file. Automatic and manual header detection supported.
              </p>
              <div className="mt-4 flex items-center justify-center space-x-2 text-[11px]">
                <span className={`px-2 py-0.5 rounded border ${isDark ? 'bg-[#141416] border-[#222226] text-[#A1A1AA]' : 'bg-[#E4E4E7] border-[#D4D4D8] text-[#52525B]'}`}>.XLSX</span>
                <span className={`px-2 py-0.5 rounded border ${isDark ? 'bg-[#141416] border-[#222226] text-[#A1A1AA]' : 'bg-[#E4E4E7] border-[#D4D4D8] text-[#52525B]'}`}>.XLS</span>
                <span className={`px-2 py-0.5 rounded border ${isDark ? 'bg-[#141416] border-[#222226] text-[#A1A1AA]' : 'bg-[#E4E4E7] border-[#D4D4D8] text-[#52525B]'}`}>.CSV</span>
              </div>
            </div>

            {/* If workbook loaded: Sheet Inspection & Header Selection */}
            {parsedWb && (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isDark ? 'bg-[#070708] border-[#1C1C20]' : 'bg-[#FAFAFC] border-[#E4E4E7]'
                }`}>
                  <div>
                    <div className="flex items-center space-x-2">
                      <FileCheck className="w-4 h-4 text-[#CB1417]" />
                      <span className="font-bold text-xs text-white">{fileName}</span>
                      <span className="text-zinc-500 text-xs">({parsedWb.totalRawRows} data rows, {parsedWb.headers.length} headers)</span>
                    </div>

                    {/* Sheet selection if multi-sheet */}
                    {parsedWb.sheetNames.length > 1 && (
                      <div className="flex items-center space-x-2 mt-2">
                        <span className="text-[11px] text-zinc-400 flex items-center space-x-1">
                          <Layers className="w-3 h-3 text-[#CB1417]" />
                          <span>Worksheet:</span>
                        </span>
                        {parsedWb.sheetNames.map(sheet => (
                          <button
                            key={sheet}
                            onClick={() => handleSheetChange(sheet)}
                            className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                              parsedWb.activeSheet === sheet
                                ? 'bg-[#CB1417] text-white'
                                : isDark ? 'bg-[#141416] text-zinc-300 hover:text-white' : 'bg-zinc-200 text-zinc-700'
                            }`}
                          >
                            {sheet}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Manual Header Row Selection */}
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-zinc-400">Header Row:</span>
                    <select
                      value={selectedHeaderRow}
                      onChange={e => handleHeaderRowChange(Number(e.target.value))}
                      className={`px-2 py-1 rounded border text-xs ${
                        isDark ? 'bg-black border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                      }`}
                    >
                      <option value={0}>Row 1 (Default)</option>
                      <option value={1}>Row 2 (Title banner above headers)</option>
                      <option value={2}>Row 3</option>
                      <option value={3}>Row 4</option>
                    </select>
                  </div>
                </div>

                {/* Column Health Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                    <div className="text-[11px] text-zinc-400">Total Columns</div>
                    <div className="text-base font-bold text-white mt-0.5">{parsedWb.headers.length}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Detected in worksheet</div>
                  </div>

                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                    <div className="text-[11px] text-zinc-400">Standard Fields</div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5">
                      {columnControls.filter(c => c.isStandard).length}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Recognized Employee Database Studio fields</div>
                  </div>

                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                    <div className="text-[11px] text-zinc-400">Additional Fields</div>
                    <div className="text-base font-bold text-amber-400 mt-0.5">
                      {detectedExtraColumns.length}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Custom company columns</div>
                  </div>

                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                    <div className="text-[11px] text-zinc-400">Empty / Blank Columns</div>
                    <div className="text-base font-bold text-zinc-400 mt-0.5">
                      {parsedWb.emptyColumns?.length || 0}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Safely excluded by default</div>
                  </div>
                </div>

                {/* Raw Sheet Data Preview */}
                <div className={`rounded-xl p-4 border ${isDark ? 'bg-[#070708] border-[#1C1C20]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-2 text-zinc-300 flex items-center space-x-1.5">
                    <Info className="w-3.5 h-3.5 text-[#CB1417]" />
                    <span>Raw Sheet Data Preview (First 5 Rows)</span>
                  </h4>
                  <div className="overflow-x-auto max-h-48 border rounded-lg dark:border-[#222226] border-[#E4E4E7]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className={`text-[11px] font-semibold sticky top-0 ${isDark ? 'bg-[#141416] text-[#A1A1AA]' : 'bg-[#F4F4F6] text-[#52525B]'}`}>
                        <tr>
                          <th className="p-2 border-b dark:border-[#222226] border-[#E4E4E7]">#</th>
                          {parsedWb.headers.slice(0, 10).map(h => (
                            <th key={h} className="p-2 border-b dark:border-[#222226] border-[#E4E4E7] truncate max-w-xs">{h}</th>
                          ))}
                          {parsedWb.headers.length > 10 && (
                            <th className="p-2 border-b dark:border-[#222226] border-[#E4E4E7]">+{parsedWb.headers.length - 10} more</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y font-mono text-[11px] dark:divide-[#1E1E22] divide-[#F4F4F6]">
                        {parsedWb.rows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className={isDark ? 'hover:bg-[#121214]' : 'hover:bg-[#F8F9FA]'}>
                            <td className="p-2 text-zinc-500">{idx + 1}</td>
                            {parsedWb.headers.slice(0, 10).map(h => (
                              <td key={h} className="p-2 truncate max-w-xs text-white">
                                {row[h] !== undefined ? String(row[h]) : '-'}
                              </td>
                            ))}
                            {parsedWb.headers.length > 10 && <td className="p-2 text-zinc-500">...</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottom Step Actions */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setCurrentStep('field_control')}
                    className="flex items-center space-x-2 px-5 py-2.5 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md shadow-[#CB1417]/30 transition cursor-pointer"
                  >
                    <span>Configure Field Control</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: IMPORT FIELD CONTROL (MANDATORY PART 2) */}
        {/* ========================================================= */}
        {currentStep === 'field_control' && parsedWb && (
          <div className="mt-6 space-y-6">
            {/* Toolbar: Category Filters, Search, and Bulk Actions */}
            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-[#070708] border-[#1C1C20]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type="text"
                    value={controlSearch}
                    onChange={e => setControlSearch(e.target.value)}
                    placeholder="Search Excel column, target field, or sample value..."
                    className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border ${
                      isDark ? 'bg-black border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                    }`}
                  />
                </div>

                {/* Bulk Selection Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${
                      isDark ? 'bg-[#18181B] text-zinc-300 border-[#27272A]' : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                    }`}
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${
                      isDark ? 'bg-[#18181B] text-zinc-300 border-[#27272A]' : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                    }`}
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={handleSelectRecommended}
                    className="px-2.5 py-1 rounded text-[11px] font-bold bg-[#CB1417]/10 text-[#CB1417] border border-[#CB1417]/30"
                  >
                    Select Recommended
                  </button>
                  <button
                    onClick={handleFetchSelected}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-600/30"
                  >
                    Fetch Selected
                  </button>
                  <button
                    onClick={handleIgnoreSelected}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-zinc-600/20 text-zinc-400 border border-zinc-600/30"
                  >
                    Ignore Selected
                  </button>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t dark:border-zinc-800 border-zinc-200">
                <span className="text-[11px] text-zinc-500 mr-2 flex items-center space-x-1">
                  <Filter className="w-3 h-3" />
                  <span>Category:</span>
                </span>
                {[
                  { id: 'all', label: 'All Columns' },
                  { id: 'master', label: 'Employee & Statutory' },
                  { id: 'bank', label: 'Bank & Financial' },
                  { id: 'salary', label: 'Salary Components' },
                  { id: 'attendance', label: 'Attendance & LOP' },
                  { id: 'custom', label: 'Custom / Extra' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition cursor-pointer ${
                      categoryFilter === cat.id
                        ? 'bg-[#CB1417] text-white'
                        : isDark ? 'bg-[#18181B] text-zinc-400 hover:text-white' : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dedicated IMPORT FIELD CONTROL Table */}
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-[#0D0D0E] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className={`text-[11px] font-semibold ${isDark ? 'bg-[#141416] text-[#A1A1AA]' : 'bg-[#F4F4F6] text-[#52525B]'}`}>
                    <tr>
                      <th className="p-3 w-8 border-b dark:border-[#222226] border-[#E4E4E7]">
                        <input
                          type="checkbox"
                          checked={selectedColumnNames.size === columnControls.length && columnControls.length > 0}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedColumnNames(new Set(columnControls.map(c => c.excelColumn)));
                            } else {
                              setSelectedColumnNames(new Set());
                            }
                          }}
                          className="rounded text-[#CB1417] focus:ring-0"
                        />
                      </th>
                      <th className="p-3 border-b dark:border-[#222226] border-[#E4E4E7]">Fetch?</th>
                      <th className="p-3 border-b dark:border-[#222226] border-[#E4E4E7]">Excel Column Header</th>
                      <th className="p-3 border-b dark:border-[#222226] border-[#E4E4E7]">Sample Cell Value</th>
                      <th className="p-3 border-b dark:border-[#222226] border-[#E4E4E7]">Suggested Employee Database Studio Field</th>
                      <th className="p-3 border-b dark:border-[#222226] border-[#E4E4E7]">Mapping Status</th>
                      <th className="p-3 border-b dark:border-[#222226] border-[#E4E4E7]">Destination</th>
                      <th className="p-3 border-b dark:border-[#222226] border-[#E4E4E7]">Field Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-sans text-xs dark:divide-[#1C1C20] divide-[#E4E4E7]">
                    {filteredColumnControls.map(ctrl => {
                      const isChecked = selectedColumnNames.has(ctrl.excelColumn);
                      return (
                        <tr
                          key={ctrl.excelColumn}
                          className={`${
                            !ctrl.fetch
                              ? isDark ? 'opacity-40 bg-zinc-950/40' : 'opacity-40 bg-zinc-50'
                              : isDark ? 'hover:bg-[#121214]' : 'hover:bg-[#F8F9FA]'
                          } transition`}
                        >
                          {/* Row Selector */}
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const next = new Set(selectedColumnNames);
                                if (next.has(ctrl.excelColumn)) next.delete(ctrl.excelColumn);
                                else next.add(ctrl.excelColumn);
                                setSelectedColumnNames(next);
                              }}
                              className="rounded text-[#CB1417] focus:ring-0"
                            />
                          </td>

                          {/* Fetch/Ignore Toggle */}
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => toggleColumnFetch(ctrl.excelColumn)}
                              className={`px-3 py-1 rounded-full text-[11px] font-bold transition flex items-center space-x-1 cursor-pointer ${
                                ctrl.fetch
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                                  : 'bg-zinc-700/20 text-zinc-400 border border-zinc-700/30 hover:bg-zinc-700/30'
                              }`}
                            >
                              <span>{ctrl.fetch ? 'YES' : 'NO'}</span>
                            </button>
                          </td>

                          {/* Excel Column Name */}
                          <td className="p-3 font-semibold text-white">
                            <span>{ctrl.excelColumn}</span>
                          </td>

                          {/* Sample Cell Value */}
                          <td className="p-3 font-mono text-[11px] text-zinc-400 max-w-xs truncate">
                            {ctrl.sampleValue !== undefined && ctrl.sampleValue !== null && ctrl.sampleValue !== ''
                              ? String(ctrl.sampleValue)
                              : <span className="italic text-zinc-600">(empty)</span>}
                          </td>

                          {/* Suggested Employee Database Studio Field Selector */}
                          <td className="p-3">
                            <select
                              value={ctrl.suggestedField || ''}
                              onChange={e => updateColumnMapping(ctrl.excelColumn, e.target.value)}
                              className={`w-full max-w-xs text-xs rounded px-2.5 py-1 border font-sans ${
                                isDark ? 'bg-black border-[#27272A] text-white' : 'bg-white border-[#D4D4D8] text-black'
                              }`}
                            >
                              <option value="ignore">-- Ignore Column --</option>
                              <optgroup label="Employee Master & Statutory">
                                <option value="employeeId">Employee ID (String with leading zeros)</option>
                                <option value="name">Employee Legal Name</option>
                                <option value="email">Work / Personal Email</option>
                                <option value="department">Department</option>
                                <option value="designation">Designation / Role</option>
                                <option value="joiningDate">Date of Joining</option>
                                <option value="pan">PAN Number (Permanent Account Number)</option>
                                <option value="uan">UAN (Universal Account Number / PF)</option>
                                <option value="esiNumber">ESI Number (Statutory Medical Insurance No)</option>
                              </optgroup>
                              <optgroup label="Bank & Financial Information">
                                <option value="bankAccount">Bank Account Number (Preserves leading zeros)</option>
                                <option value="bankName">Bank Name (e.g. HDFC, SBI, ICICI)</option>
                                <option value="ifscCode">IFSC Code (e.g. HDFC0001234)</option>
                                <option value="branchName">Branch Name / Location</option>
                                <option value="accountHolderName">Account Holder Name</option>
                              </optgroup>
                              <optgroup label="Salary Components">
                                <option value="ctc">Cost to Company (CTC)</option>
                                <option value="employerPf">Employer PF (Deducted from CTC)</option>
                                <option value="employerEsi">Employer ESI (Deducted from CTC)</option>
                                <option value="basic">Basic Salary</option>
                                <option value="hra">House Rent Allowance (HRA)</option>
                                <option value="specialAllowance">Special Allowance</option>
                                <option value="otherAllowances">Other Allowances</option>
                                <option value="providedGross">Gross Salary (Pre-calculated in Sheet)</option>
                                <option value="pf">Provident Fund (PF Deduction)</option>
                                <option value="esi">ESI Deduction (Contribution)</option>
                                <option value="professionalTax">Professional Tax (PT)</option>
                                <option value="tds">TDS / Income Tax</option>
                                <option value="loan">Staff Loan / Advance Recovery</option>
                                <option value="lateDeduction">Late Deduction / Late Fine</option>
                                <option value="otherDeductions">Other Deductions / Advances</option>
                                <option value="providedDeductions">Total Deductions (Pre-calculated)</option>
                                <option value="providedNet">Net Salary (Take-home Pay)</option>
                              </optgroup>
                              <optgroup label="Attendance & Loss of Pay">
                                <option value="paidDays">Paid Days</option>
                                <option value="unpaidDays">Unpaid Leave Days</option>
                                <option value="totalWorkingDays">Total Working Days</option>
                                <option value="lopDays">Loss of Pay (LOP) Days</option>
                                <option value="lopAmount">Loss of Pay (LOP) Deduction Amount (Rs)</option>
                              </optgroup>
                              {customFieldDefs.length > 0 && (
                                <optgroup label="Custom / Extra Fields">
                                  {customFieldDefs.map(cf => (
                                    <option key={cf.key} value={cf.key}>
                                      {cf.label} ({cf.dataType})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </td>

                          {/* Mapping Status */}
                          <td className="p-3">
                            {!ctrl.fetch ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">Ignored</span>
                            ) : ctrl.suggestedField && ctrl.suggestedField !== 'ignore' ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                                Matched
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Unmapped
                              </span>
                            )}
                          </td>

                          {/* Destination */}
                          <td className="p-3 text-[11px] text-zinc-400">
                            {ctrl.destination === 'both' ? 'Directory & Payroll' : ctrl.destination === 'directory' ? 'Directory Only' : 'Payroll Workspace'}
                          </td>

                          {/* Field Type (Standard vs Custom) */}
                          <td className="p-3">
                            {ctrl.isStandard ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Standard</span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">Custom</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t dark:border-[#222222] border-[#E4E4E7]">
              <button
                onClick={() => setCurrentStep('upload')}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold border ${
                  isDark ? 'bg-[#18181B] text-zinc-300 border-[#27272A]' : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to File</span>
              </button>

              <div className="flex items-center space-x-3">
                <span className="text-xs text-zinc-400">
                  {columnControls.filter(c => c.fetch).length} of {columnControls.length} columns enabled for fetch
                </span>
                <button
                  onClick={() => setCurrentStep('custom_fields')}
                  className="flex items-center space-x-1.5 px-5 py-2.5 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md shadow-[#CB1417]/30 transition cursor-pointer"
                >
                  <span>Review Custom Fields ({detectedExtraColumns.length})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: ADDITIONAL / CUSTOM EXCEL FIELDS (PART 3) */}
        {/* ========================================================= */}
        {currentStep === 'custom_fields' && (
          <div className="mt-6 space-y-6">
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#070708] border-[#1C1C20]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-[#CB1417]" />
                <span>Additional / Custom Excel Fields Management</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Employee Database Studio detected non-standard headers in your file. Configure how these additional fields should be typed, stored, and displayed on payslips.
              </p>
            </div>

            {detectedExtraColumns.length === 0 ? (
              <div className="p-8 rounded-xl border text-center text-xs text-zinc-500 dark:border-[#222226] border-[#E4E4E7]">
                All detected columns in this workbook map cleanly to standard Employee Database Studio fields. No additional custom fields require configuration.
              </div>
            ) : (
              <div className="space-y-4">
                {detectedExtraColumns.map(ctrl => {
                  const def = customFieldDefs.find(d => d.name === ctrl.excelColumn || d.key === ctrl.suggestedField) || {
                    id: `cf_${ctrl.excelColumn}`,
                    name: ctrl.excelColumn,
                    key: ctrl.suggestedField || ctrl.excelColumn.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                    label: ctrl.excelColumn,
                    dataType: 'text' as const,
                    destination: 'both' as const,
                    isVisible: true,
                    availableInPayslip: true,
                    createdAt: new Date().toISOString()
                  };

                  return (
                    <div
                      key={ctrl.excelColumn}
                      className={`p-4 rounded-xl border space-y-3 transition ${
                        isDark ? 'bg-[#141416] border-[#222226]' : 'bg-white border-[#E4E4E7]'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-zinc-800 border-zinc-200 pb-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-white">{ctrl.excelColumn}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                            Extra Field
                          </span>
                          <span className="text-xs text-zinc-500">
                            Sample: <span className="font-mono text-zinc-300">{ctrl.sampleValue !== undefined ? String(ctrl.sampleValue) : '(empty)'}</span>
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <label className="text-[11px] font-semibold text-zinc-400">Import Field?</label>
                          <button
                            type="button"
                            onClick={() => toggleColumnFetch(ctrl.excelColumn)}
                            className={`px-3 py-1 rounded text-xs font-bold ${
                              ctrl.fetch
                                ? 'bg-emerald-500 text-white'
                                : 'bg-zinc-700 text-zinc-300'
                            }`}
                          >
                            {ctrl.fetch ? 'YES (Fetch)' : 'NO (Ignore)'}
                          </button>
                        </div>
                      </div>

                      {ctrl.fetch && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                          {/* Display Label */}
                          <div>
                            <label className="text-[11px] font-semibold text-zinc-400">Display Label (on UI / Payslip)</label>
                            <input
                              type="text"
                              value={def.label}
                              onChange={e => updateCustomFieldDef(def.key, { label: e.target.value })}
                              className={`w-full mt-1 px-2.5 py-1.5 rounded text-xs border ${
                                isDark ? 'bg-black border-[#27272A] text-white' : 'bg-white border-[#D4D4D8] text-black'
                              }`}
                            />
                          </div>

                          {/* Data Type */}
                          <div>
                            <label className="text-[11px] font-semibold text-zinc-400">Data Type</label>
                            <select
                              value={def.dataType}
                              onChange={e => updateCustomFieldDef(def.key, { dataType: e.target.value as any })}
                              className={`w-full mt-1 px-2.5 py-1.5 rounded text-xs border ${
                                isDark ? 'bg-black border-[#27272A] text-white' : 'bg-white border-[#D4D4D8] text-black'
                              }`}
                            >
                              <option value="text">Text (String)</option>
                              <option value="number">Number (Integer)</option>
                              <option value="decimal">Decimal (Float)</option>
                              <option value="currency">Currency (Amount Rs.)</option>
                              <option value="date">Date</option>
                              <option value="boolean">Boolean (Yes/No)</option>
                            </select>
                          </div>

                          {/* Storage Destination */}
                          <div>
                            <label className="text-[11px] font-semibold text-zinc-400">Destination</label>
                            <select
                              value={def.destination}
                              onChange={e => updateCustomFieldDef(def.key, { destination: e.target.value as any })}
                              className={`w-full mt-1 px-2.5 py-1.5 rounded text-xs border ${
                                isDark ? 'bg-black border-[#27272A] text-white' : 'bg-white border-[#D4D4D8] text-black'
                              }`}
                            >
                              <option value="both">Both (Directory & Payroll)</option>
                              <option value="payroll">Payroll Workspace Only</option>
                              <option value="directory">Master Directory Only</option>
                            </select>
                          </div>

                          {/* Payslip Customization Availability */}
                          <div className="flex flex-col justify-end">
                            <label className="flex items-center space-x-2 text-xs text-zinc-300 cursor-pointer pb-2">
                              <input
                                type="checkbox"
                                checked={def.availableInPayslip}
                                onChange={e => updateCustomFieldDef(def.key, { availableInPayslip: e.target.checked })}
                                className="rounded text-[#CB1417] focus:ring-0"
                              />
                              <span>Available in Payslip Layout Customizer</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t dark:border-[#222222] border-[#E4E4E7]">
              <button
                onClick={() => setCurrentStep('field_control')}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold border ${
                  isDark ? 'bg-[#18181B] text-zinc-300 border-[#27272A]' : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Field Control</span>
              </button>

              <button
                onClick={() => setCurrentStep('precedence')}
                className="flex items-center space-x-1.5 px-5 py-2.5 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md shadow-[#CB1417]/30 transition cursor-pointer"
              >
                <span>Precedence & LOP Settings</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 4: PRECEDENCE, LOP & UPDATE RULES (PART 5 & 7) */}
        {/* ========================================================= */}
        {currentStep === 'precedence' && (
          <div className="mt-6 space-y-6">
            {/* Duplicate Handling & Data Protection Card */}
            <div className={`p-5 rounded-xl border space-y-4 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#CB1417] flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4" />
                <span>Existing Employee Data Protection & Duplicate Policy</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Duplicate Strategy */}
                <div className={`p-4 rounded-lg border ${isDark ? 'bg-[#0D0D0E] border-[#27272A]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <div className="text-xs font-bold text-white mb-2">When matching existing Employee ID:</div>
                  <div className="space-y-2">
                    <label className="flex items-start space-x-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="radio"
                        name="dupStrategy"
                        checked={duplicateStrategy === 'update'}
                        onChange={() => setDuplicateStrategy('update')}
                        className="mt-0.5 text-[#CB1417] focus:ring-0"
                      />
                      <div>
                        <span className="font-semibold text-white">Update Existing Records (Recommended)</span>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Updates matched employee profiles with freshly imported fields. Disabled/ignored fields are strictly preserved.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="radio"
                        name="dupStrategy"
                        checked={duplicateStrategy === 'skip'}
                        onChange={() => setDuplicateStrategy('skip')}
                        className="mt-0.5 text-[#CB1417] focus:ring-0"
                      />
                      <div>
                        <span className="font-semibold text-white">Skip Duplicate Records</span>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Retains current stored data completely; only imports completely new employee IDs.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Overwrite with Blank Cells Toggle */}
                <div className={`p-4 rounded-lg border ${isDark ? 'bg-[#0D0D0E] border-[#27272A]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                  <div className="text-xs font-bold text-white mb-2">Blank / Empty Cell Handling:</div>
                  <label className="flex items-start space-x-2.5 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overwriteEmptyCells}
                      onChange={e => setOverwriteEmptyCells(e.target.checked)}
                      className="mt-0.5 rounded text-[#CB1417] focus:ring-0"
                    />
                    <div>
                      <span className="font-semibold text-white">Overwrite existing values with blank Excel cells</span>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Default is <strong className="text-emerald-400">OFF</strong>. When OFF, an empty Excel cell will never erase or clear pre-existing employee data.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Loss of Pay (LOP) Source & Precedence Card */}
            <div className={`p-5 rounded-xl border space-y-4 ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#CB1417] flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Loss of Pay (LOP) Workflow & Precedence</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Employee Database Studio strictly separates <strong className="text-white">LOP Days</strong> (attendance count) from <strong className="text-white">LOP Amount</strong> (deduction currency). Choose the authoritative source for this payroll run:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                  onClick={() => setLopSourcePrecedence('excel')}
                  className={`p-3.5 rounded-lg border cursor-pointer transition ${
                    lopSourcePrecedence === 'excel'
                      ? 'border-[#CB1417] bg-[#CB1417]/10'
                      : isDark ? 'bg-[#0D0D0E] border-[#27272A]' : 'bg-[#FAFAFC] border-[#E4E4E7]'
                  }`}
                >
                  <div className="font-bold text-xs text-white">1. Imported from Excel (Authoritative)</div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Uses the exact LOP values provided in the spreadsheet without silently recalculating.
                  </p>
                </div>

                <div
                  onClick={() => setLopSourcePrecedence('attendance')}
                  className={`p-3.5 rounded-lg border cursor-pointer transition ${
                    lopSourcePrecedence === 'attendance'
                      ? 'border-[#CB1417] bg-[#CB1417]/10'
                      : isDark ? 'bg-[#0D0D0E] border-[#27272A]' : 'bg-[#FAFAFC] border-[#E4E4E7]'
                  }`}
                >
                  <div className="font-bold text-xs text-white">2. Calculated from Attendance</div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Calculates LOP Amount based on (Gross / Total Working Days) * LOP Days.
                  </p>
                </div>

                <div
                  onClick={() => setLopSourcePrecedence('manual')}
                  className={`p-3.5 rounded-lg border cursor-pointer transition ${
                    lopSourcePrecedence === 'manual'
                      ? 'border-[#CB1417] bg-[#CB1417]/10'
                      : isDark ? 'bg-[#0D0D0E] border-[#27272A]' : 'bg-[#FAFAFC] border-[#E4E4E7]'
                  }`}
                >
                  <div className="font-bold text-xs text-white">3. Manual HR Entry</div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Preserves values manually entered by HR in the Validation & Records editor.
                  </p>
                </div>
              </div>

              {/* Ambiguous LOP Disambiguation Prompt if file contains generic "LOP" */}
              {hasAmbiguousLop && (
                <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300 space-y-2">
                  <div className="font-bold flex items-center space-x-2 text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Ambiguous Column &quot;LOP&quot; Detected in Spreadsheet</span>
                  </div>
                  <p>
                    Your file contains a column simply named &quot;LOP&quot;. Please confirm how HR intended this column to be treated:
                  </p>
                  <div className="flex items-center space-x-4 pt-1">
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="ambiguousLop"
                        checked={ambiguousLopChoice === 'days'}
                        onChange={() => setAmbiguousLopChoice('days')}
                        className="text-[#CB1417] focus:ring-0"
                      />
                      <span className="font-semibold text-white">Loss of Pay Days (0-31 days)</span>
                    </label>

                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="ambiguousLop"
                        checked={ambiguousLopChoice === 'amount'}
                        onChange={() => setAmbiguousLopChoice('amount')}
                        className="text-[#CB1417] focus:ring-0"
                      />
                      <span className="font-semibold text-white">Loss of Pay Deduction Amount (Rs.)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t dark:border-[#222222] border-[#E4E4E7]">
              <button
                onClick={() => setCurrentStep('custom_fields')}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold border ${
                  isDark ? 'bg-[#18181B] text-zinc-300 border-[#27272A]' : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Custom Fields</span>
              </button>

              <button
                onClick={generatePreview}
                className="flex items-center space-x-1.5 px-5 py-2.5 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md shadow-[#CB1417]/30 transition cursor-pointer"
              >
                <span>Generate Import Preview</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 5: IMPORT PREVIEW & COMMIT (PART 6) */}
        {/* ========================================================= */}
        {currentStep === 'preview' && (
          <div className="mt-6 space-y-6">
            {/* Preview Summary Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <div className="text-[10px] text-zinc-400">Total Rows</div>
                <div className="text-base font-bold text-white mt-0.5">{previewRecords.length}</div>
              </div>

              <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <div className="text-[10px] text-zinc-400">To Import</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">
                  {previewRecords.length - excludedRowIndices.size}
                </div>
              </div>

              <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <div className="text-[10px] text-zinc-400">Excluded Rows</div>
                <div className="text-base font-bold text-zinc-400 mt-0.5">
                  {excludedRowIndices.size}
                </div>
              </div>

              <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <div className="text-[10px] text-zinc-400">Fields Fetched</div>
                <div className="text-base font-bold text-blue-400 mt-0.5">
                  {columnControls.filter(c => c.fetch).length}
                </div>
              </div>

              <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <div className="text-[10px] text-zinc-400">Ignored Fields</div>
                <div className="text-base font-bold text-zinc-500 mt-0.5">
                  {columnControls.filter(c => !c.fetch).length}
                </div>
              </div>

              <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'}`}>
                <div className="text-[10px] text-zinc-400">Custom Fields</div>
                <div className="text-base font-bold text-purple-400 mt-0.5">
                  {customFieldDefs.filter(f => columnControls.some(c => c.suggestedField === f.key && c.fetch)).length}
                </div>
              </div>
            </div>

            {/* Filter and Search Bar for Preview */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  value={previewSearch}
                  onChange={e => setPreviewSearch(e.target.value)}
                  placeholder="Search preview by ID, name, bank, or pan..."
                  className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border ${
                    isDark ? 'bg-black border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-black'
                  }`}
                />
              </div>

              <div className="text-xs text-zinc-400">
                Uncheck a row to exclude it from the final import batch.
              </div>
            </div>

            {/* Detailed Preview Table */}
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-[#0D0D0E] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className={`text-[11px] font-semibold sticky top-0 ${isDark ? 'bg-[#141416] text-[#A1A1AA]' : 'bg-[#F4F4F6] text-[#52525B]'}`}>
                    <tr>
                      <th className="p-2.5 w-10 border-b dark:border-[#222226] border-[#E4E4E7]">Include</th>
                      <th className="p-2.5 border-b dark:border-[#222226] border-[#E4E4E7]">Emp ID</th>
                      <th className="p-2.5 border-b dark:border-[#222226] border-[#E4E4E7]">Name</th>
                      <th className="p-2.5 border-b dark:border-[#222226] border-[#E4E4E7]">Department</th>
                      <th className="p-2.5 border-b dark:border-[#222226] border-[#E4E4E7]">Bank Details</th>
                      <th className="p-2.5 border-b dark:border-[#222226] border-[#E4E4E7]">ESI Number</th>
                      <th className="p-2.5 border-b dark:border-[#222226] border-[#E4E4E7]">Basic</th>
                      <th className="p-2.5 border-b dark:border-[#222226] border-[#E4E4E7]">Gross</th>
                      <th className="p-2.5 border-b dark:border-[#222226] border-[#E4E4E7]">LOP Info</th>
                      <th className="p-2.5 border-b dark:border-[#222226] border-[#E4E4E7]">Net Pay</th>
                      <th className="p-2.5 border-b dark:border-[#222226] border-[#E4E4E7]">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono text-[11px] dark:divide-[#1C1C20] divide-[#E4E4E7]">
                    {previewRecords
                      .filter(rec => {
                        if (!previewSearch) return true;
                        const q = previewSearch.toLowerCase();
                        return (
                          rec.employeeId.toLowerCase().includes(q) ||
                          rec.name.toLowerCase().includes(q) ||
                          (rec.bankAccount && rec.bankAccount.toLowerCase().includes(q)) ||
                          (rec.pan && rec.pan.toLowerCase().includes(q))
                        );
                      })
                      .map((rec, idx) => {
                        const isExcluded = excludedRowIndices.has(idx);
                        const hasLopConflict = rec.issues?.some(i => i.field === 'lopConflict');

                        return (
                          <tr
                            key={rec.id || idx}
                            className={`${
                              isExcluded
                                ? 'opacity-35 bg-zinc-950'
                                : isDark ? 'hover:bg-[#121214]' : 'hover:bg-[#F8F9FA]'
                            }`}
                          >
                            <td className="p-2.5">
                              <input
                                type="checkbox"
                                checked={!isExcluded}
                                onChange={() => {
                                  const next = new Set(excludedRowIndices);
                                  if (next.has(idx)) next.delete(idx);
                                  else next.add(idx);
                                  setExcludedRowIndices(next);
                                }}
                                className="rounded text-[#CB1417] focus:ring-0"
                              />
                            </td>

                            {/* Emp ID with preserved leading zeros */}
                            <td className="p-2.5 font-bold text-white whitespace-nowrap">
                              {rec.employeeId}
                            </td>

                            {/* Name */}
                            <td className="p-2.5 font-sans font-semibold text-white truncate max-w-[150px]">
                              {rec.name}
                            </td>

                            {/* Department */}
                            <td className="p-2.5 font-sans text-zinc-400">
                              {rec.department || '-'}
                            </td>

                            {/* Bank Details */}
                            <td className="p-2.5 text-zinc-300 whitespace-nowrap">
                              {rec.bankAccount ? (
                                <div className="text-[10px]">
                                  <span className="font-mono text-emerald-400">{rec.bankAccount}</span>
                                  {rec.bankName && <span className="text-zinc-500 ml-1">({rec.bankName})</span>}
                                  {rec.ifscCode && <div className="text-zinc-500 font-mono">IFSC: {rec.ifscCode}</div>}
                                </div>
                              ) : (
                                <span className="text-zinc-600 italic">None</span>
                              )}
                            </td>

                            {/* ESI Number */}
                            <td className="p-2.5 text-zinc-300 whitespace-nowrap">
                              {rec.esiNumber ? (
                                <span className="font-mono text-blue-400">{rec.esiNumber}</span>
                              ) : (
                                <span className="text-zinc-600 italic">-</span>
                              )}
                            </td>

                            {/* Basic */}
                            <td className="p-2.5 text-white">
                              Rs. {rec.basic.toLocaleString('en-IN')}
                            </td>

                            {/* Gross */}
                            <td className="p-2.5 text-white font-semibold">
                              Rs. {rec.calculatedGross.toLocaleString('en-IN')}
                            </td>

                            {/* LOP Info */}
                            <td className="p-2.5 whitespace-nowrap">
                              {rec.lopDays || rec.lopAmount ? (
                                <div className="text-[10px]">
                                  <span className="text-amber-400 font-semibold">{rec.lopDays || 0} Days</span>
                                  {rec.lopAmount ? <span className="text-zinc-400 ml-1">(Rs. {rec.lopAmount})</span> : null}
                                </div>
                              ) : (
                                <span className="text-zinc-600">0</span>
                              )}
                            </td>

                            {/* Net Pay */}
                            <td className="p-2.5 text-emerald-400 font-bold whitespace-nowrap">
                              Rs. {rec.calculatedNet.toLocaleString('en-IN')}
                            </td>

                            {/* Validation issues */}
                            <td className="p-2.5">
                              {hasLopConflict ? (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                                  LOP Review
                                </span>
                              ) : rec.isValid ? (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                                  Valid
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400" title={rec.issues.map(i => i.message).join(', ')}>
                                  {rec.issues.length} Issues
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t dark:border-[#222222] border-[#E4E4E7]">
              <button
                onClick={() => setCurrentStep('precedence')}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold border ${
                  isDark ? 'bg-[#18181B] text-zinc-300 border-[#27272A]' : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Precedence</span>
              </button>

              <button
                onClick={handleCommitImport}
                disabled={isProcessing || previewRecords.length === excludedRowIndices.size}
                className="flex items-center space-x-2 px-6 py-3 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-xl text-xs font-bold shadow-lg shadow-[#CB1417]/30 transition cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span className="tabular-nums">
                  {isProcessing
                    ? 'Committing to Database...'
                    : `Commit & Load ${previewRecords.length - excludedRowIndices.size} Records`}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 6: SUMMARY MODAL / CONFIRMATION (PART 1 & 6) */}
        {/* ========================================================= */}
        {currentStep === 'summary' && importSummaryResult && (
          <div className="mt-6 space-y-6">
            <div className={`p-6 rounded-2xl border text-center space-y-3 ${
              isDark ? 'bg-[#141416] border-[#222226]' : 'bg-[#FAFAFC] border-[#E4E4E7]'
            }`}>
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Import Successfully Committed!</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                All authorized employee records, bank details, statutory IDs, LOP values, and custom fields have been saved to local database storage.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0D0D0E] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
                <div className="text-[11px] text-zinc-400">Total Processed</div>
                <div className="text-xl font-bold text-white mt-1">{importSummaryResult.totalProcessed}</div>
              </div>

              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0D0D0E] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
                <div className="text-[11px] text-zinc-400">New Directory Records</div>
                <div className="text-xl font-bold text-emerald-400 mt-1">{importSummaryResult.importedCount}</div>
              </div>

              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0D0D0E] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
                <div className="text-[11px] text-zinc-400">Updated Records</div>
                <div className="text-xl font-bold text-blue-400 mt-1">{importSummaryResult.updatedCount}</div>
              </div>

              <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0D0D0E] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
                <div className="text-[11px] text-zinc-400">Custom Fields Saved</div>
                <div className="text-xl font-bold text-purple-400 mt-1">{importSummaryResult.customFieldsSaved}</div>
              </div>
            </div>

            {/* List of Ignored Columns */}
            {importSummaryResult.ignoredColumns.length > 0 && (
              <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-[#0D0D0E] border-[#222226]' : 'bg-white border-[#E4E4E7]'}`}>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Ignored Columns ({importSummaryResult.ignoredColumns.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {importSummaryResult.ignoredColumns.map(col => (
                    <span
                      key={col}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center pt-4">
              <button
                onClick={() => {
                  // Reset back to upload or let user browse
                  setCurrentStep('upload');
                }}
                className="px-6 py-2.5 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md shadow-[#CB1417]/30 transition cursor-pointer"
              >
                Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
