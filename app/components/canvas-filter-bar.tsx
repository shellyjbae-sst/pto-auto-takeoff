'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MeasurementData, SectionData, UseData } from '@/types/takeoff';
import {
  Sparkles,
  Square,
  Minus,
  Circle,
  Layers,
  Eye,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  X,
  Settings2,
  GripVertical,
} from 'lucide-react';

export interface CanvasFilters {
  showKeyMeasures: boolean;
  showQuickMeasures: boolean;
  showAutoTakeoff: boolean;
  types: Set<string>;
  sectionIds: Set<string>;
  useIds: Set<string>;
}

export const DEFAULT_FILTERS: CanvasFilters = {
  showKeyMeasures: true,
  showQuickMeasures: true,
  showAutoTakeoff: true,
  types: new Set(),
  sectionIds: new Set(),
  useIds: new Set(),
};

export function hasActiveFilters(f: CanvasFilters): boolean {
  return (
    !f.showKeyMeasures ||
    !f.showQuickMeasures ||
    !f.showAutoTakeoff ||
    f.types.size > 0 ||
    f.sectionIds.size > 0 ||
    f.useIds.size > 0
  );
}

interface CanvasFilterBarProps {
  filters: CanvasFilters;
  onChange: (filters: CanvasFilters) => void;
  sections: SectionData[];
  uses: UseData[];
  visibleCount: number;
  totalCount: number;
  allMeasurements: MeasurementData[];
  keyMeasureIds: Set<string>;
  aiMeasurementIds: Set<string>;
  sectionMeasurementCounts: Map<string, number>;
  useMeasurementCounts: Map<string, number>;
  /** Lifted position state so it persists across show/hide */
  position: { x: number; y: number } | null;
  onPositionChange: (pos: { x: number; y: number } | null) => void;
}

// Distinct colors for each section
const SECTION_COLORS: Record<string, string> = {
  'sec-wing-a': '#6366F1',   // Indigo
  'sec-wing-b': '#EC4899',   // Pink
  'sec-common': '#0EA5E9',   // Sky
  'sec-exterior': '#84CC16', // Lime
};
const SECTION_COLOR_FALLBACKS = ['#8B5CF6', '#F43F5E', '#06B6D4', '#22C55E', '#F97316', '#A855F7'];

function getSectionColor(sectionId: string, index: number): string {
  return SECTION_COLORS[sectionId] || SECTION_COLOR_FALLBACKS[index % SECTION_COLOR_FALLBACKS.length];
}

// Distinct colors for uses
const USE_COLORS: Record<string, string> = {
  'use-bid-estimate': '#F59E0B', // Amber
  'use-budget': '#10B981',       // Emerald
  'use-change-order': '#EF4444', // Red
  'use-verification': '#6366F1', // Indigo
};
const USE_COLOR_FALLBACKS = ['#F97316', '#14B8A6', '#8B5CF6', '#EC4899', '#0EA5E9', '#84CC16'];

function getUseColor(useId: string, index: number): string {
  return USE_COLORS[useId] || USE_COLOR_FALLBACKS[index % USE_COLOR_FALLBACKS.length];
}

interface LegendRowProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  colorDot?: string;
  icon?: React.ReactNode;
  /** 'visibility' (default) = eye icon, shown is quiet / hidden is dimmed+strikethrough.
   *  'select' = filled-dot indicator for inclusive type filters. */
  variant?: 'visibility' | 'select';
}

function LegendRow({ label, count, active, onClick, colorDot, icon, variant = 'visibility' }: LegendRowProps) {
  const isVis = variant === 'visibility';

  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-2 w-full px-2.5 py-[5px] rounded-md text-left transition-all text-[11px] ${
        isVis
          ? active ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-400 hover:bg-gray-50'
          : active ? 'text-gray-700 hover:bg-gray-50' : 'text-gray-500 hover:bg-gray-50'
      }`}
    >
      {/* Leading indicator */}
      <div className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center">
        {isVis ? (
          // Eye / Eye-off for show/hide toggles
          active ? (
            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c1.655 0 3.225-.373 4.625-1.04M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          )
        ) : (
          // Small ring/filled dot for inclusive type filters
          <div className={`w-2.5 h-2.5 rounded-full border transition-all ${
            active
              ? 'border-gray-400 bg-gray-400'
              : 'border-gray-300 bg-transparent group-hover:border-gray-400'
          }`} />
        )}
      </div>

      {/* Color dot or icon */}
      {colorDot ? (
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-opacity ${
            isVis
              ? active ? 'opacity-100' : 'opacity-30'
              : active ? 'opacity-100' : 'opacity-50 group-hover:opacity-75'
          }`}
          style={{ backgroundColor: colorDot }}
        />
      ) : icon ? (
        <span className={`flex-shrink-0 transition-opacity ${
          isVis
            ? active ? 'text-gray-500' : 'text-gray-300'
            : active ? 'text-gray-500' : 'text-gray-400'
        }`}>{icon}</span>
      ) : null}

      <span className={`flex-1 truncate transition-all ${
        isVis
          ? active ? '' : 'line-through opacity-60'
          : active ? 'font-medium' : ''
      }`}>{label}</span>
      <span className={`tabular-nums text-[10px] ${active ? 'text-gray-400' : 'text-gray-300'}`}>{count}</span>
    </button>
  );
}

/** Collapsible group wrapper */
function CollapsibleGroup({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="px-2 pt-1.5 pb-0.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full px-1 mb-0.5 group"
      >
        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider flex-1 text-left">{label}</span>
        {open ? (
          <ChevronUp className="w-2.5 h-2.5 text-gray-300 group-hover:text-gray-400 transition-colors" />
        ) : (
          <ChevronDown className="w-2.5 h-2.5 text-gray-300 group-hover:text-gray-400 transition-colors" />
        )}
      </button>
      {open && children}
    </div>
  );
}

/** Reusable multi-select dropdown (Section / Use) */
function MultiSelectDropdown({
  label,
  items,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
  getColor,
  getCount,
  getShortName,
}: {
  label: string;
  items: { id: string; name: string }[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  getColor: (id: string, idx: number) => string;
  getCount: (id: string) => number;
  getShortName: (name: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative px-0.5">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-1.5 px-2.5 py-[6px] rounded-md border text-[11px] transition-all ${
          selectedIds.size > 0
            ? 'border-gray-300 bg-gray-50 text-gray-700'
            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
        }`}
      >
        <span className="flex-1 text-left truncate">
          {selectedIds.size === 0
            ? `All ${label}`
            : allSelected
            ? `All ${label}`
            : items
                .filter((s) => selectedIds.has(s.id))
                .map((s) => getShortName(s.name))
                .join(', ')}
        </span>
        {selectedIds.size > 0 && !allSelected && (
          <span className="flex-shrink-0 bg-teal-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {selectedIds.size}
          </span>
        )}
        {selectedIds.size > 0 ? (
          <X
            className="w-3 h-3 flex-shrink-0 text-teal-500 hover:text-red-500 transition-colors"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
          />
        ) : (
          <ChevronDown className={`w-3 h-3 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 bottom-full mb-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {items.map((item, idx) => {
            const color = getColor(item.id, idx);
            const count = getCount(item.id);
            const shortName = getShortName(item.name);
            const isSelected = selectedIds.has(item.id);
            return (
              <button
                key={item.id}
                onClick={() => onToggle(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-[6px] text-[11px] text-left transition-colors ${
                  isSelected ? 'text-gray-800' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
                style={isSelected ? { backgroundColor: `${color}12` } : undefined}
              >
                <div
                  className="w-3.5 h-3.5 rounded-[3px] border flex-shrink-0 flex items-center justify-center transition-all"
                  style={isSelected ? { backgroundColor: color, borderColor: color } : { borderColor: '#D1D5DB' }}
                >
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div
                  className={`w-1 h-3.5 rounded-full flex-shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-40'}`}
                  style={{ backgroundColor: color }}
                />
                <span className={`flex-1 truncate ${isSelected ? 'font-medium' : ''}`}>{shortName}</span>
                <span className="tabular-nums text-[10px] flex-shrink-0" style={{ color: isSelected ? color : '#9CA3AF' }}>{count}</span>
              </button>
            );
          })}

          <div className="border-t border-gray-100 mt-1 pt-1 px-1 flex gap-1">
            <button
              onClick={() => { onSelectAll(); setOpen(false); }}
              className="flex-1 text-center text-[10px] py-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={() => { onClear(); setOpen(false); }}
              className="flex-1 text-center text-[10px] py-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CanvasFilterBar({
  filters,
  onChange,
  sections,
  uses,
  visibleCount,
  totalCount,
  allMeasurements,
  keyMeasureIds,
  sectionMeasurementCounts,
  useMeasurementCounts,
  position,
  onPositionChange,
}: CanvasFilterBarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const active = hasActiveFilters(filters);

  // Draggable refs (position is lifted to parent)
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    const rect = popoverRef.current?.getBoundingClientRect();
    if (rect) {
      dragStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    e.preventDefault();
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const parentRect = popoverRef.current?.parentElement?.getBoundingClientRect();
      if (!parentRect) return;
      const newX = e.clientX - parentRect.left - dragStart.current.x;
      const newY = e.clientY - parentRect.top - dragStart.current.y;
      onPositionChange({ x: newX, y: newY });
    };
    const handleUp = () => { isDragging.current = false; };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [onPositionChange]);

  // Compute counts
  const kmCount = allMeasurements.filter((m) => keyMeasureIds.has(m.id)).length;
  const qmCount = allMeasurements.length - kmCount;
  const aiCount = allMeasurements.filter((m) => m.isAI).length;
  const areaCount = allMeasurements.filter((m) => m.type === 'area').length;
  const linearCount = allMeasurements.filter((m) => m.type === 'linear').length;
  const countCount = allMeasurements.filter((m) => m.type === 'count').length;
  const joistRafterCount = allMeasurements.filter((m) => /JOIST|RAFTER|\bJST\b|\bRAFT\b/.test((m.name ?? '').toUpperCase())).length;
  const beamHeaderCount = allMeasurements.filter((m) => /BEAM|HEADER|\bHDR\b/.test((m.name ?? '').toUpperCase())).length;

  const toggleKM = () => onChange({ ...filters, showKeyMeasures: !filters.showKeyMeasures });
  const toggleQM = () => onChange({ ...filters, showQuickMeasures: !filters.showQuickMeasures });
  const toggleAutoTakeoff = () => onChange({ ...filters, showAutoTakeoff: !filters.showAutoTakeoff });

  const toggleType = (type: string) => {
    const next = new Set(filters.types);
    if (next.has(type)) next.delete(type); else next.add(type);
    onChange({ ...filters, types: next });
  };

  const toggleSection = (sectionId: string) => {
    const next = new Set(filters.sectionIds);
    if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId);
    onChange({ ...filters, sectionIds: next });
  };

  const toggleUse = (useId: string) => {
    const next = new Set(filters.useIds);
    if (next.has(useId)) next.delete(useId); else next.add(useId);
    onChange({ ...filters, useIds: next });
  };

  const clearAll = () => {
    onChange({ showKeyMeasures: true, showQuickMeasures: true, showAutoTakeoff: true, types: new Set(), sectionIds: new Set(), useIds: new Set() });
  };

  return (
    <div
      ref={popoverRef}
      className="absolute z-10 flex flex-col items-end"
      style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : { bottom: 48, right: 12 }}
    >
      <div
        className="bg-white/[0.97] backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/80 overflow-hidden"
        style={{ width: collapsed ? 'auto' : '220px' }}
      >
        {/* Header — draggable */}
        <div
          onMouseDown={handleDragStart}
          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 transition-colors cursor-grab active:cursor-grabbing select-none"
        >
          <GripVertical className="w-3 h-3 text-gray-300 flex-shrink-0" />
          <Settings2 className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-[11px] font-semibold text-gray-700 flex-1 text-left">Visibility Settings</span>
          {active && !collapsed && (
            <span className="text-[10px] text-gray-500 font-medium tabular-nums">
              {visibleCount}/{totalCount}
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-0.5 rounded hover:bg-gray-200 transition-colors"
          >
            {collapsed ? (
              <ChevronUp className="w-3 h-3 text-gray-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-gray-400" />
            )}
          </button>
        </div>

        {!collapsed && (
          <div className="border-t border-gray-100">
            {/* Origin — Key Measures, Quick Measures, Auto-Takeoff all in one group */}
            <CollapsibleGroup label="Origin">
              <LegendRow
                icon={<Layers className="w-3 h-3" />}
                label="Key Measures"
                count={kmCount}
                active={filters.showKeyMeasures}
                onClick={toggleKM}
              />
              <LegendRow
                icon={<Eye className="w-3 h-3" />}
                label="Quick Measures"
                count={qmCount}
                active={filters.showQuickMeasures}
                onClick={toggleQM}
              />
              <LegendRow
                label="Auto-Takeoff"
                count={aiCount}
                active={filters.showAutoTakeoff}
                onClick={toggleAutoTakeoff}
                icon={<Sparkles className="w-3 h-3" />}
              />
            </CollapsibleGroup>

            <div className="h-px bg-gray-100 mx-2" />

            {/* Type */}
            <CollapsibleGroup label="Type">
              <LegendRow
                label="Area"
                count={areaCount}
                active={filters.types.has('area')}
                onClick={() => toggleType('area')}
                colorDot="#10B981"
                icon={<Square className="w-3 h-3" />}
                variant="select"
              />
              <LegendRow
                label="Linear"
                count={linearCount}
                active={filters.types.has('linear')}
                onClick={() => toggleType('linear')}
                colorDot="#F97316"
                icon={<Minus className="w-3 h-3" />}
                variant="select"
              />
              <LegendRow
                label="Count"
                count={countCount}
                active={filters.types.has('count')}
                onClick={() => toggleType('count')}
                colorDot="#F59E0B"
                icon={<Circle className="w-3 h-3" />}
                variant="select"
              />
              <LegendRow
                label="Joist/Rafter"
                count={joistRafterCount}
                active={filters.types.has('joist_rafter')}
                onClick={() => toggleType('joist_rafter')}
                colorDot="#6366F1"
                icon={<Minus className="w-3 h-3" />}
                variant="select"
              />
              <LegendRow
                label="Beam/Header"
                count={beamHeaderCount}
                active={filters.types.has('beam_header')}
                onClick={() => toggleType('beam_header')}
                colorDot="#0EA5E9"
                icon={<Square className="w-3 h-3" />}
                variant="select"
              />
            </CollapsibleGroup>

            <div className="h-px bg-gray-100 mx-2" />

            {/* Use dropdown */}
            {uses.length > 0 && (
              <>
                <CollapsibleGroup label="Use">
                  <MultiSelectDropdown
                    label="Uses"
                    items={uses}
                    selectedIds={filters.useIds}
                    onToggle={toggleUse}
                    onSelectAll={() => onChange({ ...filters, useIds: new Set(uses.map((u) => u.id)) })}
                    onClear={() => onChange({ ...filters, useIds: new Set() })}
                    getColor={getUseColor}
                    getCount={(id) => useMeasurementCounts.get(id) || 0}
                    getShortName={(name) => name}
                  />
                </CollapsibleGroup>
                <div className="h-px bg-gray-100 mx-2" />
              </>
            )}

            {/* Section dropdown */}
            {sections.length > 0 && (
              <CollapsibleGroup label="Section">
                <MultiSelectDropdown
                  label="Sections"
                  items={sections}
                  selectedIds={filters.sectionIds}
                  onToggle={toggleSection}
                  onSelectAll={() => onChange({ ...filters, sectionIds: new Set(sections.map((s) => s.id)) })}
                  onClear={() => onChange({ ...filters, sectionIds: new Set() })}
                  getColor={getSectionColor}
                  getCount={(id) => sectionMeasurementCounts.get(id) || 0}
                  getShortName={(name) => name.replace(/^Wing [A-Z] - /, '')}
                />
              </CollapsibleGroup>
            )}

            {/* Footer */}
            {active && (
              <>
                <div className="h-px bg-gray-100 mx-2" />
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <span className="text-[10px] text-gray-500 flex-1">
                    {visibleCount} of {totalCount} visible
                  </span>
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                    title="Reset all filters"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Reset
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}