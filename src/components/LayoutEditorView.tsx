import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  Save,
  RotateCcw,
  CheckCircle2,
  Eye,
  Sparkles,
  Undo2,
  Redo2,
  Download,
  BookmarkPlus,
  AlertTriangle,
  Copy,
  Edit3,
  Star,
  History,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import {
  CompanySettings,
  EmployeeRecord,
  PayslipLayoutSettings,
  PayslipElementConfig,
  PayslipTemplatePreset,
  DEFAULT_LAYOUT_SETTINGS,
  CustomFieldDefinition,
} from '../types/payroll';
import { useTheme } from '../context/ThemeContext';
import { localDB } from '../utils/dbStorage';
import { generatePayslipPdf, getSafeFileName } from '../utils/pdfGenerator';
import { numberToWords } from '../utils/numberToWords';
import {
  PAYSLIP_FIELD_REGISTRY,
  EXTRA_METADATA_FIELDS,
  resolvePayslipSectionsData,
  estimatePayslipFit,
  isFieldVisibleInLayout,
} from '../utils/payslipFieldRegistry';
import { FieldLibrarySidebar } from './layoutEditor/FieldLibrarySidebar';
import { ElementInspectorPanel } from './layoutEditor/ElementInspectorPanel';
import { PayslipPreviewModal } from './PayslipPreviewModal';

interface LayoutEditorViewProps {
  layoutSettings: PayslipLayoutSettings;
  onSaveLayout: (settings: PayslipLayoutSettings) => void;
  settings: CompanySettings;
  sampleEmployee: EmployeeRecord;
  allEmployees?: EmployeeRecord[];
  onNavigateToEmployeeData?: () => void;
}

type SectionKey = 'employeeInfo' | 'salaryTable' | 'netPay' | 'notes' | 'signatures';

const DEFAULT_SECTION_ORDER: SectionKey[] = ['employeeInfo', 'salaryTable', 'netPay', 'notes', 'signatures'];
const CUSTOM_PRESETS_STORAGE_KEY = 'eds_layout_custom_presets_v2';
const PREVIOUS_SAVED_KEY = 'eds_layout_previous_saved_v1';

interface SavedCustomTemplate {
  id: string;
  name: string;
  isDefault?: boolean;
  updatedAt: string;
  layout: PayslipLayoutSettings;
}

const BUILTIN_TEMPLATES: Array<{
  id: PayslipTemplatePreset;
  label: string;
  description: string;
}> = [
  { id: 'professional_corporate', label: 'Professional Corporate', description: 'Balanced 2-col grid & vivid corporate tables' },
  { id: 'minimal_clean', label: 'Minimal Clean', description: 'Compact spacing with borderless typography' },
  { id: 'detailed_breakdown', label: 'Detailed Salary Breakdown', description: 'Spacious rows showing full CTC & all statutory fields' },
];

export const LayoutEditorView: React.FC<LayoutEditorViewProps> = ({
  layoutSettings,
  onSaveLayout,
  settings,
  sampleEmployee,
  allEmployees = [],
  onNavigateToEmployeeData,
}) => {
  const { isDark } = useTheme();
  const [formData, setFormData] = useState<PayslipLayoutSettings>({
    ...DEFAULT_LAYOUT_SETTINGS,
    ...(layoutSettings || {}),
    sectionOrder:
      Array.isArray(layoutSettings?.sectionOrder) && layoutSettings.sectionOrder.length > 0
        ? layoutSettings.sectionOrder
        : DEFAULT_SECTION_ORDER,
  });

  // Previous saved snapshot for "Restore Previous"
  const [previousSavedLayout, setPreviousSavedLayout] = useState<PayslipLayoutSettings | null>(() => {
    try {
      const raw = localStorage.getItem(PREVIOUS_SAVED_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<PayslipLayoutSettings[]>([]);
  const [redoStack, setRedoStack] = useState<PayslipLayoutSettings[]>([]);

  // Inspector Selection & Preview Employee Source
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>('employeeId');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    allEmployees.length > 0 ? allEmployees[0].employeeId : '__sample__'
  );
  const [showFullPreviewModal, setShowFullPreviewModal] = useState(false);

  const [customFieldsFromDb, setCustomFieldsFromDb] = useState<CustomFieldDefinition[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  // Template management state
  const [savedTemplates, setSavedTemplates] = useState<SavedCustomTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [overwriteConfirmTarget, setOverwriteConfirmTarget] = useState<SavedCustomTemplate | null>(null);

  // Drag & drop state for sectionOrder
  const [draggedSection, setDraggedSection] = useState<SectionKey | null>(null);

  useEffect(() => {
    setFormData({
      ...DEFAULT_LAYOUT_SETTINGS,
      ...(layoutSettings || {}),
      sectionOrder:
        Array.isArray(layoutSettings?.sectionOrder) && layoutSettings.sectionOrder.length > 0
          ? layoutSettings.sectionOrder
          : DEFAULT_SECTION_ORDER,
    });
  }, [layoutSettings]);

  useEffect(() => {
    async function loadCustomFields() {
      try {
        const list = await localDB.getCustomFields();
        setCustomFieldsFromDb(list);
      } catch {
        // optional
      }
    }
    loadCustomFields();
  }, []);

  const showNotice = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const commitChange = (updater: (prev: PayslipLayoutSettings) => PayslipLayoutSettings) => {
    setFormData((prev) => {
      const next = updater(prev);
      setUndoStack((u) => [...u.slice(-24), prev]);
      setRedoStack([]);
      return next;
    });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, formData]);
    setFormData(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, formData]);
    setFormData(next);
  };

  // Active Employee for Live Preview (either real record from state or sample fallback)
  const isUsingSampleData = selectedEmployeeId === '__sample__' || allEmployees.length === 0;
  const activePreviewEmployee: EmployeeRecord = useMemo(() => {
    if (!isUsingSampleData) {
      const found = allEmployees.find((e) => e.employeeId === selectedEmployeeId || e.id === selectedEmployeeId);
      if (found) return found;
    }
    return sampleEmployee;
  }, [isUsingSampleData, allEmployees, selectedEmployeeId, sampleEmployee]);

  // Shared resolution & single-page fit check
  const resolvedPreview = useMemo(
    () => resolvePayslipSectionsData(activePreviewEmployee, settings, 'October', 2026, formData, false),
    [activePreviewEmployee, settings, formData]
  );

  const fitEstimate = useMemo(
    () => estimatePayslipFit(activePreviewEmployee, settings, formData, 'October', 2026),
    [activePreviewEmployee, settings, formData]
  );

  // Field Visibility & Element Inspector Handlers
  const handleToggleFieldVisible = (fieldKey: string) => {
    commitChange((prev) => {
      const next = { ...prev, fieldConfigs: { ...(prev.fieldConfigs || {}) } };
      const regMeta = PAYSLIP_FIELD_REGISTRY.find((f) => f.key === fieldKey);
      const extraMeta = EXTRA_METADATA_FIELDS.find((f) => f.key === fieldKey);
      const customMetaIdx = (prev.customFieldsMeta || []).findIndex((c) => c.key === fieldKey);

      if (regMeta) {
        const currentlyVisible = isFieldVisibleInLayout(prev, regMeta);
        const newVis = !currentlyVisible;
        (next as any)[regMeta.showKey] = newVis;
        if (regMeta.key === 'employeePf') next.showEmployeePf = newVis;
        next.fieldConfigs[fieldKey] = { ...(next.fieldConfigs[fieldKey] || { key: fieldKey }), visible: newVis };
      } else if (extraMeta) {
        const cur = prev[extraMeta.showKey] !== false;
        (next as any)[extraMeta.showKey] = !cur;
        next.fieldConfigs[fieldKey] = { ...(next.fieldConfigs[fieldKey] || { key: fieldKey }), visible: !cur };
      } else if (customMetaIdx >= 0) {
        const list = [...(prev.customFieldsMeta || [])];
        const cur = list[customMetaIdx].visible !== false;
        list[customMetaIdx] = { ...list[customMetaIdx], visible: !cur };
        next.customFieldsMeta = list;
      }
      return next;
    });
  };

  const handleUpdateElement = (fieldKey: string, patch: Partial<PayslipElementConfig>) => {
    commitChange((prev) => {
      const next = { ...prev, fieldConfigs: { ...(prev.fieldConfigs || {}) } };
      next.fieldConfigs[fieldKey] = {
        ...(next.fieldConfigs[fieldKey] || { key: fieldKey }),
        ...patch,
      };
      if (patch.label !== undefined) {
        const regMeta = PAYSLIP_FIELD_REGISTRY.find((f) => f.key === fieldKey);
        const extraMeta = EXTRA_METADATA_FIELDS.find((f) => f.key === fieldKey);
        const customMetaIdx = (prev.customFieldsMeta || []).findIndex((c) => c.key === fieldKey);
        if (regMeta) {
          (next as any)[regMeta.labelKey] = patch.label;
        } else if (extraMeta) {
          (next as any)[extraMeta.labelKey] = patch.label;
        } else if (customMetaIdx >= 0) {
          const list = [...(prev.customFieldsMeta || [])];
          list[customMetaIdx] = { ...list[customMetaIdx], label: patch.label };
          next.customFieldsMeta = list;
        }
      }
      return next;
    });
  };

  const handleResetElement = (fieldKey: string) => {
    commitChange((prev) => {
      const nextConfigs = { ...(prev.fieldConfigs || {}) };
      delete nextConfigs[fieldKey];
      const next = { ...prev, fieldConfigs: nextConfigs };
      const regMeta = PAYSLIP_FIELD_REGISTRY.find((f) => f.key === fieldKey);
      if (regMeta) {
        (next as any)[regMeta.labelKey] = (DEFAULT_LAYOUT_SETTINGS as any)[regMeta.labelKey] || regMeta.defaultLabel;
        (next as any)[regMeta.showKey] = (DEFAULT_LAYOUT_SETTINGS as any)[regMeta.showKey];
      }
      return next;
    });
    showNotice(`Reset element styles for ${fieldKey}.`);
  };

  const handleMoveFieldOrder = (fieldKey: string, dir: -1 | 1) => {
    const keys = resolvedPreview.infoFields.map((i) => i.key);
    const idx = keys.indexOf(fieldKey);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= keys.length) return;
    const reordered = [...keys];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(target, 0, item);

    commitChange((prev) => {
      const nextConfigs = { ...(prev.fieldConfigs || {}) };
      reordered.forEach((k, pos) => {
        nextConfigs[k] = { ...(nextConfigs[k] || { key: k }), order: pos };
      });
      return { ...prev, fieldConfigs: nextConfigs };
    });
  };

  const handleAddCustomStudioField = (field: {
    label: string;
    sampleValue: string;
    sectionPlacement: 'employeeInfo' | 'earnings' | 'deductions';
  }) => {
    const key = `studio_${field.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString().slice(-4)}`;
    commitChange((prev) => ({
      ...prev,
      customFieldsMeta: [
        ...(prev.customFieldsMeta || []),
        {
          key,
          label: field.label,
          sampleValue: field.sampleValue,
          sectionPlacement: field.sectionPlacement,
          visible: true,
        },
      ],
    }));
    setSelectedFieldKey(key);
    showNotice(`Added custom field "${field.label}" to payslip layout.`);
  };

  const handleDeleteCustomStudioField = (key: string) => {
    commitChange((prev) => ({
      ...prev,
      customFieldsMeta: (prev.customFieldsMeta || []).filter((c) => c.key !== key),
    }));
    if (selectedFieldKey === key) setSelectedFieldKey(null);
  };

  const handleCustomDbFieldToggle = (fieldKey: string, currentLabel: string) => {
    commitChange((prev) => {
      const layouts = [...(prev.customFieldLayouts || [])];
      const existingIdx = layouts.findIndex((l) => l.key === fieldKey);
      if (existingIdx >= 0) {
        layouts[existingIdx] = {
          ...layouts[existingIdx],
          showInPdf: layouts[existingIdx].showInPdf === false,
        };
      } else {
        layouts.push({ key: fieldKey, label: currentLabel, showInPdf: false });
      }
      return { ...prev, customFieldLayouts: layouts };
    });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const order = [...(formData.sectionOrder || DEFAULT_SECTION_ORDER)];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    const [removed] = order.splice(index, 1);
    order.splice(targetIndex, 0, removed);
    commitChange((prev) => ({ ...prev, sectionOrder: order }));
  };

  const handleDropSection = (targetKey: SectionKey) => {
    if (!draggedSection || draggedSection === targetKey) {
      setDraggedSection(null);
      return;
    }
    const order = [...(formData.sectionOrder || DEFAULT_SECTION_ORDER)];
    const fromIdx = order.indexOf(draggedSection);
    const toIdx = order.indexOf(targetKey);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedSection(null);
      return;
    }
    const [removed] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, removed);
    commitChange((prev) => ({ ...prev, sectionOrder: order }));
    setDraggedSection(null);
  };

  // Built-in Template Presets
  const applyBuiltInTemplate = (preset: PayslipTemplatePreset) => {
    commitChange((prev) => {
      if (preset === 'minimal_clean' || preset === 'compact') {
        return {
          ...prev,
          templatePreset: preset,
          orientation: 'portrait',
          fontFamily: 'helvetica',
          headerFontSize: 13,
          bodyFontSize: 7.5,
          cellPadding: 'compact',
          tableBorderStyle: 'minimal',
          alignHeader: 'left',
          logoPosition: 'left',
          logoSize: 'small',
          primaryColor: '#18181B',
          secondaryColor: '#3F3F46',
          marginMm: 10,
        };
      }
      if (preset === 'detailed_breakdown' || preset === 'modern') {
        return {
          ...prev,
          templatePreset: preset,
          orientation: 'portrait',
          fontFamily: 'sans',
          headerFontSize: 15,
          bodyFontSize: 8.5,
          cellPadding: 'spacious',
          tableBorderStyle: 'grid',
          alignHeader: 'left',
          logoPosition: 'left',
          logoSize: 'medium',
          showCtc: true,
          showEmployerPf: true,
          showEmployerEsi: true,
          showPfNumber: true,
          showEsiNumber: true,
          showBranchName: true,
          showAccountHolderName: true,
          primaryColor: settings.themeColor || '#CB1417',
          secondaryColor: '#18181B',
          marginMm: 12,
        };
      }
      // Professional Corporate (Default)
      return {
        ...prev,
        templatePreset: 'professional_corporate',
        orientation: 'portrait',
        fontFamily: 'helvetica',
        headerFontSize: 15,
        bodyFontSize: 8,
        cellPadding: 'standard',
        tableBorderStyle: 'grid',
        alignHeader: 'left',
        logoPosition: 'left',
        logoSize: 'medium',
        primaryColor: settings.themeColor || '#CB1417',
        secondaryColor: '#18181B',
        marginMm: 14,
      };
    });
    setActiveTemplateId(null);
    showNotice(`Applied template preset.`);
  };

  // Template Storage Helpers
  const persistTemplatesList = (list: SavedCustomTemplate[]) => {
    setSavedTemplates(list);
    try {
      localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(list));
    } catch {}
  };

  const handleSaveAsNewTemplate = () => {
    const trimmed = newTemplateName.trim();
    if (!trimmed) return;
    const existing = savedTemplates.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setOverwriteConfirmTarget(existing);
      setShowSaveAsModal(false);
      return;
    }
    const tpl: SavedCustomTemplate = {
      id: `tpl_${Date.now()}`,
      name: trimmed,
      updatedAt: new Date().toISOString(),
      layout: { ...formData },
    };
    persistTemplatesList([tpl, ...savedTemplates].slice(0, 12));
    setActiveTemplateId(tpl.id);
    setNewTemplateName('');
    setShowSaveAsModal(false);
    showNotice(`Saved new template "${trimmed}".`);
  };

  const executeOverwriteTemplate = () => {
    if (!overwriteConfirmTarget) return;
    const updated = savedTemplates.map((t) =>
      t.id === overwriteConfirmTarget.id
        ? { ...t, layout: { ...formData }, updatedAt: new Date().toISOString() }
        : t
    );
    persistTemplatesList(updated);
    setActiveTemplateId(overwriteConfirmTarget.id);
    showNotice(`Updated template "${overwriteConfirmTarget.name}".`);
    setOverwriteConfirmTarget(null);
    setNewTemplateName('');
  };

  const handleDuplicateActiveTemplate = () => {
    const baseName = savedTemplates.find((t) => t.id === activeTemplateId)?.name || 'Custom Layout';
    const copyTpl: SavedCustomTemplate = {
      id: `tpl_${Date.now()}`,
      name: `${baseName} (Copy)`,
      updatedAt: new Date().toISOString(),
      layout: { ...formData },
    };
    persistTemplatesList([copyTpl, ...savedTemplates].slice(0, 12));
    setActiveTemplateId(copyTpl.id);
    showNotice(`Duplicated template as "${copyTpl.name}".`);
  };

  const handleConfirmRename = () => {
    if (!renameTargetId || !renameValue.trim()) return;
    persistTemplatesList(
      savedTemplates.map((t) =>
        t.id === renameTargetId ? { ...t, name: renameValue.trim(), updatedAt: new Date().toISOString() } : t
      )
    );
    setRenameTargetId(null);
    setRenameValue('');
    showNotice('Renamed template.');
  };

  const handleSetDefaultTemplate = (id: string) => {
    const target = savedTemplates.find((t) => t.id === id);
    if (!target) return;
    persistTemplatesList(savedTemplates.map((t) => ({ ...t, isDefault: t.id === id })));
    setFormData({ ...DEFAULT_LAYOUT_SETTINGS, ...target.layout });
    onSaveLayout({ ...DEFAULT_LAYOUT_SETTINGS, ...target.layout });
    showNotice(`"${target.name}" set as default payslip template.`);
  };

  const handleSaveLayout = () => {
    try {
      localStorage.setItem(PREVIOUS_SAVED_KEY, JSON.stringify(layoutSettings));
      setPreviousSavedLayout(layoutSettings);
    } catch {}
    onSaveLayout(formData);
    showNotice('Payslip layout configuration saved and synced to Preview & PDF engine.');
  };

  const handleRestorePrevious = () => {
    if (!previousSavedLayout) return;
    commitChange(() => ({ ...DEFAULT_LAYOUT_SETTINGS, ...previousSavedLayout }));
    showNotice('Restored previous saved layout configuration.');
  };

  const executeResetDefaults = () => {
    const resetVal: PayslipLayoutSettings = {
      ...DEFAULT_LAYOUT_SETTINGS,
      sectionOrder: [...DEFAULT_SECTION_ORDER],
      customTextBlocks: [],
      customFieldsMeta: [],
      fieldConfigs: {},
    };
    setUndoStack((u) => [...u.slice(-24), formData]);
    setRedoStack([]);
    setFormData(resetVal);
    onSaveLayout(resetVal);
    setShowResetModal(false);
    showNotice('Layout reset to factory Professional Corporate defaults.');
  };

  const handleTestPdfDownload = () => {
    const doc = generatePayslipPdf(activePreviewEmployee, settings, 'October', 2026, formData);
    doc.save(getSafeFileName(activePreviewEmployee, 'October', 2026));
    showNotice('Downloaded Test PDF matching live canvas 1:1.');
  };

  const accentColor = formData.primaryColor || settings.themeColor || '#CB1417';
  const secondaryColor = formData.secondaryColor || '#18181B';
  const isLandscape = formData.orientation === 'landscape';

  const previewFontClass =
    formData.fontFamily === 'times'
      ? 'font-serif'
      : formData.fontFamily === 'courier'
        ? 'font-mono'
        : 'font-sans';

  const logoSizeClass =
    formData.logoSize === 'small'
      ? 'w-9 h-9'
      : formData.logoSize === 'large'
        ? 'w-16 h-16'
        : 'w-12 h-12';

  const cellPadClass =
    formData.cellPadding === 'compact'
      ? 'px-2 py-0.5'
      : formData.cellPadding === 'spacious'
        ? 'px-3 py-2'
        : 'px-2.5 py-1';

  const currentOrder = (
    Array.isArray(formData.sectionOrder) && formData.sectionOrder.length > 0
      ? formData.sectionOrder
      : DEFAULT_SECTION_ORDER
  ) as SectionKey[];

  const renderPreviewCustomBlocks = (slot: 'afterEmployeeInfo' | 'afterNetPay' | 'footer') => {
    const blocks = (formData.customTextBlocks || []).filter((b) => b.visible !== false && b.position === slot && b.content?.trim());
    if (blocks.length === 0) return null;
    return (
      <div className="space-y-1.5 my-2">
        {blocks.map((b) => (
          <div key={b.id} className="p-2 rounded border border-zinc-200 bg-zinc-50 text-[10px]">
            <div className="font-bold uppercase tracking-wide text-[9px]" style={{ color: accentColor }}>
              {b.title || 'Notice'}
            </div>
            <p className="text-zinc-700 whitespace-pre-line mt-0.5">{b.content}</p>
          </div>
        ))}
      </div>
    );
  };

  const visibleRegistryCount = PAYSLIP_FIELD_REGISTRY.filter((f) => isFieldVisibleInLayout(formData, f)).length;

  return (
    <div className="space-y-4">
      {/* TOP TOOLBAR */}
      <div
        className={`border rounded-xl p-4 space-y-3 transition ${
          isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-[#FFFFFF] border-[#E4E4E7]'
        }`}
      >
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#CB1417] uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-[#CB1417]" />
              <span>Visual Payslip Layout Studio (3-Panel Inspector)</span>
            </div>
            <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
              Payslip Layout Customizer
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 whitespace-nowrap">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer disabled:opacity-40 ${
                isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer disabled:opacity-40 ${
                isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
              }`}
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span>Redo</span>
            </button>

            {previousSavedLayout && (
              <button
                type="button"
                onClick={handleRestorePrevious}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]' : 'bg-white hover:bg-[#F4F4F6] text-black border-[#E4E4E7]'
                }`}
                title="Restore previous saved layout configuration"
              >
                <History className="w-3.5 h-3.5 text-amber-500" />
                <span>Restore Previous</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowFullPreviewModal(true)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]' : 'bg-white hover:bg-[#F4F4F6] text-black border-[#E4E4E7]'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-[#CB1417]" />
              <span>Preview Modal</span>
            </button>

            <button
              type="button"
              onClick={handleTestPdfDownload}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]' : 'bg-white hover:bg-[#F4F4F6] text-black border-[#E4E4E7]'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-[#CB1417]" />
              <span>Test PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                isDark ? 'bg-[#18181B] hover:bg-[#27272A] text-white border-[#27272A]' : 'bg-[#F4F4F6] hover:bg-[#E4E4E7] text-black border-[#E4E4E7]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={handleSaveLayout}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg text-xs font-bold shadow-md shadow-[#CB1417]/25 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Layout</span>
            </button>
          </div>
        </div>

        {/* Built-in & Saved Templates Strip */}
        <div className="pt-2.5 border-t dark:border-[#222222] border-[#E4E4E7] flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold flex items-center space-x-1 mr-1 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-[#CB1417]" />
              <span>Templates:</span>
            </span>

            {BUILTIN_TEMPLATES.map((tpl) => {
              const active = !activeTemplateId && formData.templatePreset === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyBuiltInTemplate(tpl.id)}
                  title={tpl.description}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                    active
                      ? 'bg-[#CB1417] text-white border-[#CB1417]'
                      : isDark
                        ? 'bg-[#141416] hover:bg-[#27272A] border-[#27272A] text-white'
                        : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-black'
                  }`}
                >
                  {tpl.label}
                </button>
              );
            })}

            {savedTemplates.map((sp) => (
              <div
                key={sp.id}
                className={`inline-flex items-center rounded-lg border overflow-hidden text-[11px] ${
                  activeTemplateId === sp.id
                    ? 'border-[#CB1417] bg-[#CB1417]/10'
                    : isDark
                      ? 'border-[#27272A] bg-[#141416]'
                      : 'border-zinc-300 bg-zinc-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    commitChange(() => ({ ...DEFAULT_LAYOUT_SETTINGS, ...sp.layout }));
                    setActiveTemplateId(sp.id);
                    showNotice(`Loaded template "${sp.name}".`);
                  }}
                  className="px-2 py-1 font-medium hover:text-[#CB1417] cursor-pointer flex items-center space-x-1"
                >
                  {sp.isDefault && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                  <span>{sp.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenameTargetId(sp.id);
                    setRenameValue(sp.name);
                  }}
                  title="Rename template"
                  className="px-1.5 py-1 text-zinc-400 hover:text-blue-500 border-l dark:border-[#27272A] border-zinc-300 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSetDefaultTemplate(sp.id)}
                  title="Set as Default Template"
                  className="px-1.5 py-1 text-zinc-400 hover:text-amber-500 border-l dark:border-[#27272A] border-zinc-300 cursor-pointer"
                >
                  <Star className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    persistTemplatesList(savedTemplates.filter((t) => t.id !== sp.id));
                    if (activeTemplateId === sp.id) setActiveTemplateId(null);
                  }}
                  title="Delete template"
                  className="px-1.5 py-1 text-zinc-400 hover:text-red-500 border-l dark:border-[#27272A] border-zinc-300 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={handleDuplicateActiveTemplate}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                isDark ? 'bg-[#18181B] hover:bg-[#27272A] border-[#27272A] text-white' : 'bg-white hover:bg-zinc-100 border-zinc-300 text-black'
              }`}
            >
              <Copy className="w-3 h-3" />
              <span>Duplicate</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSaveAsModal(true)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                isDark ? 'bg-[#18181B] hover:bg-[#27272A] border-[#27272A] text-white' : 'bg-white hover:bg-zinc-100 border-zinc-300 text-black'
              }`}
            >
              <BookmarkPlus className="w-3 h-3 text-[#CB1417]" />
              <span>Save as New Template</span>
            </button>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div
          className={`p-3 rounded-xl flex items-center space-x-2.5 text-xs border ${
            isDark ? 'bg-[#0E2013] border-[#1D4A27] text-[#86EFAC]' : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MAIN 3-PANEL STUDIO */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT PANEL: 36-Field Library, Ordering, Branding & Blocks */}
        <div className="xl:col-span-3">
          <FieldLibrarySidebar
            isDark={isDark}
            layout={formData}
            selectedKey={selectedFieldKey}
            companyThemeColor={settings.themeColor}
            customFieldsFromDb={customFieldsFromDb}
            onSelectField={(key) => setSelectedFieldKey(key)}
            onToggleFieldVisible={handleToggleFieldVisible}
            onToggleSettingBool={(k) =>
              commitChange((prev) => ({
                ...prev,
                [k]: typeof prev[k] === 'boolean' ? !prev[k] : !(prev[k] ?? true),
              }))
            }
            onSelectSetting={(k, v) => commitChange((prev) => ({ ...prev, [k]: v }))}
            onLabelChange={(k, v) => commitChange((prev) => ({ ...prev, [k]: v }))}
            onAddCustomStudioField={handleAddCustomStudioField}
            onDeleteCustomStudioField={handleDeleteCustomStudioField}
            onCustomDbFieldToggle={handleCustomDbFieldToggle}
            onMoveSection={moveSection}
            onDropSection={handleDropSection}
            draggedSection={draggedSection}
            setDraggedSection={setDraggedSection}
            onAddTextBlock={(title, content, pos) => {
              commitChange((prev) => ({
                ...prev,
                customTextBlocks: [
                  ...(prev.customTextBlocks || []),
                  {
                    id: `blk_${Date.now()}`,
                    title: title.trim() || 'HR Notice',
                    content: content.trim(),
                    position: pos,
                    visible: true,
                  },
                ],
              }));
              showNotice('Added custom text block.');
            }}
            onToggleTextBlock={(id) =>
              commitChange((prev) => ({
                ...prev,
                customTextBlocks: (prev.customTextBlocks || []).map((b) =>
                  b.id === id ? { ...b, visible: !b.visible } : b
                ),
              }))
            }
            onDeleteTextBlock={(id) =>
              commitChange((prev) => ({
                ...prev,
                customTextBlocks: (prev.customTextBlocks || []).filter((b) => b.id !== id),
              }))
            }
          />
        </div>

        {/* CENTER PANEL: Live White A4 Sheet & Overflow/Source Bar */}
        <div className="xl:col-span-6 space-y-3">
          {/* Preview Data Source & Single-Page Fit Bar */}
          <div
            className={`border rounded-xl p-3 space-y-2.5 text-xs ${
              isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-[11px] text-zinc-500">Preview Record:</span>
                <select
                  value={isUsingSampleData ? '__sample__' : activePreviewEmployee.employeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                    isDark ? 'bg-[#141416] border-[#27272A] text-white' : 'bg-[#FAFAFC] border-[#E4E4E7] text-black'
                  }`}
                >
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.employeeId}>
                      {emp.employeeId} — {emp.name}
                    </option>
                  ))}
                  <option value="__sample__">Sample Preview Data (Layout Preview Only)</option>
                </select>
                {isUsingSampleData && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/30">
                    Preview Sample Only · Not Saved
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {onNavigateToEmployeeData && (
                  <button
                    type="button"
                    onClick={onNavigateToEmployeeData}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center space-x-1 cursor-pointer ${
                      isDark ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-200' : 'border-zinc-300 hover:bg-zinc-100 text-zinc-800'
                    }`}
                  >
                    <ExternalLink className="w-3 h-3 text-[#CB1417]" />
                    <span>Edit Employee Data</span>
                  </button>
                )}
              </div>
            </div>

            {/* Single-Page Fit / Overflow Indicator */}
            <div
              className={`px-3 py-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                fitEstimate.fitsOnSinglePage
                  ? isDark
                    ? 'bg-emerald-950/25 border-emerald-700/30 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : isDark
                    ? 'bg-amber-950/30 border-amber-700/40 text-amber-200'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center space-x-1.5 min-w-0">
                {fitEstimate.fitsOnSinglePage ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}
                <span className="truncate">
                  {fitEstimate.fitsOnSinglePage
                    ? `Fits cleanly on single ${isLandscape ? 'A4 Landscape' : 'A4 Portrait'} sheet (${fitEstimate.estimatedHeightMm}mm / ${fitEstimate.maxHeightMm}mm)`
                    : fitEstimate.warningMessage}
                </span>
              </div>
              <span className="font-mono text-[10px] shrink-0 tabular-nums font-bold">
                {visibleRegistryCount}/36 fields
              </span>
            </div>
          </div>

          {/* LIVE WHITE A4 PAPER CANVAS */}
          <div className={`rounded-xl border p-4 overflow-x-auto ${isDark ? 'bg-[#09090B] border-[#222222]' : 'bg-[#F4F4F6] border-[#E4E4E7]'}`}>
            <div
              className={`bg-white text-black rounded-md border border-[#E5E5E8] shadow-xl mx-auto p-6 text-[11px] ${
                isLandscape ? 'max-w-[780px]' : 'max-w-[630px]'
              } ${previewFontClass} transition-all`}
            >
              {/* Document Header */}
              <div
                className={`flex pb-3 border-b-2 border-black gap-3 ${
                  formData.alignHeader === 'center'
                    ? 'flex-col items-center text-center'
                    : formData.alignHeader === 'right'
                      ? 'flex-row-reverse items-start justify-between text-right'
                      : 'items-start justify-between'
                }`}
              >
                <div
                  className={`flex items-start gap-3 ${
                    formData.logoPosition === 'right'
                      ? 'flex-row-reverse'
                      : formData.logoPosition === 'center'
                        ? 'flex-col items-center text-center'
                        : ''
                  }`}
                >
                  {formData.showLogo && settings.logoDataUrl ? (
                    <img
                      src={settings.logoDataUrl}
                      alt="Logo"
                      className={`${logoSizeClass} object-contain rounded border border-[#E5E5E8] p-0.5 shrink-0`}
                    />
                  ) : formData.showLogo ? (
                    <div
                      className={`${logoSizeClass} rounded text-white flex items-center justify-center font-bold text-sm shrink-0`}
                      style={{ backgroundColor: accentColor }}
                    >
                      {settings.companyName.slice(0, 2).toUpperCase()}
                    </div>
                  ) : null}

                  <div>
                    <h4 className="font-bold text-black leading-tight" style={{ fontSize: `${formData.headerFontSize ?? 15}px` }}>
                      {settings.companyName}
                    </h4>
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      {[settings.addressLine1, settings.cityStateZip].filter(Boolean).join(', ')}
                    </p>
                    {formData.showTaxId && settings.taxRegistrationNumber && (
                      <p className="text-[9px] text-zinc-500 font-mono">
                        Tax ID: {settings.taxRegistrationNumber}
                      </p>
                    )}
                  </div>
                </div>

                <div className={formData.alignHeader === 'center' ? 'text-center' : 'text-right'}>
                  <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: accentColor }}>
                    PAYSLIP
                  </span>
                  <span className="text-[11px] font-bold text-black block">OCTOBER 2026</span>
                </div>
              </div>

              {/* Ordered Interactive Sections */}
              {currentOrder.map((sec) => {
                if (sec === 'employeeInfo') {
                  return (
                    <div key="employeeInfo">
                      <div className="my-3 bg-[#FAFAFC] rounded border border-[#E5E5E8] p-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {resolvedPreview.infoFields.map((field) => {
                          const isSelected = selectedFieldKey === field.key;
                          const cfg = field.styleConfig;
                          return (
                            <button
                              key={field.key}
                              type="button"
                              onClick={() => setSelectedFieldKey(field.key)}
                              className={`flex justify-between items-center text-left pb-0.5 px-1 rounded transition cursor-pointer ${
                                cfg.width === 'full' ? 'col-span-2' : ''
                              } ${
                                isSelected
                                  ? 'ring-2 ring-[#CB1417] bg-[#CB1417]/10'
                                  : 'hover:bg-zinc-200/60'
                              } ${
                                cfg.borderStyle === 'solid'
                                  ? 'border border-zinc-300'
                                  : cfg.borderStyle === 'none'
                                    ? ''
                                    : 'border-b border-[#E5E5E8]'
                              }`}
                              style={{
                                backgroundColor: isSelected ? undefined : cfg.backgroundColor || undefined,
                                fontSize: cfg.fontSize ? `${cfg.fontSize + 2}px` : undefined,
                              }}
                            >
                              <span className="text-zinc-500 truncate min-w-0 mr-1.5">{field.label}:</span>
                              <span
                                className={`font-mono tabular-nums ${
                                  field.displayValue.length <= 18 ? 'shrink-0' : 'truncate max-w-[62%]'
                                } ${
                                  cfg.fontWeight === 'normal'
                                    ? 'font-normal'
                                    : cfg.fontWeight === 'medium'
                                      ? 'font-semibold'
                                      : 'font-bold'
                                } ${
                                  cfg.align === 'left'
                                    ? 'text-left'
                                    : cfg.align === 'center'
                                      ? 'text-center'
                                      : 'text-right'
                                }`}
                                style={{ color: cfg.textColor || '#000000' }}
                                title={field.displayValue}
                              >
                                {field.displayValue}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {renderPreviewCustomBlocks('afterEmployeeInfo')}
                    </div>
                  );
                }

                if (sec === 'salaryTable') {
                  return (
                    <div key="salaryTable" className="grid grid-cols-2 gap-3 my-3">
                      <div className={`rounded overflow-hidden ${formData.tableBorderStyle === 'minimal' ? '' : 'border border-[#E5E5E8]'}`}>
                        <div
                          className="text-white px-2.5 py-1.5 flex justify-between font-bold text-[10px]"
                          style={{ backgroundColor: accentColor }}
                        >
                          <span>{formData.labelEarnings || 'EARNINGS'}</span>
                          <span>AMOUNT</span>
                        </div>
                        <div className={`${formData.tableBorderStyle === 'minimal' ? '' : 'divide-y divide-[#F4F4F6]'} text-[10px]`}>
                          {resolvedPreview.earningRows.map((row) => {
                            const isSelected = selectedFieldKey === row.key;
                            return (
                              <button
                                key={row.key}
                                type="button"
                                onClick={() => setSelectedFieldKey(row.key)}
                                className={`w-full ${cellPadClass} flex justify-between text-left transition cursor-pointer ${
                                  isSelected ? 'ring-2 ring-inset ring-[#CB1417] bg-[#CB1417]/10' : 'hover:bg-zinc-50'
                                }`}
                                style={{ backgroundColor: isSelected ? undefined : row.styleConfig.backgroundColor || undefined }}
                              >
                                <span className="text-zinc-600 truncate pr-1">{row.label}</span>
                                <span
                                  className="font-mono font-semibold tabular-nums shrink-0"
                                  style={{ color: row.styleConfig.textColor || '#000000' }}
                                >
                                  {row.displayValue}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {formData.showGrossEarnings !== false && (
                          <button
                            type="button"
                            onClick={() => setSelectedFieldKey('calculatedGross')}
                            className={`w-full bg-[#F8F8FA] px-2.5 py-1.5 border-t border-black flex justify-between font-bold text-[10px] cursor-pointer ${
                              selectedFieldKey === 'calculatedGross' ? 'ring-2 ring-inset ring-[#CB1417]' : ''
                            }`}
                          >
                            <span>{resolvedPreview.grossTotal.label}</span>
                            <span className="font-mono tabular-nums">{resolvedPreview.grossTotal.displayValue}</span>
                          </button>
                        )}
                      </div>

                      <div className={`rounded overflow-hidden ${formData.tableBorderStyle === 'minimal' ? '' : 'border border-[#E5E5E8]'}`}>
                        <div
                          className="text-white px-2.5 py-1.5 flex justify-between font-bold text-[10px]"
                          style={{ backgroundColor: secondaryColor }}
                        >
                          <span>{formData.labelDeductions || 'DEDUCTIONS'}</span>
                          <span>AMOUNT</span>
                        </div>
                        <div className={`${formData.tableBorderStyle === 'minimal' ? '' : 'divide-y divide-[#F4F4F6]'} text-[10px]`}>
                          {resolvedPreview.deductionRows.map((row) => {
                            const isSelected = selectedFieldKey === row.key;
                            return (
                              <button
                                key={row.key}
                                type="button"
                                onClick={() => setSelectedFieldKey(row.key)}
                                className={`w-full ${cellPadClass} flex justify-between text-left transition cursor-pointer ${
                                  isSelected ? 'ring-2 ring-inset ring-[#CB1417] bg-[#CB1417]/10' : 'hover:bg-zinc-50'
                                }`}
                                style={{ backgroundColor: isSelected ? undefined : row.styleConfig.backgroundColor || undefined }}
                              >
                                <span className="text-zinc-600 truncate pr-1">{row.label}</span>
                                <span
                                  className="font-mono font-semibold tabular-nums shrink-0"
                                  style={{ color: row.styleConfig.textColor || '#ED1F24' }}
                                >
                                  {row.displayValue}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {formData.showTotalDeductions !== false && (
                          <button
                            type="button"
                            onClick={() => setSelectedFieldKey('calculatedDeductions')}
                            className={`w-full bg-[#F8F8FA] px-2.5 py-1.5 border-t border-black flex justify-between font-bold text-[10px] cursor-pointer ${
                              selectedFieldKey === 'calculatedDeductions' ? 'ring-2 ring-inset ring-[#CB1417]' : ''
                            }`}
                          >
                            <span>{resolvedPreview.deductionTotal.label}</span>
                            <span className="font-mono text-[#ED1F24] tabular-nums">
                              {resolvedPreview.deductionTotal.displayValue}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                if (sec === 'netPay') {
                  if (formData.showNetSalary === false) return null;
                  const isSel = selectedFieldKey === 'calculatedNet';
                  return (
                    <div key="netPay">
                      <button
                        type="button"
                        onClick={() => setSelectedFieldKey('calculatedNet')}
                        className={`w-full text-left my-3 p-3 rounded border-2 flex items-center justify-between cursor-pointer transition ${
                          isSel ? 'ring-2 ring-offset-1 ring-[#CB1417]' : ''
                        }`}
                        style={{ borderColor: accentColor }}
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: accentColor }}>
                            {resolvedPreview.netPaySummary.label || 'Net Salary Payable'}
                          </span>
                          <span className="text-[9px] text-zinc-500 italic block mt-0.5 truncate">
                            In Words: {numberToWords(activePreviewEmployee.calculatedNet, settings.currencyName || 'USD')}
                          </span>
                        </div>
                        <span className="text-lg font-extrabold font-mono tabular-nums shrink-0" style={{ color: accentColor }}>
                          {resolvedPreview.netPaySummary.displayValue}
                        </span>
                      </button>
                      {renderPreviewCustomBlocks('afterNetPay')}
                    </div>
                  );
                }

                if (sec === 'notes') {
                  return (
                    <div key="notes">
                      {formData.showFooterNote && settings.payslipNote && (
                        <p className="text-[9px] text-zinc-500 italic my-2">Note: {settings.payslipNote}</p>
                      )}
                      {renderPreviewCustomBlocks('footer')}
                    </div>
                  );
                }

                if (sec === 'signatures' && formData.showSignatures) {
                  return (
                    <div key="signatures" className="mt-5 pt-3 border-t border-zinc-200 flex items-end justify-between text-[9px] text-zinc-500">
                      <div>
                        <div className="w-24 border-b border-black mb-1" />
                        <span>Employee Signature</span>
                      </div>
                      <div className="text-right">
                        {settings.signatureDataUrl && (
                          <img src={settings.signatureDataUrl} alt="Sig" className="h-7 object-contain ml-auto mb-1" />
                        )}
                        <div className="w-28 border-b border-black mb-1 ml-auto" />
                        <span>{settings.authorizedSignatoryTitle || 'Authorized Signatory'}</span>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Element Properties Inspector */}
        <div className="xl:col-span-3">
          <ElementInspectorPanel
            isDark={isDark}
            selectedKey={selectedFieldKey}
            layout={formData}
            visibleFieldCount={visibleRegistryCount}
            totalRegistryCount={PAYSLIP_FIELD_REGISTRY.length}
            onUpdateElement={handleUpdateElement}
            onResetElement={handleResetElement}
            onToggleFieldVisible={handleToggleFieldVisible}
            onToggleMaskBank={(masked) =>
              commitChange((prev) => ({ ...prev, maskBankAccount: masked }))
            }
            onMoveFieldOrder={handleMoveFieldOrder}
          />
        </div>
      </div>

      {/* Live Preview Modal */}
      {showFullPreviewModal && (
        <PayslipPreviewModal
          employee={activePreviewEmployee}
          settings={settings}
          month="October"
          year={2026}
          onClose={() => setShowFullPreviewModal(false)}
          layoutSettings={formData}
        />
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'}`}>
            <div className="flex items-center space-x-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold">Reset Payslip Layout?</h3>
            </div>
            <p className="text-xs text-zinc-400">
              Revert all field toggles, custom labels, inspector styling, and section ordering back to factory defaults?
            </p>
            <div className="flex justify-end space-x-2 pt-2 border-t dark:border-zinc-800 border-zinc-200">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border dark:border-zinc-700 border-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeResetDefaults}
                className="px-3 py-1.5 bg-[#CB1417] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save As New Template Modal */}
      {showSaveAsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border p-5 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'}`}>
            <h3 className="text-sm font-bold">Save as New Payslip Template</h3>
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="e.g. Executive Monthly Payslip"
              className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-[#141416] border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-300 text-black'}`}
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowSaveAsModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border dark:border-zinc-700 border-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAsNewTemplate}
                className="px-3.5 py-1.5 bg-[#CB1417] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overwrite Template Confirmation Modal */}
      {overwriteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border p-5 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'}`}>
            <div className="flex items-center space-x-2 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold">Overwrite Existing Template?</h3>
            </div>
            <p className="text-xs text-zinc-400">
              A saved template named <strong>{overwriteConfirmTarget.name}</strong> already exists. Replace it with the current layout?
            </p>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setOverwriteConfirmTarget(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border dark:border-zinc-700 border-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeOverwriteTemplate}
                className="px-3.5 py-1.5 bg-[#CB1417] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Confirm Overwrite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Template Modal */}
      {renameTargetId && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border p-5 space-y-4 ${isDark ? 'bg-[#0D0D0E] border-[#222222] text-white' : 'bg-white border-[#E4E4E7] text-black'}`}>
            <h3 className="text-sm font-bold">Rename Saved Template</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg border text-xs outline-none ${isDark ? 'bg-[#141416] border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-300 text-black'}`}
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRenameTargetId(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border dark:border-zinc-700 border-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                className="px-3.5 py-1.5 bg-[#CB1417] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
