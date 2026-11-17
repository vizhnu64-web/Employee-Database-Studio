import React from 'react';
import {
  SlidersHorizontal,
  Eye,
  EyeOff,
  RotateCcw,
  Lock,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUp,
  ArrowDown,
  Layers,
} from 'lucide-react';
import { PayslipElementConfig, PayslipLayoutSettings } from '../../types/payroll';
import {
  PAYSLIP_FIELD_REGISTRY,
  EXTRA_METADATA_FIELDS,
  getFieldLabelInLayout,
  isFieldVisibleInLayout,
  getElementStyleConfig,
} from '../../utils/payslipFieldRegistry';

interface ElementInspectorPanelProps {
  isDark: boolean;
  selectedKey: string | null;
  layout: PayslipLayoutSettings;
  visibleFieldCount: number;
  totalRegistryCount: number;
  onUpdateElement: (key: string, patch: Partial<PayslipElementConfig>) => void;
  onResetElement: (key: string) => void;
  onToggleFieldVisible: (key: string) => void;
  onToggleMaskBank: (masked: boolean) => void;
  onMoveFieldOrder: (key: string, dir: -1 | 1) => void;
}

export const ElementInspectorPanel: React.FC<ElementInspectorPanelProps> = ({
  isDark,
  selectedKey,
  layout,
  visibleFieldCount,
  totalRegistryCount,
  onUpdateElement,
  onResetElement,
  onToggleFieldVisible,
  onToggleMaskBank,
  onMoveFieldOrder,
}) => {
  const cardSurface = isDark ? 'bg-[#0D0D0E] border-[#222222]' : 'bg-white border-[#E4E4E7]';
  const inputSurface = isDark
    ? 'bg-[#141416] border-[#27272A] text-white'
    : 'bg-[#FAFAFC] border-[#E4E4E7] text-black';
  const subSurface = isDark ? 'bg-[#141416] border-[#27272A]' : 'bg-[#FAFAFC] border-[#E4E4E7]';

  if (!selectedKey) {
    return (
      <div className={`border rounded-xl p-4 space-y-4 text-xs ${cardSurface}`}>
        <div className="border-b pb-3 dark:border-[#222222] border-[#E4E4E7]">
          <h3 className={`text-sm font-bold flex items-center space-x-2 ${isDark ? 'text-white' : 'text-black'}`}>
            <SlidersHorizontal className="w-4 h-4 text-[#CB1417]" />
            <span>Properties Inspector</span>
          </h3>
          <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#A1A1AA]' : 'text-[#71717A]'}`}>
            Click any field on the A4 preview sheet or in the Field Library to inspect and style it.
          </p>
        </div>

        <div className={`p-3 rounded-xl border space-y-2 ${subSurface}`}>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Active Fields Rendered:</span>
            <span className="font-mono font-bold tabular-nums">
              {visibleFieldCount} / {totalRegistryCount}+
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Active Template:</span>
            <span className="font-semibold capitalize">{(layout.templatePreset || 'professional_corporate').replace(/_/g, ' ')}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Bank Account Masking:</span>
            <span className="font-semibold">{layout.maskBankAccount ? 'Masked (••••1234)' : 'Full Number'}</span>
          </div>
        </div>

        <div className={`p-3 rounded-xl border text-[11px] space-y-1.5 ${subSurface}`}>
          <div className="font-bold text-[#CB1417] flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Quick Inspector Capabilities</span>
          </div>
          <ul className="space-y-1 text-zinc-500 list-disc list-inside">
            <li>Show or hide any of the 36 payslip fields</li>
            <li>Rename any field or table total label</li>
            <li>Customize font size, weight, color, background &amp; borders</li>
            <li>Mask sensitive Bank Account digits on preview &amp; PDF</li>
            <li>Reorder employee grid &amp; top-level payslip sections</li>
          </ul>
        </div>
      </div>
    );
  }

  const registryMeta = PAYSLIP_FIELD_REGISTRY.find((f) => f.key === selectedKey);
  const extraMeta = EXTRA_METADATA_FIELDS.find((f) => f.key === selectedKey);
  const customMeta = (layout.customFieldsMeta || []).find((f) => f.key === selectedKey);

  const cfg = getElementStyleConfig(layout, selectedKey);

  const currentVisible = registryMeta
    ? isFieldVisibleInLayout(layout, registryMeta)
    : extraMeta
      ? layout[extraMeta.showKey] !== false
      : customMeta
        ? customMeta.visible !== false
        : cfg.visible !== false;

  const currentLabel = registryMeta
    ? getFieldLabelInLayout(layout, registryMeta)
    : extraMeta
      ? String(layout[extraMeta.labelKey] || extraMeta.defaultLabel)
      : customMeta
        ? customMeta.label
        : cfg.label || selectedKey;

  const sectionBadge = registryMeta
    ? registryMeta.sectionName
    : extraMeta
      ? 'Payslip Metadata'
      : customMeta
        ? 'Custom Studio Field'
        : 'Payslip Element';

  const canMovePlacement =
    registryMeta && ['ctc', 'employerPf', 'employerEsi'].includes(registryMeta.key);

  const isInfoSortable =
    registryMeta?.defaultPlacement === 'employeeInfo' || extraMeta !== undefined;

  return (
    <div className={`border rounded-xl p-4 space-y-4 text-xs ${cardSurface}`}>
      {/* Inspector Header */}
      <div className="border-b pb-3 dark:border-[#222222] border-[#E4E4E7] flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#CB1417] truncate">
            {sectionBadge}
          </div>
          <h3 className={`text-sm font-bold truncate mt-0.5 ${isDark ? 'text-white' : 'text-black'}`}>
            {currentLabel}
          </h3>
          <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
            key: {selectedKey}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleFieldVisible(selectedKey)}
          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center space-x-1 shrink-0 cursor-pointer ${
            currentVisible
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
          }`}
          title="Toggle field visibility on preview & PDF"
        >
          {currentVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>{currentVisible ? 'Visible' : 'Hidden'}</span>
        </button>
      </div>

      {/* Label & Ordering */}
      <div className="space-y-3">
        <div>
          <label className="block font-semibold mb-1">Display Label</label>
          <input
            type="text"
            value={currentLabel}
            onChange={(e) => onUpdateElement(selectedKey, { label: e.target.value })}
            className={`w-full px-3 py-1.5 rounded-lg border text-xs outline-none ${inputSurface}`}
            placeholder="Custom field label..."
          />
        </div>

        {isInfoSortable && (
          <div>
            <label className="block font-semibold mb-1">Grid Order Position</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onMoveFieldOrder(selectedKey, -1)}
                className={`py-1.5 px-2.5 rounded-lg border font-medium flex items-center justify-center space-x-1 cursor-pointer ${inputSurface}`}
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>Move Earlier</span>
              </button>
              <button
                type="button"
                onClick={() => onMoveFieldOrder(selectedKey, 1)}
                className={`py-1.5 px-2.5 rounded-lg border font-medium flex items-center justify-center space-x-1 cursor-pointer ${inputSurface}`}
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Move Later</span>
              </button>
            </div>
          </div>
        )}

        {canMovePlacement && (
          <div>
            <label className="block font-semibold mb-1">Section Placement</label>
            <select
              value={cfg.sectionPlacement || registryMeta?.defaultPlacement || 'employeeInfo'}
              onChange={(e) =>
                onUpdateElement(selectedKey, {
                  sectionPlacement: e.target.value as PayslipElementConfig['sectionPlacement'],
                })
              }
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputSurface}`}
            >
              <option value="employeeInfo">Employee Info &amp; CTC Grid</option>
              <option value="earnings">Inside Earnings Table</option>
            </select>
          </div>
        )}

        {selectedKey === 'bankAccount' && (
          <label className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${subSurface}`}>
            <div className="flex items-center space-x-2">
              <Lock className="w-3.5 h-3.5 text-[#CB1417]" />
              <div>
                <div className="font-semibold">Mask Bank Account</div>
                <div className="text-[10px] text-zinc-500">Show ••••••1234 instead of full digits</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(layout.maskBankAccount)}
              onChange={(e) => onToggleMaskBank(e.target.checked)}
              className="w-4 h-4 accent-[#CB1417] cursor-pointer"
            />
          </label>
        )}
      </div>

      {/* Alignment, Width & Value Format */}
      <div className="space-y-3 pt-3 border-t dark:border-[#222222] border-[#E4E4E7]">
        <div>
          <label className="block font-semibold mb-1">Alignment</label>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { val: 'left' as const, icon: AlignLeft, text: 'Left' },
              { val: 'center' as const, icon: AlignCenter, text: 'Center' },
              { val: 'right' as const, icon: AlignRight, text: 'Right' },
            ]).map((item) => {
              const Icon = item.icon;
              const active = (cfg.align || 'right') === item.val;
              return (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => onUpdateElement(selectedKey, { align: item.val })}
                  className={`py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-center space-x-1 cursor-pointer ${
                    active ? 'bg-[#CB1417] text-white border-[#CB1417]' : inputSurface
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{item.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block font-semibold mb-1">Width</label>
            <select
              value={cfg.width || 'half'}
              onChange={(e) =>
                onUpdateElement(selectedKey, { width: e.target.value as PayslipElementConfig['width'] })
              }
              className={`w-full px-2 py-1.5 rounded-lg border text-[11px] ${inputSurface}`}
            >
              <option value="half">Half Row</option>
              <option value="full">Full Row</option>
              <option value="auto">Auto</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">Border Style</label>
            <select
              value={cfg.borderStyle || 'subtle'}
              onChange={(e) =>
                onUpdateElement(selectedKey, {
                  borderStyle: e.target.value as PayslipElementConfig['borderStyle'],
                })
              }
              className={`w-full px-2 py-1.5 rounded-lg border text-[11px] ${inputSurface}`}
            >
              <option value="subtle">Subtle Line</option>
              <option value="solid">Boxed</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1">Value Format</label>
          <select
            value={cfg.valueFormat || 'auto'}
            onChange={(e) =>
              onUpdateElement(selectedKey, {
                valueFormat: e.target.value as PayslipElementConfig['valueFormat'],
              })
            }
            className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputSurface}`}
          >
            <option value="auto">Auto (Registry Default)</option>
            <option value="text">Plain Text</option>
            <option value="currency">Currency Formatted</option>
            <option value="number">Numeric</option>
            <option value="date">Date String</option>
            <option value="masked">Masked (••••Last4)</option>
          </select>
        </div>
      </div>

      {/* Typography & Colors */}
      <div className="space-y-3 pt-3 border-t dark:border-[#222222] border-[#E4E4E7]">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block font-semibold mb-1">Font Family</label>
            <select
              value={cfg.fontFamily || 'inherit'}
              onChange={(e) =>
                onUpdateElement(selectedKey, {
                  fontFamily: e.target.value as PayslipElementConfig['fontFamily'],
                })
              }
              className={`w-full px-2 py-1.5 rounded-lg border text-[11px] ${inputSurface}`}
            >
              <option value="inherit">Inherit</option>
              <option value="helvetica">Helvetica</option>
              <option value="times">Times Serif</option>
              <option value="courier">Courier Mono</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">Font Weight</label>
            <select
              value={cfg.fontWeight || 'bold'}
              onChange={(e) =>
                onUpdateElement(selectedKey, {
                  fontWeight: e.target.value as PayslipElementConfig['fontWeight'],
                })
              }
              className={`w-full px-2 py-1.5 rounded-lg border text-[11px] ${inputSurface}`}
            >
              <option value="normal">Regular</option>
              <option value="medium">Medium</option>
              <option value="bold">Bold</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1">
            Font Size ({cfg.fontSize ?? layout.bodyFontSize ?? 8} pt)
          </label>
          <input
            type="range"
            min={7}
            max={12}
            value={cfg.fontSize ?? layout.bodyFontSize ?? 8}
            onChange={(e) => onUpdateElement(selectedKey, { fontSize: Number(e.target.value) })}
            className="w-full accent-[#CB1417] cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block font-semibold mb-1">Text Color</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={cfg.textColor || '#000000'}
                onChange={(e) => onUpdateElement(selectedKey, { textColor: e.target.value })}
                className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
              />
              <span className="font-mono text-[10px] truncate">{cfg.textColor || 'Default'}</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Highlight Bg</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={cfg.backgroundColor || '#FFFFFF'}
                onChange={(e) => onUpdateElement(selectedKey, { backgroundColor: e.target.value })}
                className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
              />
              <span className="font-mono text-[10px] truncate">{cfg.backgroundColor || 'Transparent'}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onResetElement(selectedKey)}
          className={`w-full py-1.5 rounded-lg border text-[11px] font-semibold flex items-center justify-center space-x-1.5 cursor-pointer ${inputSurface}`}
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Element Styles</span>
        </button>
      </div>
    </div>
  );
};
