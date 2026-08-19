'use client';

import React, { useState, useMemo } from 'react';
import { SheetData, MeasurementData, AssignmentData, KeyMeasureData } from '@/types/takeoff';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Square,
  Minus,
  Circle,
  Search,
  Pencil,
  Upload,
  Ruler,
  Sparkles,
  Eye,
  EyeOff,
  MoreHorizontal,
  AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LeftPanelProps {
  sheets: SheetData[];
  measurements: MeasurementData[];
  assignments: AssignmentData[];
  keyMeasures: KeyMeasureData[];
  activeSheetId: string | null;
  onSelectSheet: (id: string) => void;
  hoveredId: string | null;
  assignHighlightId?: string | null;
  onHover: (id: string | null) => void;
  onToggleVisibility: (id: string) => void;
  onImportPlan?: () => void;
  onDetectScale?: (sheet: SheetData) => void;
}

export default function LeftPanel({
  sheets,
  measurements,
  assignments,
  keyMeasures,
  activeSheetId,
  onSelectSheet,
  hoveredId,
  assignHighlightId,
  onHover,
  onToggleVisibility,
  onImportPlan,
  onDetectScale,
}: LeftPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSheets, setExpandedSheets] = useState<Set<string>>(() => {
    return new Set(activeSheetId ? [activeSheetId] : []);
  });

  // When activeSheetId changes, auto-expand it
  React.useEffect(() => {
    if (activeSheetId) {
      setExpandedSheets((prev) => {
        const next = new Set(prev);
        next.add(activeSheetId);
        return next;
      });
    }
  }, [activeSheetId]);

  // Auto-expand the sheet containing a highlighted (assigned-icon) measurement so the highlight is visible
  React.useEffect(() => {
    if (!assignHighlightId) return;
    const m = (measurements ?? []).find((x) => x.id === assignHighlightId);
    if (m?.sheetId) {
      setExpandedSheets((prev) => {
        if (prev.has(m.sheetId!)) return prev;
        const next = new Set(prev);
        next.add(m.sheetId!);
        return next;
      });
    }
  }, [assignHighlightId, measurements]);

  // Build KM name map for display
  const kmMap = useMemo(() => {
    const map = new Map<string, KeyMeasureData>();
    (keyMeasures ?? []).forEach((km) => map.set(km.id, km));
    return map;
  }, [keyMeasures]);

  // Get measurements for a given sheet
  const getMeasurementsForSheet = useMemo(() => {
    const bySheet = new Map<string, MeasurementData[]>();
    (measurements ?? []).forEach((m) => {
      if (m.sheetId) {
        const list = bySheet.get(m.sheetId) || [];
        list.push(m);
        bySheet.set(m.sheetId, list);
      }
    });
    return bySheet;
  }, [measurements]);

  // Get assignment for a measurement (to show KM name)
  const assignmentByMeasId = useMemo(() => {
    const map = new Map<string, AssignmentData>();
    (assignments ?? []).forEach((a) => {
      map.set(a.measurementId, a);
    });
    return map;
  }, [assignments]);

  const filteredSheets = useMemo(() => {
    if (!searchQuery.trim()) return sheets;
    const q = searchQuery.toLowerCase();
    return sheets.filter((s) => s.name.toLowerCase().includes(q));
  }, [sheets, searchQuery]);

  const toggleSheet = (id: string) => {
    setExpandedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const typeIcon = (type: string, color: string) => {
    const iconClass = 'w-3 h-3 flex-shrink-0';
    switch (type) {
      case 'area': return <Square className={iconClass} style={{ color }} />;
      case 'linear': return <Minus className={iconClass} style={{ color }} />;
      case 'count': return <Circle className={iconClass} style={{ color }} />;
      default: return <Square className={iconClass} style={{ color }} />;
    }
  };

  const formatValue = (value: number, type: string): string => {
    if (type === 'count') return String(Math.round(value ?? 0));
    return (value ?? 0)?.toFixed?.(2) ?? '0.00';
  };

  const allExpanded = sheets.length > 0 && sheets.every((s) => expandedSheets.has(s.id));
  const setAllExpanded = (v: boolean) =>
    setExpandedSheets(v ? new Set(sheets.map((s) => s.id)) : new Set());

  return (
    <div className="w-[280px] min-w-[280px] bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 h-11 flex-shrink-0 border-b border-neutral-200 flex items-center gap-2">
        <button
          onClick={() => setAllExpanded(!allExpanded)}
          className="text-neutral-400 hover:text-neutral-700 transition-colors"
          title={allExpanded ? 'Collapse all sheets' : 'Expand all sheets'}
        >
          {allExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <h3 className="text-sm font-semibold text-neutral-900 flex-1">Sheets</h3>
        <span className="text-[11px] text-neutral-400 tabular-nums">{sheets.length}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-400 hover:text-neutral-900">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem className="text-xs cursor-pointer" onClick={onImportPlan}>
              <Upload className="w-3.5 h-3.5 mr-2" /> Import plan…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setAllExpanded(true)}>Expand all</DropdownMenuItem>
            <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => setAllExpanded(false)}>Collapse all</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Sheet list */}
      <div className="flex-1 overflow-y-auto">
        {filteredSheets.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-gray-400">No sheets found.</p>
          </div>
        ) : (
          filteredSheets.map((sheet) => {
            const isActive = activeSheetId === sheet.id;
            const isExpanded = expandedSheets.has(sheet.id);
            const sheetMeasurements = getMeasurementsForSheet.get(sheet.id) || [];
            const measCount = sheetMeasurements.length;

            return (
              <div key={sheet.id} className="border-b border-neutral-100 last:border-b-0">
                {/* Sheet row */}
                <div
                  className={`group/sheet flex items-center gap-1.5 px-3 py-2 cursor-pointer transition-colors ${
                    isActive ? 'bg-neutral-100' : 'hover:bg-neutral-50'
                  }`}
                  onClick={() => {
                    onSelectSheet(sheet.id);
                    toggleSheet(sheet.id);
                  }}
                >
                  {measCount > 0 ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSheet(sheet.id);
                      }}
                      className="flex-shrink-0 p-0.5"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      )}
                    </button>
                  ) : (
                    <div className="w-4.5 flex-shrink-0" />
                  )}
                  <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`} />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className={`text-xs truncate ${isActive ? 'text-neutral-900 font-semibold' : 'text-neutral-700 font-medium'}`}>
                      {sheet.name}
                    </span>
                    <div className="flex items-center gap-1">
                      {sheet.scale && sheet.scale !== 'N/A' ? (
                        <span className="text-[9px] text-gray-400 font-mono flex items-center gap-0.5">
                          <Ruler className="w-2.5 h-2.5" />
                          {sheet.scale}
                        </span>
                      ) : (
                        <span className="text-[9px] text-gray-400 italic">No scale</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDetectScale?.(sheet);
                        }}
                        className="opacity-0 group-hover/sheet:opacity-100 ml-auto flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium text-teal-600 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 rounded transition-all"
                        title="Auto-detect scale with AI"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        Scale
                      </button>
                    </div>
                  </div>
                  {measCount > 0 && (
                    <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">{measCount}</span>
                  )}
                </div>

                {/* Measurements under this sheet */}
                {isExpanded && measCount > 0 && (
                  <div className="pb-1">
                    {/* Unavailable lengths alert */}
                    {(() => {
                      const unavailable = sheetMeasurements.filter(
                        (m) => m.type !== 'count' && !(Number(m.value) > 0)
                      ).length;
                      if (unavailable === 0) return null;
                      return (
                        <div className="mx-3 my-1.5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          <span className="text-[11px] text-amber-800 flex-1 truncate">
                            {unavailable} Unavailable Length{unavailable === 1 ? '' : 's'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDetectScale?.(sheet);
                            }}
                            className="px-2 py-0.5 rounded-md bg-white border border-amber-300 text-[10px] font-medium text-amber-800 hover:bg-amber-100 transition-colors"
                          >
                            Resolve
                          </button>
                        </div>
                      );
                    })()}
                    {sheetMeasurements.map((m) => {
                      const assignment = assignmentByMeasId.get(m.id);
                      const km = assignment?.keyMeasureId ? kmMap.get(assignment.keyMeasureId) : null;
                      const isHovered = hoveredId === m.id;
                      const isAssignHighlight = !!assignHighlightId && assignHighlightId === m.id;
                      const displayName = km ? km.name : m.name;
                      const displayColor = km ? km.color : m.color;

                      return (
                        <div
                          key={m.id}
                          className={`group flex items-center gap-1.5 pl-6 pr-3 py-1 cursor-pointer transition-all duration-150 ${
                            isAssignHighlight
                              ? 'bg-emerald-100 ring-1 ring-inset ring-emerald-400'
                              : isHovered ? 'bg-sky-50' : 'hover:bg-neutral-50'
                          }`}
                          onMouseEnter={() => onHover?.(m.id)}
                          onMouseLeave={() => onHover?.(null)}
                        >
                          {/* Visibility chip */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleVisibility?.(m.id);
                            }}
                            title={m.visible ? 'Hide on canvas' : 'Show on canvas'}
                            className={`flex-shrink-0 w-6 h-5 rounded-md flex items-center justify-center transition-colors ${
                              m.visible ? 'hover:brightness-95' : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                            }`}
                            style={
                              m.visible
                                ? { backgroundColor: `${displayColor ?? '#7c3aed'}22`, color: displayColor ?? '#7c3aed' }
                                : undefined
                            }
                          >
                            {m.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </button>

                          {/* Type icon */}
                          {typeIcon(m.type, displayColor)}

                          {/* Name */}
                          <span className={`text-[11px] truncate flex-1 font-mono ${isAssignHighlight ? 'text-emerald-700 font-semibold' : 'text-neutral-700'}`}>
                            {displayName}
                          </span>

                          {/* Value */}
                          {m.type !== 'count' && !(Number(m.value) > 0) ? (
                            <span className="flex items-center gap-1 flex-shrink-0">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              <span className="text-[10px] font-mono text-neutral-400 whitespace-nowrap">
                                {m.unit}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-neutral-500 whitespace-nowrap flex-shrink-0 tabular-nums">
                              {formatValue(m.value, m.type)} {m.unit}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
