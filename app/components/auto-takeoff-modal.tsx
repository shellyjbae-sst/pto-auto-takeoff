'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { SheetData } from '@/types/takeoff';
import {
  X,
  Sparkles,
  Zap,
  Scale,
  Settings2,
  Play,
  ChevronRight,
  ChevronLeft,
  Check,
  Clock,
  Info,
  Layers,
  FileText,

  Brain,
  Crosshair,
  Cpu,
  BoxSelect,
  ChevronDown,
  SlidersHorizontal,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* ===== Types ===== */
export interface RegionBounds {
  x: number; y: number; w: number; h: number;
}

export interface AutoTakeoffConfig {
  // Scope
  scopeMode: 'all' | 'current' | 'selected' | 'region';
  selectedSheetIds: Set<string>;
  regionBounds: RegionBounds | null;
  // Model
  modelCategories: Set<string>;
  // Run mode
  runMode: 'fast' | 'balanced' | 'precision';
  // Granularity
  granularity: 'coarse' | 'standard' | 'detailed';
  // Fallback defaults used when the AI can't confidently detect a value (keyed by field id)
  detectionDefaults: Record<string, string>;
  // Which default-value fields the user has enabled (field ids)
  detectionDefaultsEnabled: Set<string>;
  // Detections with a confidence at/below this percentage are flagged for review
  confidenceThreshold: number;
}

// User-configurable fallback values. When the AI cannot confidently detect one of
// these attributes on the drawings, it uses the value chosen here instead of guessing.
interface DefaultValueField {
  id: string;
  label: string;
  default: string;
}

const DEFAULT_VALUE_FIELDS: DefaultValueField[] = [
  { id: 'wall_stud_size', label: 'Wall Framing Size', default: '2x6' },
  { id: 'wall_height', label: 'Wall Height', default: "9'" },
  { id: 'floor_joist_size', label: 'Floor Joist Size', default: '2x10' },
  { id: 'joist_spacing', label: 'Joist Spacing', default: '16" O.C.' },
  { id: 'header_size', label: 'Header Size', default: '2x10' },
  { id: 'header_plies', label: 'Default Plies', default: '2' },
  { id: 'lumber_grade', label: 'Lumber Species / Grade', default: 'SPF #2' },
];

// Build the default record (field id -> default value) used to seed the config.
function buildDefaultValues(): Record<string, string> {
  return Object.fromEntries(DEFAULT_VALUE_FIELDS.map((f) => [f.id, f.default]));
}

const DEFAULT_CONFIG: AutoTakeoffConfig = {
  scopeMode: 'current',
  selectedSheetIds: new Set(),
  regionBounds: null,
  modelCategories: new Set(['walls', 'rated_walls', 'beam_headers', 'wall_openings']),
  runMode: 'balanced',
  granularity: 'standard',
  detectionDefaults: buildDefaultValues(),
  detectionDefaultsEnabled: new Set(DEFAULT_VALUE_FIELDS.map((f) => f.id)),
  confidenceThreshold: 80,
};

interface AutoTakeoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRun: (config: AutoTakeoffConfig) => void;
  sheets: SheetData[];
  activeSheetId: string | null;
  onStartRegionSelect?: () => void;
  externalRegionBounds?: { x: number; y: number; w: number; h: number } | null;
}

// Unique, canonical set of detectable components. Selection state is keyed on these ids.
const DETECT_COMPONENTS = [
  { id: 'walls', label: 'Walls' },
  { id: 'rated_walls', label: 'Rated Walls' },
  { id: 'beam_headers', label: 'Beam/Headers' },
  { id: 'wall_openings', label: 'Wall Openings (Door, Window, Garage Door, Cased Opening)' },
  { id: 'floor_framing_layout', label: 'Floor Framing Layout' },
  { id: 'floor_framing_hardware', label: 'Floor Framing Hardware' },
  { id: 'floor_area', label: 'Floor Area (total floor area only, no rooms)' },
  { id: 'roof_framing_layout', label: 'Roof Framing Layout' },
  { id: 'roof_framing_hardware', label: 'Roof Framing Hardware' },
  { id: 'roof_area', label: 'Roof (area/linear)' },
  { id: 'rated_wall_hardware', label: 'Rated Wall Hardware' },
];
const ALL_COMPONENT_IDS = DETECT_COMPONENTS.map((c) => c.id);

// Assembly groups are overlapping collections over the shared component set above:
// the same component can appear in several groups. Selection is tracked per
// group-instance (see selectedInstances) so toggling one group never changes the
// identical component shown in a different group.
const DETECT_GROUPS: { id: string; label: string; componentIds: string[] }[] = [
  { id: 'all', label: 'All Components', componentIds: ALL_COMPONENT_IDS },
  { id: 'structural_framing', label: 'Structural Framing', componentIds: ['walls', 'rated_walls', 'beam_headers', 'floor_framing_layout', 'floor_framing_hardware', 'floor_area', 'roof_framing_layout', 'roof_framing_hardware', 'roof_area'] },
  { id: 'wall_systems', label: 'Wall Systems', componentIds: ['walls', 'rated_walls', 'beam_headers'] },
  { id: 'floor_systems', label: 'Floor Systems', componentIds: ['floor_area', 'floor_framing_layout', 'floor_framing_hardware'] },
  { id: 'hardware', label: 'Hardware', componentIds: ['floor_framing_hardware', 'roof_framing_hardware', 'rated_wall_hardware'] },
  { id: 'wall_openings', label: 'Wall Openings Only', componentIds: ['wall_openings'] },
];

// A selection instance key uniquely identifies one component row inside one group.
const instKey = (groupId: string, compId: string) => `${groupId}::${compId}`;

// Build the set of instance keys for every group that contains a component id in `compIds`.
function instancesFromCompIds(compIds: Set<string>): Set<string> {
  const s = new Set<string>();
  DETECT_GROUPS.forEach((g) => g.componentIds.forEach((c) => { if (compIds.has(c)) s.add(instKey(g.id, c)); }));
  return s;
}

// Every instance key across all groups (used for "Select all").
function allInstances(): Set<string> {
  const s = new Set<string>();
  DETECT_GROUPS.forEach((g) => g.componentIds.forEach((c) => s.add(instKey(g.id, c))));
  return s;
}

const RUN_MODES = [
  { id: 'fast' as const, label: 'Fast', desc: 'Lower accuracy, fewer compute units', icon: Zap, time: '~2 min', cu: 2, color: 'text-gray-900 bg-gray-50 border-gray-900' },
  { id: 'balanced' as const, label: 'Balanced', desc: 'Good accuracy/speed tradeoff', icon: Scale, time: '~5 min', cu: 5, color: 'text-gray-900 bg-gray-50 border-gray-900' },
  { id: 'precision' as const, label: 'High Accuracy', desc: 'Best results, longer runtime', icon: Brain, time: '~12 min', cu: 12, color: 'text-gray-900 bg-gray-50 border-gray-900' },
];

const GRANULARITY_LEVELS = [
  { id: 'coarse' as const, label: 'Coarse', desc: 'Bulk counts & areas' },
  { id: 'standard' as const, label: 'Standard', desc: 'Individual elements' },
  { id: 'detailed' as const, label: 'Detailed', desc: 'Per-component attributes' },
];

const STEPS = ['Scope & Model', 'Run Settings', 'Review & Run'];

export default function AutoTakeoffModal({ isOpen, onClose, onRun, sheets, activeSheetId, onStartRegionSelect, externalRegionBounds }: AutoTakeoffModalProps) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<AutoTakeoffConfig>(() => ({
    ...DEFAULT_CONFIG,
    selectedSheetIds: new Set(activeSheetId ? [activeSheetId] : []),
  }));

  // Per-group-instance selection state (keys: `${groupId}::${compId}`). This is the
  // source of truth for the component checkboxes so each group toggles independently.
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(() => instancesFromCompIds(DEFAULT_CONFIG.modelCategories));

  // Flattened set of unique component ids that are selected in at least one group.
  const selectedCompIds = useMemo(() => {
    const s = new Set<string>();
    selectedInstances.forEach((k) => { const c = k.split('::')[1]; if (c) s.add(c); });
    return s;
  }, [selectedInstances]);

  // When external region bounds arrive (drawn on canvas), apply them
  useEffect(() => {
    if (externalRegionBounds && isOpen) {
      setConfig((p) => ({ ...p, scopeMode: 'region', regionBounds: externalRegionBounds }));
    }
  }, [externalRegionBounds, isOpen]);

  const handleClose = useCallback(() => {
    setStep(0);
    onClose();
  }, [onClose]);

  const handleRun = useCallback(() => {
    onRun({ ...config, modelCategories: new Set(selectedCompIds) });
    setStep(0);
  }, [config, onRun, selectedCompIds]);

  // Toggle a single component row inside one specific group (instance-scoped).
  const toggleInstance = (groupId: string, compId: string) => {
    setSelectedInstances((prev) => {
      const next = new Set(prev);
      const k = instKey(groupId, compId);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const toggleSheet = (id: string) => {
    setConfig((prev) => {
      const next = new Set(prev.selectedSheetIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, selectedSheetIds: next };
    });
  };

  const selectedRunMode = RUN_MODES.find((m) => m.id === config.runMode)!;

  // Compute estimate (simulated) — uses "Compute Units" (CU) instead of $$
  const sheetCount = config.scopeMode === 'all' ? sheets.length : config.scopeMode === 'region' ? 1 : config.scopeMode === 'current' ? 1 : config.selectedSheetIds.size;
  const regionDiscount = config.scopeMode === 'region' && config.regionBounds ? 0.4 : 1; // region is partial sheet, cheaper
  const modelCount = selectedCompIds.size;
  const timeMultiplier = config.runMode === 'fast' ? 1 : config.runMode === 'balanced' ? 2.5 : 6;
  const granMultiplier = config.granularity === 'coarse' ? 0.7 : config.granularity === 'standard' ? 1 : 1.5;
  const estMinutes = Math.max(1, Math.round(sheetCount * modelCount * 0.3 * timeMultiplier * granMultiplier * regionDiscount));
  const estCU = Math.max(1, Math.round(sheetCount * modelCount * selectedRunMode.cu * granMultiplier * regionDiscount * 0.5));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[640px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white">
          <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">Auto-Takeoff</h2>
            <p className="text-xs text-gray-500">Configure AI-assisted measurement detection</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-gray-100 bg-gray-50/50">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <button
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  i === step ? 'text-gray-900' : i < step ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                  i === step ? 'bg-gray-900 text-white border-gray-900' : i < step ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-300'
                }`}>
                  {i < step ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-gray-900' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 0 && <StepScopeModel config={config} setConfig={setConfig} sheets={sheets} activeSheetId={activeSheetId} selectedInstances={selectedInstances} setSelectedInstances={setSelectedInstances} selectedCompIds={selectedCompIds} toggleInstance={toggleInstance} toggleSheet={toggleSheet} onStartRegionSelect={onStartRegionSelect} />}
          {step === 1 && <StepRunSettings config={config} setConfig={setConfig} />}
          {step === 2 && <StepReview config={config} sheets={sheets} estMinutes={estMinutes} estCU={estCU} selectedRunMode={selectedRunMode} selectedCompIds={selectedCompIds} />}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 py-3 border-t border-gray-200 bg-gray-50/50">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="gap-1">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </Button>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mr-2">
            <Clock className="w-3.5 h-3.5" />
            <span>~{estMinutes} min</span>
            <span className="mx-1">·</span>
            <Cpu className="w-3.5 h-3.5" />
            <span>{estCU} CU</span>
          </div>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} className="gap-1 bg-gray-900 hover:bg-gray-800 text-white">
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleRun} className="gap-1.5 bg-gray-900 hover:bg-gray-800 text-white">
              <Play className="w-3.5 h-3.5" /> Run Auto-Takeoff
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Step 1: Scope & Model ===== */

function StepScopeModel({ config, setConfig, sheets, activeSheetId, selectedInstances, setSelectedInstances, selectedCompIds, toggleInstance, toggleSheet, onStartRegionSelect }: {
  config: AutoTakeoffConfig;
  setConfig: React.Dispatch<React.SetStateAction<AutoTakeoffConfig>>;
  sheets: SheetData[];
  activeSheetId: string | null;
  selectedInstances: Set<string>;
  setSelectedInstances: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedCompIds: Set<string>;
  toggleInstance: (groupId: string, compId: string) => void;
  toggleSheet: (id: string) => void;
  onStartRegionSelect?: () => void;
}) {
  const activeSheet = sheets.find((s) => s.id === activeSheetId);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ wall_systems: true });

  const toggleGroup = (groupId: string) => {
    const group = DETECT_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    setSelectedInstances((prev) => {
      const next = new Set(prev);
      const allSelected = group.componentIds.every((c) => next.has(instKey(groupId, c)));
      if (allSelected) group.componentIds.forEach((c) => next.delete(instKey(groupId, c)));
      else group.componentIds.forEach((c) => next.add(instKey(groupId, c)));
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Scope Selection */}
      <div>
        <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-gray-500" /> Input Scope
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'all' as const, label: 'All Sheets', desc: `${sheets.length} sheets`, icon: Layers },
            { id: 'current' as const, label: 'Current Sheet', desc: activeSheet?.name ?? 'None', icon: FileText },
            { id: 'selected' as const, label: 'Select Sheets', desc: 'Choose specific', icon: Check },
            { id: 'region' as const, label: 'Selected Region', desc: config.regionBounds ? 'Region selected ✓' : 'Draw area on sheet', icon: BoxSelect },
          ].map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  if (opt.id === 'region' && onStartRegionSelect) {
                    // Set scope mode and trigger draw-on-plan flow
                    setConfig((p) => ({ ...p, scopeMode: 'region' }));
                    onStartRegionSelect();
                  } else {
                    setConfig((p) => ({ ...p, scopeMode: opt.id }));
                  }
                }}
                className={`p-3 rounded-lg border text-left transition-all flex items-start gap-2.5 ${
                  config.scopeMode === opt.id
                    ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${config.scopeMode === opt.id ? 'text-gray-900' : 'text-gray-400'}`} />
                <div>
                  <span className={`text-xs font-semibold ${config.scopeMode === opt.id ? 'text-gray-900' : 'text-gray-700'}`}>
                    {opt.label}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Sheet picker when 'selected' */}
        {config.scopeMode === 'selected' && (
          <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-0.5">
            {sheets.map((s) => (
              <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.selectedSheetIds.has(s.id)}
                  onChange={() => toggleSheet(s.id)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
                />
                <span className="text-xs text-gray-700">{s.name}</span>
              </label>
            ))}
          </div>
        )}

        {/* Region info when 'region' */}
        {config.scopeMode === 'region' && (
          <div className="mt-2 border border-gray-300 bg-gray-50 rounded-lg p-3">
            {config.regionBounds ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-gray-900 flex items-center justify-center">
                    <Crosshair className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">Region selected</p>
                    <p className="text-[10px] text-gray-500">{config.regionBounds.w} × {config.regionBounds.h} px on current sheet</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onStartRegionSelect?.()}
                    className="text-[10px] font-medium text-white hover:bg-gray-800 bg-gray-900 px-2 py-1 rounded transition-colors"
                  >
                    Redraw
                  </button>
                  <button
                    onClick={() => setConfig((p) => ({ ...p, regionBounds: null }))}
                    className="text-[10px] font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => onStartRegionSelect?.()}
                className="w-full flex items-center justify-center gap-2 py-3 text-xs font-semibold text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <Crosshair className="w-4 h-4" />
                Draw Region on Plan
              </button>
            )}
          </div>
        )}
      </div>

      {/* What to Detect */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-gray-500" /> What to Detect
          </h4>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setSelectedInstances(allInstances())}
              className="text-xs font-semibold text-gray-900 hover:text-gray-700"
            >
              Select all
            </button>
            <button
              onClick={() => setSelectedInstances(new Set())}
              className="text-xs font-medium text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500">Select groups or individual components for the AI to identify.</p>
        <p className="text-[11px] text-gray-400 mt-0.5 mb-2.5">
          {selectedCompIds.size} of {DETECT_COMPONENTS.length} components selected
        </p>

        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {DETECT_GROUPS.map((group) => {
            const selectedInGroup = group.componentIds.filter((c) => selectedInstances.has(instKey(group.id, c))).length;
            const total = group.componentIds.length;
            const groupState: 'all' | 'some' | 'none' =
              selectedInGroup === 0 ? 'none' : selectedInGroup === total ? 'all' : 'some';
            const isExpanded = expandedGroups[group.id] ?? false;
            return (
              <div key={group.id}>
                {/* Group header row */}
                <div className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${groupState !== 'none' ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                      groupState === 'all' ? 'bg-gray-900 border-gray-900'
                        : groupState === 'some' ? 'bg-white border-gray-500'
                        : 'border-gray-300 hover:border-gray-500'
                    }`}
                    aria-label={`Toggle ${group.label}`}
                  >
                    {groupState === 'all' && <Check className="w-3 h-3 text-white" />}
                    {groupState === 'some' && <Minus className="w-3 h-3 text-gray-900" />}
                  </button>
                  <button
                    onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.id]: !isExpanded }))}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                  >
                    <span className="text-sm font-semibold text-gray-800 truncate">{group.label}</span>
                    {group.id !== 'all' && selectedInGroup > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium flex-shrink-0">
                        {selectedInGroup}/{total}
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 ml-auto flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {/* Component rows */}
                {isExpanded && (
                  <div className="bg-white">
                    {group.componentIds.map((cid) => {
                      const comp = DETECT_COMPONENTS.find((c) => c.id === cid);
                      if (!comp) return null;
                      const selected = selectedInstances.has(instKey(group.id, cid));
                      return (
                        <button
                          key={`${group.id}-${cid}`}
                          onClick={() => toggleInstance(group.id, cid)}
                          className="w-full flex items-center gap-2.5 pl-9 pr-3 py-2 text-left border-t border-gray-50 hover:bg-gray-50 transition-colors"
                        >
                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                            selected ? 'bg-gray-900 border-gray-900' : 'border-gray-300'
                          }`}>
                            {selected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className={`text-xs ${selected ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>{comp.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===== Step 2: Run Settings ===== */
function StepRunSettings({ config, setConfig }: {
  config: AutoTakeoffConfig;
  setConfig: React.Dispatch<React.SetStateAction<AutoTakeoffConfig>>;
}) {
  return (
    <div className="space-y-5">
      {/* Default Values — fallback assumptions when AI confidence is low */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-gray-500" /> Default Values
          </h4>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setConfig((p) => ({ ...p, detectionDefaultsEnabled: new Set(DEFAULT_VALUE_FIELDS.map((f) => f.id)) }))}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              Select all
            </button>
            <button
              onClick={() => setConfig((p) => ({ ...p, detectionDefaultsEnabled: new Set() }))}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              Deselect all
            </button>
            <button
              onClick={() => setConfig((p) => ({ ...p, detectionDefaults: buildDefaultValues() }))}
              className="text-xs font-medium text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              Reset values
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-2.5">
          Choose which values to pre-set. When the AI can&apos;t confidently detect an enabled value, it falls back to your choice instead of guessing.
        </p>
        <div className="space-y-1.5">
          {DEFAULT_VALUE_FIELDS.map((field) => {
            const enabled = config.detectionDefaultsEnabled.has(field.id);
            return (
              <div key={field.id} className={`flex items-center gap-2 ${enabled ? '' : 'opacity-40'}`}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => setConfig((p) => {
                    const next = new Set(p.detectionDefaultsEnabled);
                    if (next.has(field.id)) next.delete(field.id); else next.add(field.id);
                    return { ...p, detectionDefaultsEnabled: next };
                  })}
                  className="w-3 h-3 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer flex-shrink-0"
                />
                <span className="text-[11px] font-medium text-gray-600 w-[130px] flex-shrink-0 select-none">{field.label}</span>
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    value={config.detectionDefaults[field.id] ?? field.default}
                    disabled={!enabled}
                    onChange={(e) => setConfig((p) => ({ ...p, detectionDefaults: { ...p.detectionDefaults, [field.id]: e.target.value } }))}
                    className="w-full text-xs text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 transition-colors disabled:cursor-default disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Confidence threshold slider */}
        <div className="mt-4 rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-700">Confidence threshold</span>
            <span className="text-xs font-semibold text-gray-900 tabular-nums">{config.confidenceThreshold}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={99}
            step={1}
            value={config.confidenceThreshold}
            onChange={(e) => setConfig((p) => ({ ...p, confidenceThreshold: Number(e.target.value) }))}
            className="w-full accent-gray-900 cursor-pointer"
          />
          <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
            <span>50% (fewer flags)</span>
            <span>99% (more flags)</span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Detections scoring at or below {config.confidenceThreshold}% are flagged for review.
          </p>
        </div>
      </div>
    </div>
  );
}


/* ===== Step 4: Review & Run ===== */
function StepReview({ config, sheets, estMinutes, estCU, selectedRunMode, selectedCompIds }: {
  config: AutoTakeoffConfig;
  sheets: SheetData[];
  estMinutes: number;
  estCU: number;
  selectedRunMode: typeof RUN_MODES[0];
  selectedCompIds: Set<string>;
}) {
  const scopeLabel = config.scopeMode === 'all'
    ? `All Sheets (${sheets.length})`
    : config.scopeMode === 'current'
    ? 'Current Sheet Only'
    : config.scopeMode === 'region'
    ? `Selected Region${config.regionBounds ? ` (${Math.round(config.regionBounds.w)}×${Math.round(config.regionBounds.h)} px)` : ''}`
    : `${config.selectedSheetIds.size} Selected Sheet(s)`;

  const modelLabels = DETECT_COMPONENTS.filter((c) => selectedCompIds.has(c.id)).map((c) => c.label);
  const defaultEntries = DEFAULT_VALUE_FIELDS.filter((f) => config.detectionDefaultsEnabled.has(f.id)).map((f) => ({ label: f.label, value: config.detectionDefaults[f.id] ?? f.default }));

  // CU tier label
  const cuTier = estCU <= 5 ? 'Low' : estCU <= 15 ? 'Medium' : 'High';
  const cuTierColor = 'text-gray-900';

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Run Summary</h4>
        <div className="space-y-2.5 text-xs">
          <SummaryRow label="Scope" value={scopeLabel} />
          <SummaryRow label="Detection Models" value={modelLabels.join(', ') || 'None selected'} />
          <SummaryRow label="Confidence Threshold" value={`${config.confidenceThreshold}% — detections at or below are flagged`} />

        </div>
      </div>

      {/* Default values used when AI confidence is low */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
          <SlidersHorizontal className="w-4 h-4 text-gray-500" /> Default Values
        </h4>
        <p className="text-[11px] text-gray-500 mb-3">Applied where the AI can&apos;t confidently detect a value.</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {defaultEntries.map((d) => (
            <div key={d.label} className="flex justify-between gap-2">
              <span className="text-gray-500 truncate">{d.label}</span>
              <span className="text-gray-900 font-medium flex-shrink-0">{d.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Estimate box */}
      <div className="flex gap-3">
        <div className="flex-1 p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
          <Clock className="w-5 h-5 text-gray-900 mx-auto mb-1" />
          <div className="text-lg font-bold text-gray-900">~{estMinutes} min</div>
          <p className="text-[10px] text-gray-500">Estimated runtime</p>
        </div>
        <div className="flex-1 p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
          <Cpu className="w-5 h-5 text-gray-900 mx-auto mb-1" />
          <div className="text-lg font-bold text-gray-900">{estCU} CU</div>
          <p className="text-[10px] text-gray-500">Compute Units</p>
        </div>
        <div className="flex-1 p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
          <Zap className="w-5 h-5 text-gray-500 mx-auto mb-1" />
          <div className={`text-lg font-bold ${cuTierColor}`}>{cuTier}</div>
          <p className="text-[10px] text-gray-400">Resource usage</p>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <Info className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600">
          AI detections will appear as Quick Measures with confidence scores. You can review, accept, edit, or reject each one in the Human-in-the-Loop review queue.
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="text-gray-500 w-32 flex-shrink-0">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}