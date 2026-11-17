import React, { useState } from 'react';
import {
  Search,
  Sliders,
  Shield,
  Type,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  ListChecks,
} from 'lucide-react';
import {
  CustomFieldDefinition,
  PayslipLayoutSettings,
} from '../../types/payroll';
import {
  PAYSLIP_FIELD_REGISTRY,
  PAYSLIP_SECTION_TITLES,
  EXTRA_METADATA_FIELDS,
  PayslipSectionGroup,
  isFieldVisibleInLayout,
  getFieldLabelInLayout,
} from '../../utils/payslipFieldRegistry';

type SectionKey = 'employeeInfo' | 'salaryTable' | 'netPay' | 'notes' | 'signatures';

const SECTION_LABELS: Record<SectionKey, { title: string; subtitle: string }> = {
  employeeInfo: { title: 'Employee & Bank Grid', subtitle: 'Sections A & B + attendance & CTC' },
  salaryTable: { title: 'Earnings & Deductions Table', subtitle: 'Sections C & D salary breakdown' },
  netPay: { title: 'Net Salary Payable Box', subtitle: 'Final take-home pay & amount in words' },
  notes: { title: 'Notes & Custom Text Blocks', subtitle: 'Policy footers & HR notices' },
  signatures: { title: 'Authorized Signatures', subtitle: 'Employee & signatory signature lines' },
};

const SECTION_GROUPS: PayslipSectionGroup[] = ['A', 'B', 'C', 'D', 'E'];

interface FieldLibrarySidebarProps {
  isDark: boolean;
  layout: PayslipLayoutSettings;
  selectedKey: string | null;
  companyThemeColor: string;
  customFieldsFromDb: CustomFieldDefinition[];
  onSelectField: (key: string) => void;
  onToggleFieldVisible: (key: string) => void;
  onToggleSettingBool: (key: keyof PayslipLayoutSettings) => void;
  onSelectSetting: (key: keyof PayslipLayoutSettings, val: any) => void;
  onLabelChange: (key: keyof PayslipLayoutSettings, val: string) => void;
  onAddCustomStudioField: (field: {
    label: string;
    sampleValue: string;
    sectionPlacement: 'employeeInfo' | 'earnings' | 'deductions';
  }) => void;
  onDeleteCustomStudioField: (key: string) => void;
  onCustomDbFieldToggle: (key: string, label: string) => void;
  onMoveSection: (idx: number, dir: -1 | 1) => void;
  onDropSection: (targetKey: SectionKey) => void;
  draggedSection: SectionKey | null;
  setDraggedSection: (sec: SectionKey | null) => void;
  onAddTextBlock: (title: string, content: string, pos: 'afterEmployeeInfo' | 'afterNetPay' | 'footer') => void;
  onToggleTextBlock: (id: string) => void;
  onDeleteTextBlock: (id: string) => void;
}

export const FieldLibrarySidebar: React.FC<FieldLibrarySidebarProps> = ({
  isDark,
  layout,
  selectedKey,
  customFieldsFromDb,
  onSelectField,
  onToggleFieldVisible,
  onToggleSettingBool,
  onSelectSetting,
  onLabelChange,
  onAddCustomStudioField,
  onDeleteCustomStudioField,
  onCustomDbFieldToggle,
  onMoveSection,
  onDropSection,
  draggedSection,
  setDraggedSection,
  onAddTextBlock,
  onToggleTextBlock,
  onDeleteTextBlock,
}) => {
  const [activeTab, setActiveTab] = useState<'fields' | 'structure' | 'branding' | 'blocks'>('fields');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    A: true,
    B: true,
    C: true,
    D: true,
    E: true,
    META: false,
    CUSTOM: true,
  });

  // Add Custom Field inputs
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomSample, setNewCustomSample] = useState('');
  const [newCustomPlacement, setNewCustomPlacement] = useState<'employeeInfo' | 'earnings' | 'deductions'>('employeeInfo');

  // Custom text block inputs
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockContent, setNewBlockContent] = useState('');
  const [newBlockPos, setNewBlockPos] = useState<'afterEmployeeInfo' | 'afterNetPay' | 'footer'>('afterNetPay');

  const cardSurface = isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]';
  const inputSurface = isDark
    ? 'bg-[#141416] border-[#27272A] text-white'
    : 'bg-[#FAFAFC] border-[#E4E4E7] text-black';
  const rowSurface = isDark ? 'bg-[#141416] border-[#26262B]' : 'bg-[#FAFAFC] border-[#E4E4E7]';

  const currentOrder = (
    Array.isArray(layout.sectionOrder) && layout.sectionOrder.length > 0
      ? layout.sectionOrder
      : ['employeeInfo', 'salaryTable', 'netPay', 'notes', 'signatures']
  ) as SectionKey[];

  const toggleGroup = (g: string) =>
    setExpandedGroups((prev) => ({ ...prev, [g]: !prev[g] }));

  const q = searchQuery.trim().toLowerCase();

  const handleCreateCustomField = () => {
    if (!newCustomLabel.trim()) return;
    onAddCustomStudioField({
      label: newCustomLabel.trim(),
      sampleValue: newCustomSample.trim() || '—',
      sectionPlacement: newCustomPlacement,
    });
    setNewCustomLabel('');
    setNewCustomSample('');
    setShowAddCustom(false);
  };

  return (
    <div className={`border rounded-xl p-4 space-y-4 text-xs ${cardSurface}`}>
      {/* Left Panel Tab Switcher */}
      <div className="grid grid-cols-4 gap-1 border-b pb-3 dark:border-[#222222] border-[#E4E4E7]">
        {([
          { id: 'fields' as const, label: '36 Fields', icon: ListChecks },
          { id: 'structure' as const, label: 'Order', icon: Sliders },
          { id: 'branding' as const, label: 'Brand', icon: Shield },
          { id: 'blocks' as const, label: 'Blocks', icon: Type },
        ]).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-2 py-1.5 rounded-lg font-semibold flex flex-col items-center justify-center gap-0.5 text-[10px] transition cursor-pointer ${
                active
                  ? 'bg-[#CB1417] text-white shadow-xs'
                  : isDark
                    ? 'bg-[#141416] text-[#A1A1AA] hover:text-white'
                    : 'bg-[#F4F4F6] text-[#52525B] hover:text-black'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SEARCHABLE 36-FIELD LIBRARY + CUSTOM FIELDS */}
      {activeTab === 'fields' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all 36 payslip fields..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs outline-none ${inputSurface}`}
            />
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {SECTION_GROUPS.map((group) => {
              const fields = PAYSLIP_FIELD_REGISTRY.filter((f) => {
                if (f.section !== group) return false;
                if (!q) return true;
                const lbl = getFieldLabelInLayout(layout, f).toLowerCase();
                return lbl.includes(q) || f.key.toLowerCase().includes(q) || f.defaultLabel.toLowerCase().includes(q);
              });
              if (fields.length === 0) return null;
              const visibleCount = fields.filter((f) => isFieldVisibleInLayout(layout, f)).length;
              const isOpen = q ? true : expandedGroups[group];

              return (
                <div key={group} className={`rounded-xl border overflow-hidden ${rowSurface}`}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className="w-full px-3 py-2 flex items-center justify-between text-left font-bold text-[11px] cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <span className="truncate">{PAYSLIP_SECTION_TITLES[group]}</span>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                        {visibleCount}/{fields.length}
                      </span>
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-1.5 space-y-1 border-t dark:border-[#26262B] border-[#E4E4E7]">
                      {fields.map((meta) => {
                        const visible = isFieldVisibleInLayout(layout, meta);
                        const label = getFieldLabelInLayout(layout, meta);
                        const isSel = selectedKey === meta.key;

                        return (
                          <div
                            key={meta.key}
                            onClick={() => onSelectField(meta.key)}
                            className={`flex items-center justify-between px-2 py-1.5 rounded-lg border transition cursor-pointer ${
                              isSel
                                ? 'border-[#CB1417] bg-[#CB1417]/10'
                                : isDark
                                  ? 'border-transparent hover:bg-white/5'
                                  : 'border-transparent hover:bg-zinc-100'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className={`text-[11px] font-medium truncate ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                                {label}
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={visible}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => onToggleFieldVisible(meta.key)}
                              aria-label={`Toggle ${label}`}
                              className="w-3.5 h-3.5 accent-[#CB1417] rounded cursor-pointer shrink-0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Extra Metadata Group */}
            <div className={`rounded-xl border overflow-hidden ${rowSurface}`}>
              <button
                type="button"
                onClick={() => toggleGroup('META')}
                className="w-full px-3 py-2 flex items-center justify-between text-left font-bold text-[11px] cursor-pointer"
              >
                <span>Payslip Period &amp; Metadata ({EXTRA_METADATA_FIELDS.length})</span>
                {expandedGroups.META ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {expandedGroups.META && (
                <div className="p-1.5 space-y-1 border-t dark:border-[#26262B] border-[#E4E4E7]">
                  {EXTRA_METADATA_FIELDS.map((mf) => {
                    const visible = layout[mf.showKey] !== false;
                    const label = String(layout[mf.labelKey] || mf.defaultLabel);
                    const isSel = selectedKey === mf.key;
                    return (
                      <div
                        key={mf.key}
                        onClick={() => onSelectField(mf.key)}
                        className={`flex items-center justify-between px-2 py-1.5 rounded-lg border cursor-pointer ${
                          isSel ? 'border-[#CB1417] bg-[#CB1417]/10' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <span className="text-[11px] font-medium truncate pr-2">{label}</span>
                        <input
                          type="checkbox"
                          checked={visible}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => onToggleFieldVisible(mf.key)}
                          className="w-3.5 h-3.5 accent-[#CB1417] rounded cursor-pointer shrink-0"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom Fields Section */}
            <div className={`rounded-xl border overflow-hidden ${rowSurface}`}>
              <div className="px-3 py-2 flex items-center justify-between font-bold text-[11px]">
                <span>Custom Fields ({(layout.customFieldsMeta?.length || 0) + customFieldsFromDb.length})</span>
                <button
                  type="button"
                  onClick={() => setShowAddCustom((v) => !v)}
                  className="text-[#CB1417] hover:underline flex items-center space-x-1 cursor-pointer text-[10px]"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Custom Field</span>
                </button>
              </div>

              {showAddCustom && (
                <div className="p-2.5 space-y-2 border-t dark:border-[#26262B] border-[#E4E4E7]">
                  <input
                    type="text"
                    value={newCustomLabel}
                    onChange={(e) => setNewCustomLabel(e.target.value)}
                    placeholder="Field Label (e.g. Shift Allowance)"
                    className={`w-full px-2.5 py-1.5 rounded border text-[11px] ${inputSurface}`}
                  />
                  <input
                    type="text"
                    value={newCustomSample}
                    onChange={(e) => setNewCustomSample(e.target.value)}
                    placeholder="Sample / Default Value"
                    className={`w-full px-2.5 py-1.5 rounded border text-[11px] ${inputSurface}`}
                  />
                  <select
                    value={newCustomPlacement}
                    onChange={(e) => setNewCustomPlacement(e.target.value as any)}
                    className={`w-full px-2 py-1.5 rounded border text-[11px] ${inputSurface}`}
                  >
                    <option value="employeeInfo">Place in Employee Info Grid</option>
                    <option value="earnings">Place in Earnings Table</option>
                    <option value="deductions">Place in Deductions Table</option>
                  </select>
                  <div className="flex justify-end space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setShowAddCustom(false)}
                      className="px-2.5 py-1 rounded border text-[10px] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateCustomField}
                      className="px-2.5 py-1 bg-[#CB1417] text-white rounded font-bold text-[10px] cursor-pointer"
                    >
                      Add Field
                    </button>
                  </div>
                </div>
              )}

              <div className="p-1.5 space-y-1 border-t dark:border-[#26262B] border-[#E4E4E7]">
                {(layout.customFieldsMeta || []).map((cm) => (
                  <div
                    key={cm.key}
                    onClick={() => onSelectField(cm.key)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg border cursor-pointer ${
                      selectedKey === cm.key ? 'border-[#CB1417] bg-[#CB1417]/10' : 'border-transparent hover:bg-black/5'
                    }`}
                  >
                    <span className="text-[11px] font-medium truncate pr-2">{cm.label}</span>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="checkbox"
                        checked={cm.visible !== false}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => onToggleFieldVisible(cm.key)}
                        className="w-3.5 h-3.5 accent-[#CB1417] cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCustomStudioField(cm.key);
                        }}
                        className="text-zinc-400 hover:text-red-500 cursor-pointer"
                        aria-label={`Remove ${cm.label}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {customFieldsFromDb.map((cf) => {
                  const cfg = (layout.customFieldLayouts || []).find((c) => c.key === cf.key);
                  const active = cfg ? cfg.showInPdf !== false : cf.includeInPayslip !== false;
                  return (
                    <div
                      key={cf.key}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-black/5"
                    >
                      <span className="text-[11px] truncate pr-2">{cfg?.label || cf.label} (Excel)</span>
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => onCustomDbFieldToggle(cf.key, cf.label)}
                        className="w-3.5 h-3.5 accent-[#CB1417] cursor-pointer"
                      />
                    </div>
                  );
                })}

                {(layout.customFieldsMeta?.length || 0) === 0 && customFieldsFromDb.length === 0 && (
                  <p className="text-[10px] text-zinc-500 px-2 py-1">
                    No custom fields yet. Click &quot;Add Custom Field&quot; above.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECTION ORDER & PAGE SETUP */}
      {activeTab === 'structure' && (
        <div className="space-y-4">
          <div>
            <h4 className="font-bold text-xs mb-1">Section Display Order</h4>
            <p className="text-[10px] text-zinc-500 mb-2.5">Drag or use arrows to reorder PDF &amp; preview sections.</p>
            <div className="space-y-2">
              {currentOrder.map((secKey, idx) => {
                const meta = SECTION_LABELS[secKey] || { title: secKey, subtitle: '' };
                return (
                  <div
                    key={secKey}
                    draggable
                    onDragStart={() => setDraggedSection(secKey)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDropSection(secKey)}
                    className={`flex items-center justify-between p-2 rounded-lg border ${
                      draggedSection === secKey ? 'border-[#CB1417] bg-[#CB1417]/10' : rowSurface
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <GripVertical className="w-3.5 h-3.5 text-zinc-400 shrink-0 cursor-grab" />
                      <div className="min-w-0">
                        <div className="font-semibold text-[11px] truncate">
                          {idx + 1}. {meta.title}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">{meta.subtitle}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0 ml-1">
                      <button
                        type="button"
                        onClick={() => onMoveSection(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded border dark:border-zinc-700 border-zinc-300 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveSection(idx, 1)}
                        disabled={idx === currentOrder.length - 1}
                        className="p-1 rounded border dark:border-zinc-700 border-zinc-300 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 pt-2 border-t dark:border-[#222222] border-[#E4E4E7]">
            <div>
              <label className="block font-semibold mb-1">Page Orientation</label>
              <select
                value={layout.orientation || 'portrait'}
                onChange={(e) => onSelectSetting('orientation', e.target.value)}
                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputSurface}`}
              >
                <option value="portrait">A4 Portrait</option>
                <option value="landscape">A4 Landscape</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Margins ({layout.marginMm ?? 14} mm)</label>
              <input
                type="range"
                min={8}
                max={22}
                value={layout.marginMm ?? 14}
                onChange={(e) => onSelectSetting('marginMm', Number(e.target.value))}
                className="w-full accent-[#CB1417] cursor-pointer"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Table Border Style</label>
              <select
                value={layout.tableBorderStyle || 'grid'}
                onChange={(e) => onSelectSetting('tableBorderStyle', e.target.value)}
                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputSurface}`}
              >
                <option value="grid">Full Boxed Grid</option>
                <option value="horizontal">Horizontal Lines</option>
                <option value="minimal">Minimal Clean</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Row Density / Spacing</label>
              <select
                value={layout.cellPadding || 'standard'}
                onChange={(e) => onSelectSetting('cellPadding', e.target.value)}
                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputSurface}`}
              >
                <option value="compact">Compact</option>
                <option value="standard">Standard</option>
                <option value="spacious">Spacious</option>
              </select>
            </div>

            <label className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer ${rowSurface}`}>
              <span className="font-medium">Show Signatures</span>
              <input
                type="checkbox"
                checked={layout.showSignatures}
                onChange={() => onToggleSettingBool('showSignatures')}
                className="w-3.5 h-3.5 accent-[#CB1417] cursor-pointer"
              />
            </label>

            <label className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer ${rowSurface}`}>
              <span className="font-medium">Show Footer Disclaimer</span>
              <input
                type="checkbox"
                checked={layout.showFooterNote}
                onChange={() => onToggleSettingBool('showFooterNote')}
                className="w-3.5 h-3.5 accent-[#CB1417] cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      {/* TAB 3: BRANDING & TYPOGRAPHY */}
      {activeTab === 'branding' && (
        <div className="space-y-3">
          <label className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer ${rowSurface}`}>
            <span className="font-medium">Show Company Logo</span>
            <input
              type="checkbox"
              checked={layout.showLogo}
              onChange={() => onToggleSettingBool('showLogo')}
              className="w-3.5 h-3.5 accent-[#CB1417] cursor-pointer"
            />
          </label>

          <label className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer ${rowSurface}`}>
            <span className="font-medium">Show Tax / Reg ID</span>
            <input
              type="checkbox"
              checked={layout.showTaxId}
              onChange={() => onToggleSettingBool('showTaxId')}
              className="w-3.5 h-3.5 accent-[#CB1417] cursor-pointer"
            />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold mb-1">Logo Size</label>
              <select
                value={layout.logoSize || 'medium'}
                onChange={(e) => onSelectSetting('logoSize', e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs ${inputSurface}`}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Logo Position</label>
              <select
                value={layout.logoPosition || 'left'}
                onChange={(e) => onSelectSetting('logoPosition', e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs ${inputSurface}`}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Header Alignment</label>
            <select
              value={layout.alignHeader}
              onChange={(e) => onSelectSetting('alignHeader', e.target.value)}
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputSurface}`}
            >
              <option value="left">Left Aligned</option>
              <option value="center">Center Aligned</option>
              <option value="right">Right Aligned</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">Document Font Family</label>
            <select
              value={layout.fontFamily || 'helvetica'}
              onChange={(e) => onSelectSetting('fontFamily', e.target.value)}
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputSurface}`}
            >
              <option value="helvetica">Helvetica / Clean Sans</option>
              <option value="sans">Modern Sans</option>
              <option value="times">Times New Roman (Serif)</option>
              <option value="courier">Courier (Monospace)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">Header Size ({layout.headerFontSize ?? 15} pt)</label>
            <input
              type="range"
              min={12}
              max={20}
              value={layout.headerFontSize ?? 15}
              onChange={(e) => onSelectSetting('headerFontSize', Number(e.target.value))}
              className="w-full accent-[#CB1417] cursor-pointer"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Body Size ({layout.bodyFontSize ?? 8} pt)</label>
            <input
              type="range"
              min={7}
              max={11}
              value={layout.bodyFontSize ?? 8}
              onChange={(e) => onSelectSetting('bodyFontSize', Number(e.target.value))}
              className="w-full accent-[#CB1417] cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold mb-1">Primary Accent</label>
              <input
                type="color"
                value={layout.primaryColor}
                onChange={(e) => onSelectSetting('primaryColor', e.target.value)}
                className="w-full h-8 rounded cursor-pointer border-0 bg-transparent"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Deductions Header</label>
              <input
                type="color"
                value={layout.secondaryColor || '#18181B'}
                onChange={(e) => onSelectSetting('secondaryColor', e.target.value)}
                className="w-full h-8 rounded cursor-pointer border-0 bg-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t dark:border-[#222222] border-[#E4E4E7]">
            <div>
              <label className="block text-[10px] font-semibold mb-1">Earnings Heading</label>
              <input
                type="text"
                value={layout.labelEarnings || 'EARNINGS'}
                onChange={(e) => onLabelChange('labelEarnings', e.target.value)}
                className={`w-full px-2 py-1 rounded border text-[11px] ${inputSurface}`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1">Deductions Heading</label>
              <input
                type="text"
                value={layout.labelDeductions || 'DEDUCTIONS'}
                onChange={(e) => onLabelChange('labelDeductions', e.target.value)}
                className={`w-full px-2 py-1 rounded border text-[11px] ${inputSurface}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CUSTOM TEXT BLOCKS */}
      {activeTab === 'blocks' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <input
              type="text"
              value={newBlockTitle}
              onChange={(e) => setNewBlockTitle(e.target.value)}
              placeholder="Notice Title (e.g. Tax Declaration Note)"
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputSurface}`}
            />
            <textarea
              rows={2}
              value={newBlockContent}
              onChange={(e) => setNewBlockContent(e.target.value)}
              placeholder="Notice or policy footer content..."
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputSurface}`}
            />
            <select
              value={newBlockPos}
              onChange={(e) => setNewBlockPos(e.target.value as any)}
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputSurface}`}
            >
              <option value="afterEmployeeInfo">Place After Employee Grid</option>
              <option value="afterNetPay">Place After Net Salary Box</option>
              <option value="footer">Place in Footer Notes</option>
            </select>
            <button
              type="button"
              onClick={() => {
                if (!newBlockContent.trim()) return;
                onAddTextBlock(newBlockTitle, newBlockContent, newBlockPos);
                setNewBlockTitle('');
                setNewBlockContent('');
              }}
              className="w-full py-2 bg-[#CB1417] hover:bg-[#ED1F24] text-white rounded-lg font-bold flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Text Block</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {(layout.customTextBlocks || []).map((blk) => (
              <div key={blk.id} className={`p-2.5 rounded-lg border space-y-1 ${rowSurface}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[11px] truncate">{blk.title}</span>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={blk.visible !== false}
                      onChange={() => onToggleTextBlock(blk.id)}
                      className="w-3.5 h-3.5 accent-[#CB1417] cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteTextBlock(blk.id)}
                      className="text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 line-clamp-2">{blk.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
